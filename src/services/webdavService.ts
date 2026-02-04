import { WebDavConfig } from '../types';
import { buildAuthHeader, t } from '../utils';

const REQUEST_TIMEOUT = 15000;

export class WebDAVService {

    /**
     * Check if WebDAV connection is working
     */
    async checkConnection(config: WebDavConfig, lang: string = 'en'): Promise<{ success: boolean; error?: string }> {
        // Validate configuration before attempting connection
        if (!config.url || !config.url.trim()) {
            return { success: false, error: t('urlRequired', lang) };
        }
        if (!config.user || !config.user.trim()) {
            return { success: false, error: t('usernameNotConfigured', lang) };
        }
        if (!config.pass || !config.pass.trim()) {
            return { success: false, error: t('passwordNotConfigured', lang) };
        }

        try {
            const url = this.buildUrl(config, '/');
            const headers = { 'Authorization': buildAuthHeader(config.user, config.pass) };

            console.log('[WebDAV] Testing connection to:', url);
            console.log('[WebDAV] Platform:', this.getPlatform());
            console.log('[WebDAV] CORS Proxy:', config.corsProxy || 'none');

            const response = await this.fetchWithProxy(url, {
                method: 'PROPFIND',
                headers: {
                    ...headers,
                    'Depth': '0',
                    'Content-Type': 'application/xml',
                },
                body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`,
                config
            });

            console.log('[WebDAV] Response status:', response.status, 'ok:', response.ok);

            if (response.ok) {
                return { success: true };
            } else {
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }
        } catch (error: any) {
            console.error('[WebDAV] Connection failed:', error);
            return {
                success: false,
                error: error.message || 'Unknown error'
            };
        }
    }

    /**
     * Upload file to WebDAV
     */
    async uploadFile(
        config: WebDavConfig,
        localPath: string,
        remotePath: string,
        content: string | Blob
    ): Promise<boolean> {
        try {
            const url = this.buildUrl(config, remotePath);
            const headers = { 'Authorization': buildAuthHeader(config.user, config.pass) };

            const response = await this.fetchWithProxy(url, {
                method: 'PUT',
                headers: {
                    ...headers,
                    'Content-Type': typeof content === 'string' ? 'application/json' : 'application/octet-stream',
                },
                body: content,
                config
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('[WebDAV] Failed to upload file:', error);
            throw error;
        }
    }

    /**
     * Download file from WebDAV
     */
    async downloadFile(config: WebDavConfig, remotePath: string): Promise<string> {
        try {
            const url = this.buildUrl(config, remotePath);
            const headers = { 'Authorization': buildAuthHeader(config.user, config.pass) };

            const response = await this.fetchWithProxy(url, {
                method: 'GET',
                headers,
                config
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            return await response.text();
        } catch (error) {
            console.error('[WebDAV] Failed to download file:', error);
            throw error;
        }
    }

    /**
     * Get file status (exists, size, last modified)
     */
    async getFileStatus(config: WebDavConfig, path: string): Promise<{
        exists: boolean;
        size?: number;
        lastModified?: Date;
    }> {
        try {
            const url = this.buildUrl(config, path);
            const headers = { 'Authorization': buildAuthHeader(config.user, config.pass) };

            const response = await this.fetchWithProxy(url, {
                method: 'HEAD',
                headers,
                config
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return { exists: false };
                }
                throw new Error(`Stat failed: ${response.status} ${response.statusText}`);
            }

            const contentLength = response.headers.get('content-length');
            const lastModified = response.headers.get('last-modified');

            return {
                exists: true,
                size: contentLength ? parseInt(contentLength, 10) : undefined,
                lastModified: lastModified ? new Date(lastModified) : undefined
            };
        } catch (error: any) {
            // Check if this is a 404/not found error by looking at status or message
            const isNotFoundError =
                (typeof error.status === 'number' && error.status === 404) ||
                (typeof error.code === 'number' && error.code === 404) ||
                (error.message && error.message.includes('404'));

            if (isNotFoundError) {
                return { exists: false };
            }
            throw error;
        }
    }

    /**
     * Build full URL with target folder
     */
    private buildUrl(config: WebDavConfig, path: string): string {
        let url = config.url.trim();
        if (!url.endsWith('/')) url += '/';

        // Add target folder if specified
        if (config.targetFolder) {
            let cleanFolder = config.targetFolder.trim();
            cleanFolder = cleanFolder.replace(/^\/+|\/+$/g, '');
            if (cleanFolder.length > 0) {
                url += cleanFolder + '/';
            }
        }

        // Add path
        if (path && path !== '/') {
            const cleanPath = path.replace(/^\/+|\/+$/g, '');
            if (cleanPath.length > 0) {
                url += cleanPath;
            }
        }

        return url;
    }

    /**
     * Get current platform
     */
    private getPlatform(): 'electron' | 'tauri' | 'web' {
        // Check for Electron first
        if (typeof (window as any).process !== 'undefined' &&
            (window as any).process.type === 'renderer') {
            return 'electron';
        }

        // Check for Tauri
        if (typeof (window as any).__TAURI__ !== 'undefined') {
            return 'tauri';
        }

        // Check user agent as fallback
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes(' electron/')) {
            return 'electron';
        }

        return 'web';
    }

    /**
     * Fetch with CORS proxy support
     * This method handles three scenarios:
     * 1. Web mode: always applies CORS proxy if configured
     * 2. Electron mode: uses electronAPI if available, otherwise uses native fetch
     * 3. Tauri mode: uses Tauri HTTP API if available
     */
    private async fetchWithProxy(
        url: string,
        options: {
            method: string;
            headers?: Record<string, string>;
            body?: string | Blob;
            config: WebDavConfig;
        }
    ): Promise<Response> {
        const platform = this.getPlatform();
        let finalUrl = url;
        let finalHeaders = options.headers || {};

        // Tauri mode: use Tauri HTTP API to bypass CORS
        if (platform === 'tauri') {
            console.log('[WebDAV] Using Tauri HTTP API');
            try {
                const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
                
                const response = await tauriFetch(finalUrl, {
                    method: options.method as any,
                    headers: finalHeaders,
                    body: options.body as any,
                });

                return {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText || '',
                    text: async () => response.text(),
                    headers: response.headers
                } as any;
            } catch (e: any) {
                console.error('[WebDAV] Tauri HTTP API failed:', e);
                // Fall through to native fetch
            }
        }

        // Handle CORS proxy for Web mode
        if (platform === 'web') {
            if (!options.config.corsProxy) {
                // In web mode without proxy, we should still try to fetch
                // This will likely fail due to CORS, but we want to try
                console.warn('[WebDAV] Web mode without CORS proxy - request may fail due to CORS');
            } else {
                const proxy = options.config.corsProxy.trim();
                if (proxy.includes('thingproxy')) {
                    finalUrl = proxy + url;
                } else if (proxy.endsWith('=')) {
                    finalUrl = proxy + encodeURIComponent(url);
                } else {
                    finalUrl = proxy + url;
                }
                console.log('[WebDAV] Using CORS proxy:', finalUrl);
            }
        }

        // Electron mode: try to use electron API first
        if (platform === 'electron') {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI?.webdavRequest) {
                console.log('[WebDAV] Using Electron API');
                try {
                    const res = await electronAPI.webdavRequest(finalUrl, {
                        method: options.method,
                        headers: finalHeaders,
                        body: options.body
                    });
                    return {
                        ok: res.ok,
                        status: res.status,
                        statusText: res.statusText,
                        text: async () => res.text,
                        headers: new Map(Object.entries(res.headers || {}))
                    } as any;
                } catch (e) {
                    console.error('[WebDAV] Electron API failed, falling back to fetch:', e);
                    // Fall through to native fetch
                }
            } else {
                console.log('[WebDAV] No Electron API available, using native fetch');
            }
        }

        // Native fetch for all modes (as fallback or primary)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
            console.log('[WebDAV] Fetching:', options.method, finalUrl);

            const response = await fetch(finalUrl, {
                method: options.method,
                headers: finalHeaders,
                body: options.body,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${REQUEST_TIMEOUT / 1000}s`);
            }

            // Enhance error message with CORS hint
            if (error.name === 'TypeError' &&
                (error.message.includes('fetch') || error.message.includes('Failed to fetch')) &&
                platform === 'web' &&
                !options.config.corsProxy) {
                error.message = 'Failed to fetch: Browser blocked the request. Please configure a CORS Proxy in Advanced Settings.';
            }

            throw error;
        }
    }

    /**
     * Disconnect client
     */
    disconnect(): void {
        // No-op since we don't maintain a persistent client
    }
}

// Singleton instance
export const webdavService = new WebDAVService();

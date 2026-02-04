import { WebDavConfig } from '../types';

// API limiter (inspired by obsidian-nutstore-sync)
class APILimiter {
    private queue: Array<() => Promise<any>> = [];
    private running = 0;
    private readonly maxConcurrent = 1;
    private readonly minTime = 200;

    async schedule<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({
                fn,
                resolve,
                reject
            } as any);
            this.process();
        });
    }

    private async process() {
        if (this.running >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        this.running++;
        const item = this.queue.shift();
        if (!item) {
            this.running--;
            return;
        }

        try {
            const result = await item.fn();
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        } finally {
            this.running--;
            setTimeout(() => this.process(), this.minTime);
        }
    }
}

const apiLimiter = new APILimiter();

// Check if we're in Tauri environment
function isTauri(): boolean {
    return typeof (window as any).__TAURI__ !== 'undefined';
}

// Tauri HTTP fetch (for mobile/Android support)
async function tauriFetch(
    url: string,
    options: {
        method: string;
        headers?: Record<string, string>;
        body?: string | Blob;
        signal?: AbortSignal;
    }
): Promise<Response> {
    if (!isTauri()) {
        // Fallback to native fetch for non-Tauri environments
        return fetch(url, options);
    }

    const __TAURI__ = (window as any).__TAURI__;

    // Import HTTP client lazily (only available in Tauri)
    const { fetch: tauriFetch } = await __TAURI__.plugins.http;

    // Prepare headers for Tauri
    const tauriHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(options.headers || {})) {
        tauriHeaders[key] = value;
    }

    // Prepare body for Tauri - must be a string
    let tauriBody: string | undefined = undefined;
    if (options.body) {
        if (typeof options.body === 'string') {
            tauriBody = options.body;
        } else if (options.body instanceof Blob) {
            tauriBody = await options.body.text();
        }
    }

    try {
        const response = await tauriFetch(url, {
            method: options.method as any,
            headers: tauriHeaders,
            body: tauriBody,
            connectTimeout: 30,
            readTimeout: 60,
        });

        // Convert Tauri response to standard Response
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText || '',
            url: response.url || url,
            redirected: false,
            type: 'default' as ResponseType,
            headers: new Headers(),
            clone: () => null as any,
            body: null,
            bodyUsed: false,
            text: async () => response.data as string,
            json: async () => JSON.parse(response.data as string),
            arrayBuffer: async () => new TextEncoder().encode(response.data as string).buffer,
            blob: async () => new Blob([response.data]),
        } as Response;
    } catch (error: any) {
        // Tauri HTTP errors
        throw new Error(`Tauri HTTP error: ${error?.message || 'Unknown error'}`);
    }
}

// Simple WebDAV client using fetch/Tauri HTTP
class SimpleWebDAVClient {
    constructor(
        private baseUrl: string,
        private headers: Record<string, string>
    ) {}

    /**
     * Check if a path exists
     */
    async exists(path: string): Promise<boolean> {
        try {
            const url = this.buildUrl(path);
            const response = await apiLimiter.schedule(() =>
                tauriFetch(url, {
                    method: 'HEAD',
                    headers: this.headers,
                })
            );
            return response.ok || response.status === 404;
        } catch (error) {
            console.error('[WebDAV] exists error:', error);
            return false;
        }
    }

    /**
     * Get file status
     */
    async stat(path: string): Promise<{
        size: number;
        lastmod: string;
        type: string;
    }> {
        const url = this.buildUrl(path);
        const response = await apiLimiter.schedule(() =>
            tauriFetch(url, {
                method: 'HEAD',
                headers: this.headers,
            })
        );

        const size = response.headers.get('content-length');
        const lastmod = response.headers.get('last-modified');

        return {
            size: size ? parseInt(size, 10) : 0,
            lastmod: lastmod || '',
            type: 'file'
        };
    }

    /**
     * Get file contents
     */
    async getFileContents(path: string, options?: { format?: 'text' | 'binary' }): Promise<string | ArrayBuffer> {
        const url = this.buildUrl(path);
        const response = await apiLimiter.schedule(() =>
            tauriFetch(url, {
                method: 'GET',
                headers: this.headers,
            })
        );

        if (!response.ok) {
            throw new Error(`GET failed: ${response.status} ${response.statusText}`);
        }

        return options?.format === 'text' ? await response.text() : await response.arrayBuffer();
    }

    /**
     * Put file contents
     */
    async putFileContents(path: string, content: string, options?: { overwrite?: boolean; contentLength?: number }): Promise<void> {
        const url = this.buildUrl(path);
        const response = await apiLimiter.schedule(() =>
            tauriFetch(url, {
                method: 'PUT',
                headers: {
                    ...this.headers,
                    'Content-Type': 'application/json',
                    'Content-Length': String(content.length),
                },
                body: content,
            })
        );

        if (!response.ok) {
            throw new Error(`PUT failed: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * Create directory
     */
    async createDirectory(path: string, options?: { recursive?: boolean }): Promise<void> {
        const url = this.buildUrl(path);
        const response = await apiLimiter.schedule(() =>
            tauriFetch(url, {
                method: 'MKCOL',
                headers: this.headers,
            })
        );

        if (response.status === 405) {
            // Method not allowed - directory might already exist
            return;
        }

        if (!response.ok && response.status !== 201) {
            throw new Error(`MKCOL failed: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * Delete file
     */
    async deleteFile(path: string): Promise<void> {
        const url = this.buildUrl(path);
        const response = await apiLimiter.schedule(() =>
            tauriFetch(url, {
                method: 'DELETE',
                headers: this.headers,
            })
        );

        if (!response.ok) {
            throw new Error(`DELETE failed: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * Build full URL for a path
     */
    private buildUrl(path: string): string {
        let url = this.baseUrl.trim();
        if (!url.endsWith('/')) url += '/';

        if (path && path !== '/') {
            const cleanPath = path.replace(/^\/+|\/+$/g, '');
            if (cleanPath.length > 0) {
                url += cleanPath;
            }
        }

        return url;
    }
}

/**
 * WebDAV Service
 * Fully inspired by obsidian-nutstore-sync implementation
 * Supports Web, Electron, and Tauri (Android) environments
 */
export class WebDAVService {
    private client: SimpleWebDAVClient | null = null;

    /**
     * Create WebDAV client
     */
    private createWebDAVClient(config: WebDavConfig): SimpleWebDAVClient {
        if (this.client) {
            return this.client;
        }

        const baseUrl = config.url.trim();
        const auth = btoa(unescape(encodeURIComponent(`${config.user}:${config.pass}`)));

        const headers = {
            'Authorization': `Basic ${auth}`,
        };

        this.client = new SimpleWebDAVClient(baseUrl, headers);
        return this.client;
    }

    /**
     * Check if WebDAV connection is working
     */
    async checkConnection(config: WebDavConfig): Promise<{ success: boolean; error?: string }> {
        try {
            const client = this.createWebDAVClient(config);
            console.log('[WebDAV] Testing connection...');

            // Check if root exists
            const exists = await client.exists('/');

            console.log('[WebDAV] Connection successful');
            return { success: true };
        } catch (error: any) {
            console.error('[WebDAV] Connection failed:', error);

            // Provide user-friendly error messages
            if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
                return {
                    success: false,
                    error: 'Authentication failed. Check your username and password.'
                };
            }
            if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
                return {
                    success: false,
                    error: 'Access denied. Check if WebDAV is enabled on your account.'
                };
            }
            if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
                return {
                    success: false,
                    error: 'Connection refused. Check if server URL is correct.'
                };
            }
            if (error.message?.includes('ENOTFOUND') || error.code === 'ENOTFOUND') {
                return {
                    success: false,
                    error: 'Server not found. Check if server URL is correct.'
                };
            }
            if (error.message?.includes('Tauri HTTP error')) {
                return {
                    success: false,
                    error: 'Network error. Please check your connection.'
                };
            }

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
            const client = this.createWebDAVClient(config);
            console.log('[WebDAV] Uploading file:', remotePath);

            // Convert content to string if it's a Blob
            let fileContent: string;
            if (typeof content === 'string') {
                fileContent = content;
            } else {
                fileContent = await content.text();
            }

            await client.putFileContents(remotePath, fileContent, {
                overwrite: true,
                contentLength: fileContent.length,
            });

            console.log('[WebDAV] Upload successful');
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
            const client = this.createWebDAVClient(config);
            console.log('[WebDAV] Downloading file:', remotePath);

            const content = await client.getFileContents(remotePath, { format: 'text' });

            console.log('[WebDAV] Download successful');
            return content as string;
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
            const client = this.createWebDAVClient(config);
            const stat = await client.stat(path);

            return {
                exists: true,
                size: stat.size,
                lastModified: stat.lastmod ? new Date(stat.lastmod) : undefined
            };
        } catch (error: any) {
            if (error.message?.includes('404') || error.message?.includes('Not Found')) {
                return { exists: false };
            }
            throw error;
        }
    }

    /**
     * Check if directory exists, create if not
     */
    async ensureDirectory(config: WebDavConfig, path: string): Promise<void> {
        try {
            const client = this.createWebDAVClient(config);
            const exists = await client.exists(path);

            if (!exists) {
                console.log('[WebDAV] Creating directory:', path);
                await client.createDirectory(path, { recursive: true });
            }
        } catch (error) {
            console.error('[WebDAV] Failed to ensure directory:', error);
            throw error;
        }
    }

    /**
     * Delete a file or directory
     */
    async deleteFile(config: WebDavConfig, path: string): Promise<void> {
        try {
            const client = this.createWebDAVClient(config);
            await client.deleteFile(path);
            console.log('[WebDAV] Deleted:', path);
        } catch (error) {
            console.error('[WebDAV] Failed to delete:', error);
            throw error;
        }
    }

    /**
     * Disconnect client
     */
    disconnect(): void {
        this.client = null;
    }
}

// Singleton instance
export const webdavService = new WebDAVService();

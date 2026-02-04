import { AppState, TimeBlock, Goal } from '../types';
import { recalculateGoals } from '../utils';
import { webdavService } from './webdavService';

const SYNC_FILENAME = 'lifesync_data.json';

export interface SyncResult {
    state: AppState;
    changes: number;
}

export class SyncService {

    /**
     * Build file URL with target folder
     */
    private getFileUrl(baseUrl: string, folder: string): string {
        let url = baseUrl.trim();
        if (!url.endsWith('/')) url += '/';

        if (folder) {
            let cleanFolder = folder.trim();
            cleanFolder = cleanFolder.replace(/^\/+|\/+$/g, '');
            if (cleanFolder.length > 0) {
                url += cleanFolder + '/';
            }
        }

        return url + SYNC_FILENAME;
    }

    /**
     * Get user-friendly sync error message
     */
    private getSyncErrorMessage(error: any, context: string): string {
        const msg = error?.message || String(error);

        // CORS/Proxy errors in web mode
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('520')) {
            return '网络请求被阻止，请检查CORS代理设置或使用桌面客户端';
        }

        // Authentication errors
        if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
            return '认证失败，请检查用户名和密码';
        }

        // Not found errors
        if (msg.includes('404') || msg.includes('Not Found')) {
            return `${context}: 远程文件不存在`;
        }

        // Connection errors
        if (msg.includes('ECONNREFUSED') || msg.includes('Connection refused')) {
            return '连接被拒绝，请检查服务器地址';
        }

        // Timeout errors
        if (msg.includes('ETIMEDOUT') || msg.includes('Timeout')) {
            return '连接超时，请检查网络或服务器状态';
        }

        // Generic error
        return `${context}: ${msg}`;
    }

    /**
     * TEST CONNECTION
     * Uses webdavService.checkConnection for testing
     */
    public async testConnection(config: AppState['webDavConfig']): Promise<{ success: boolean; message?: string }> {
        if (!config.url || !config.user || !config.pass) {
            return { success: false, message: 'Missing credentials' };
        }

        try {
            const result = await webdavService.checkConnection(config);
            if (result.success) {
                return { success: true, message: 'Connected successfully' };
            } else {
                return { success: false, message: result.error || 'Connection failed' };
            }
        } catch (e: any) {
            return { success: false, message: this.getSyncErrorMessage(e, 'Connection test') };
        }
    }

    /**
     * SYNC TO CLOUD
     * Downloads, merges, and uploads state to WebDAV
     */
    public async syncToCloud(currentState: AppState): Promise<SyncResult> {
        const { webDavConfig } = currentState;

        if (!webDavConfig.enabled || !webDavConfig.url) {
            throw new Error('WebDAV not enabled');
        }

        const fileUrl = this.getFileUrl(webDavConfig.url, webDavConfig.targetFolder || '');

        console.log('[Sync] Syncing to:', fileUrl);

        let remoteState: AppState | null = null;

        // 1. Download remote state
        try {
            console.log('[Sync] Downloading remote state...');
            const content = await webdavService.downloadFile(webDavConfig, SYNC_FILENAME);
            remoteState = JSON.parse(content);
            console.log('[Sync] Remote state loaded');
        } catch (e) {
            // If downloading fails (404 or other errors), assume no remote file yet
            console.log('[Sync] No remote file found or inaccessible:', e);
            remoteState = null;
        }

        // 2. Merge states
        const { state: mergedState, changes } = this.mergeStates(currentState, remoteState);

        // 3. Upload merged state
        try {
            console.log('[Sync] Uploading merged state...');
            await webdavService.uploadFile(webDavConfig, '', SYNC_FILENAME, JSON.stringify(mergedState));
            console.log('[Sync] Upload successful');
        } catch (e) {
            console.error('[Sync] Upload failed:', e);
            throw new Error(this.getSyncErrorMessage(e, 'Upload failed'));
        }

        return {
            state: {
                ...mergedState,
                lastSynced: Date.now()
            },
            changes
        };
    }

    /**
     * Merge local and remote states
     */
    private mergeStates(local: AppState, remote: AppState | null): { state: AppState, changes: number } {
        if (!remote || !remote.tasks) {
            return { state: local, changes: 0 };
        }

        let changeCount = 0;

        const mergeArrays = <T extends { id: string; updatedAt?: number }>(localArr: T[], remoteArr: T[]): T[] => {
            const map = new Map<string, T>();
            (localArr || []).forEach(item => map.set(item.id, item));
            (remoteArr || []).forEach(remoteItem => {
                if (!remoteItem?.id) return;
                const localItem = map.get(remoteItem.id);
                if (!localItem || (remoteItem.updatedAt || 0) > (localItem.updatedAt || 0)) {
                    map.set(remoteItem.id, remoteItem);
                    changeCount++;
                }
            });
            return Array.from(map.values());
        };

        const mergedTasks = mergeArrays(local.tasks || [], remote.tasks || []);
        const mergedGoalsRaw = mergeArrays(local.goals || [], remote.goals || []);
        const mergedTemplates = mergeArrays(local.templates || [], remote.templates || []);
        const finalGoals = recalculateGoals(mergedGoalsRaw, mergedTasks);

        return {
            state: {
                ...local,
                tasks: mergedTasks,
                goals: finalGoals,
                templates: mergedTemplates,
            },
            changes: changeCount
        };
    }
}

export const syncService = new SyncService();

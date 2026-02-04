
import { AppState, TimeBlock, Goal } from '../types';
import { recalculateGoals, getPlatform, buildAuthHeader, t } from '../utils';
import { webdavService } from './webdavService';

const SYNC_FILENAME = 'lifesync_data.json';
const REQUEST_TIMEOUT = 15000;

// Nutstore (Jianguoyun) WebDAV endpoints
export const NUTSTORE_DAV_ENDPOINT = 'https://dav.jianguoyun.com/dav';

interface ProxyResponse {
    ok: boolean;
    status: number;
    statusText: string;
    text: string;
    headers: Record<string, string>;
}

export interface SyncResult {
    state: AppState;
    changes: number;
}

export class SyncService {
  private lang: string = 'en';

  setLanguage(lang: string): void {
    this.lang = lang;
  }

  private getFileUrl(baseUrl: string, folder: string): string {
    let url = baseUrl.trim();
    // Ensure URL has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    if (!url.endsWith('/')) url += '/';

    if (folder) {
        let cleanFolder = folder.trim();
        cleanFolder = cleanFolder.replace(/^\/+|\/+$/g, '');
        if (cleanFolder.length > 0) url += cleanFolder + '/';
    }

    return url + SYNC_FILENAME;
  }

  private async fetchAdapter(
      method: string,
      url: string,
      headers: Record<string, string>,
      body: string | null,
      config: AppState['webDavConfig']
  ): Promise<{ ok: boolean, status: number, statusText?: string, text: string }> {

      const platform = getPlatform();

      if (platform === 'electron') {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI?.webdavRequest) {
              const res = await electronAPI.webdavRequest(url, { method, headers, body }) as ProxyResponse;
              return { ok: res.ok, status: res.status, statusText: res.statusText, text: res.text };
          }
      }

      if (platform === 'tauri') {
          try {
              // Tauri 2.x HTTP plugin API
              const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
              const response = await tauriFetch(url, {
                  method: method as any,
                  headers: headers,
                  body: body,
              });
              const text = await response.text();
              return { ok: response.ok, status: response.status, statusText: response.statusText || '', text };
          } catch (e: any) {
              console.error('Tauri HTTP Error:', e);
              // Fall through to native fetch if Tauri HTTP fails
          }
      }

      let finalUrl = url;
      if (platform === 'web' && config.corsProxy) {
          const proxy = config.corsProxy.trim();
          if (proxy.includes('thingproxy')) finalUrl = proxy + url;
          else if (proxy.endsWith('=')) finalUrl = proxy + encodeURIComponent(url);
          else finalUrl = proxy + url;
      }

      try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
          const res = await fetch(finalUrl, { method, headers, body, signal: controller.signal });
          clearTimeout(id);
          const text = await res.text();
          return { ok: res.ok, status: res.status, text };
      } catch (e: any) {
          if (e.name === 'AbortError') throw new Error(`Timed out after ${REQUEST_TIMEOUT/1000}s`);
          throw e;
      }
  }

  public async testConnection(config: AppState['webDavConfig'], lang: string = 'en'): Promise<{ success: boolean; message?: string }> {
      // Validate configuration before attempting connection
      if (!config.url || !config.url.trim()) {
          return { success: false, message: t('urlRequired', lang) };
      }
      if (!config.user || !config.user.trim()) {
          return { success: false, message: t('usernameNotConfigured', lang) };
      }
      if (!config.pass || !config.pass.trim()) {
          return { success: false, message: t('passwordNotConfigured', lang) };
      }

      // Use webdavService for better connection testing
      try {
          const result = await webdavService.checkConnection(config, lang);
          if (result.success) {
              return { success: true, message: t('connSuccess', lang) };
          } else {
              return { success: false, message: result.error || t('connFailed', lang) };
          }
      } catch (e: any) {
          return { success: false, message: e.message || t('connFailed', lang) };
      }
  }

  public async syncToCloud(currentState: AppState, lang: string = 'en'): Promise<SyncResult> {
      if (!currentState) {
          throw new Error(t('stateRequiredForSync', lang));
      }
      const { webDavConfig } = currentState;

      // Validate configuration
      if (!webDavConfig.enabled) {
          throw new Error(t('syncNotEnabled', lang));
      }
      if (!webDavConfig.url || !webDavConfig.url.trim()) {
          throw new Error(t('urlNotConfigured', lang));
      }
      if (!webDavConfig.user || !webDavConfig.user.trim()) {
          throw new Error(t('usernameNotConfigured', lang));
      }
      if (!webDavConfig.pass || !webDavConfig.pass.trim()) {
          throw new Error(t('passwordNotConfigured', lang));
      }

      const fileUrl = this.getFileUrl(webDavConfig.url, webDavConfig.targetFolder || '');
      const authHeader = buildAuthHeader(webDavConfig.user, webDavConfig.pass);
      const headers = { 'Authorization': authHeader, 'Content-Type': 'application/json' };

      let remoteState: AppState | null = null;
      try {
          const response = await this.fetchAdapter('GET', fileUrl, headers, null, webDavConfig);
          if (response.ok && response.text) {
              try {
                  remoteState = JSON.parse(response.text);
              } catch (e: any) {
                  // Log parse error but don't fail - we'll just use local state
                  console.warn('Failed to parse remote state, using local state:', e);
              }
          } else if (response.status === 401) {
              throw new Error(t('authFailedInvalidCredentials', lang));
          } else if (response.status === 404) {
              // File doesn't exist yet, that's ok
              console.log('Remote file not found, will create new file');
          }
      } catch (e: any) {
          // Check if this is a 404/not found error by looking at status or message
          const isNotFoundError =
              (typeof e.status === 'number' && e.status === 404) ||
              (typeof e.code === 'number' && e.code === 404) ||
              (e.message && (e.message.includes('404') || e.message.toLowerCase().includes('not found')));

          if (!isNotFoundError) {
              throw e;
          }
          // Otherwise, continue with local state only
          console.warn('Failed to fetch remote state, using local state:', e);
      }

      const { state: mergedState, changes } = this.mergeStates(currentState, remoteState);

      // Create sync-safe state (exclude sensitive config credentials from cloud upload)
      const syncSafeState = {
          ...mergedState,
          webDavConfig: { enabled: mergedState.webDavConfig?.enabled ?? false }, // Only sync enabled flag, not credentials
          deviceMonitorConfig: undefined, // Don't sync device-specific config
      };

      const uploadRes = await this.fetchAdapter('PUT', fileUrl, headers, JSON.stringify(syncSafeState), webDavConfig);
      if (!uploadRes.ok) {
          if (uploadRes.status === 401) {
              throw new Error(t('authFailedInvalidCredentials', lang));
          } else if (uploadRes.status === 403) {
              throw new Error(t('permissionDenied', lang));
          } else if (uploadRes.status === 404) {
              throw new Error(t('remoteFolderNotFound', lang));
          } else {
              const statusText = uploadRes.statusText || 'Unknown error';
              throw new Error(t('uploadFailed', lang).replace('{status}', String(uploadRes.status)).replace('{statusText}', statusText));
          }
      }

      return { state: { ...mergedState, lastSynced: Date.now() }, changes };
  }

  private mergeStates(local: AppState, remote: AppState | null): { state: AppState, changes: number } {
      if (!remote || !remote.tasks) return { state: local, changes: 0 };
      let changeCount = 0;
      const mergeArrays = <T extends { id: string; updatedAt?: number }>(localArr: T[], remoteArr: T[]): T[] => {
          const map = new Map<string, T>();
          (localArr || []).forEach(item => map.set(item.id, item));
          (remoteArr || []).forEach(remoteItem => {
              if(!remoteItem?.id) return;
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

      // Track additional changes from recalculateGoals (goal progress updates)
      const localGoalsMap = new Map((local.goals || []).map(g => [g.id, g]));
      finalGoals.forEach(finalGoal => {
          const localGoal = localGoalsMap.get(finalGoal.id);
          if (localGoal) {
              // Compare progress that might have changed due to merged tasks
              if (localGoal.completedUnits !== finalGoal.completedUnits) {
                  // Count as change only if it differs from what was merged from remote
                  const remoteGoal = (remote.goals || []).find(g => g.id === finalGoal.id);
                  const remoteCompletedUnits = remoteGoal?.completedUnits || 0;
                  if (finalGoal.completedUnits !== remoteCompletedUnits) {
                      changeCount++;
                  }
              }
          }
      });

      return {
          state: {
              ...local,
              tasks: mergedTasks,
              goals: finalGoals,
              templates: mergedTemplates,
              // Explicitly preserve local config - don't let remote overwrite these
              webDavConfig: local.webDavConfig,
              deviceMonitorConfig: local.deviceMonitorConfig,
          },
          changes: changeCount
      };
  }
}

export const syncService = new SyncService();

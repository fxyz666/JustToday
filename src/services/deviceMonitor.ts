
import { TimeBlock, TaskType, TaskStatus } from '../types';
import { generateId, getTodayDateString } from '../utils';

// Enhanced Interface for Electron Preload Script
interface ActiveWindowResult {
  title: string;
  owner: { 
    name: string; 
    bundleId?: string; 
    path?: string; 
    processId?: number; 
  };
  url?: string; 
  memoryUsage?: number;
  isIdle?: boolean;
}

interface ElectronAPI {
  getActiveWindow: () => Promise<ActiveWindowResult | undefined>;
  getSystemProcesses?: () => Promise<any[]>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

export type MonitorMode = 'ELECTRON' | 'MOBILE_BRIDGE' | 'WEB_ONLY' | 'SIMULATION' | 'LOCAL_SERVER';

interface SessionData {
  appName: string;
  details: string;
  metadata?: {
    url?: string;
    pid?: number;
    path?: string;
    isBackground?: boolean;
  };
  startTime: number;
  lastUpdate: number;
}

class DeviceMonitor {
  private currentSession: SessionData | null = null;
  private memoryLogs: TimeBlock[] = []; // In-memory cache
  private hasLoadedFromStorage: boolean = false;
  
  private deviceId: string;
  private logsKey = 'lifesync_device_logs';
  private timer: number | null = null;
  private isSimulationEnabled: boolean = false; 
  private localServerUrl: string = 'http://localhost:3001';
  
  // Status
  public currentMode: MonitorMode = 'WEB_ONLY';
  public isConnected: boolean = false;

  constructor() {
    this.deviceId = localStorage.getItem('lifesync_device_id') || generateId();
    if(typeof localStorage !== 'undefined') {
        localStorage.setItem('lifesync_device_id', this.deviceId);
        this.loadLogsFromStorage(); // Load once on init
        this.detectMode();
    }
  }

  private loadLogsFromStorage() {
    try {
        const data = localStorage.getItem(this.logsKey);
        this.memoryLogs = data ? JSON.parse(data) : [];
        this.hasLoadedFromStorage = true;
    } catch {
        this.memoryLogs = [];
    }
  }

  public setLocalServerUrl(url: string) {
      this.localServerUrl = url;
      // If user sets a local URL, try to switch mode
      if (url && this.currentMode === 'WEB_ONLY') {
          this.currentMode = 'LOCAL_SERVER';
      }
  }

  private detectMode() {
    if (typeof window !== 'undefined' && window.electronAPI) {
        this.currentMode = 'ELECTRON';
        this.isConnected = true;
    } else if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        this.currentMode = 'MOBILE_BRIDGE';
        this.isConnected = true;
    } else {
        // Default to web, but check if we might want local server
        this.currentMode = 'WEB_ONLY'; // Will upgrade to LOCAL_SERVER if fetch works
        this.isConnected = false;
    }
    // console.log(`[DeviceMonitor] Mode detected: ${this.currentMode}`);
  }

  public setSimulationEnabled(enabled: boolean) {
      this.isSimulationEnabled = enabled;
      
      // State transition logic
      if (enabled) {
          this.currentMode = 'SIMULATION';
      } else {
          // Re-detect if we disable simulation
          this.detectMode();
          if (this.currentMode === 'WEB_ONLY' && this.localServerUrl) {
               this.currentMode = 'LOCAL_SERVER';
          }
      }
      this.restart();
  }

  private restart() {
      if (this.timer) window.clearInterval(this.timer);
      this.timer = window.setInterval(() => this.tick(), 2000); 
  }

  // Called by App.tsx main loop
  public async tick() {
      switch (this.currentMode) {
          case 'ELECTRON':
              await this.tickElectron();
              break;
          case 'LOCAL_SERVER':
              await this.tickLocalServer();
              break;
          case 'SIMULATION':
              this.tickSimulation();
              break;
          case 'WEB_ONLY':
              this.tickWeb();
              break;
          case 'MOBILE_BRIDGE':
              this.checkSessionTimeout();
              break;
      }
  }

  // --- 0. Local Server Agent (Python/Node Bridge) ---
  // Expects GET /activity returning { app: "Chrome", title: "GitHub", idle: false }
  private async tickLocalServer() {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          
          const res = await fetch(`${this.localServerUrl}/activity`, { 
              signal: controller.signal,
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
          });
          clearTimeout(timeoutId);

          if (res.ok) {
              const data = await res.json();
              this.isConnected = true;
              
              if (data.idle) {
                  this.handleIdle();
              } else {
                  this.handleActivityUpdate(
                      data.app || 'Unknown', 
                      data.title || 'No Title', 
                      { url: data.url, pid: data.pid }
                  );
              }
          } else {
              this.isConnected = false;
              if(this.isSimulationEnabled) this.tickSimulation(); // Fallback to sim if local server down
          }
      } catch (e) {
          this.isConnected = false;
          if(this.isSimulationEnabled) this.tickSimulation();
      }
  }

  // --- 1. Real Desktop Tracking (Electron) ---
  private async tickElectron() {
      try {
          if (!window.electronAPI) return;

          const win = await window.electronAPI.getActiveWindow();
          
          if (win) {
              if (win.isIdle) {
                 this.handleIdle();
                 return;
              }

              let appName = win.owner?.name || 'Unknown';
              // Normalize common names
              if (appName === 'Code') appName = 'VSCode';
              if (appName === 'winword') appName = 'Word';
              if (appName === 'chrome') appName = 'Chrome';
              
              const metadata = {
                 url: win.url,
                 pid: win.owner?.processId,
                 path: win.owner?.path,
                 isBackground: false
              };

              this.handleActivityUpdate(appName, win.title, metadata);
          } else {
              this.handleIdle();
          }
      } catch (e) {
          console.warn('Failed to communicate with Electron:', e);
          this.isConnected = false;
      }
  }

  // --- 2. Web Tab Tracking ---
  private tickWeb() {
      // In pure web mode without server, we only track if the tab is active
      if (document.hidden) {
          this.handleIdle();
      } else {
          // Limited capability: just tracks "LifeSync" usage
          this.handleActivityUpdate('LifeSync Web', document.title, { url: window.location.href });
      }
  }

  // --- 3. Simulation ---
  private simIndex = 0;
  private simStep = 0;
  private tickSimulation() {
      this.simStep++;
      if (this.simStep > 10) { // Change activity every 20 seconds (10 ticks * 2s)
          this.simStep = 0;
          this.simIndex = (this.simIndex + 1) % 4;
      }

      const simulatedApps = [
        { name: 'VSCode', detail: 'Project / src / main.ts', meta: { pid: 1001 } },
        { name: 'Chrome', detail: 'StackOverflow - React Hooks', meta: { url: 'https://stackoverflow.com...' } },
        { name: 'Slack', detail: 'Team Discussion', meta: { pid: 2045 } },
        { name: 'Terminal', detail: 'npm run dev', meta: { pid: 8872 } }
      ];
      
      const app = simulatedApps[this.simIndex];
      this.handleActivityUpdate(app.name, app.detail, app.meta);
  }

  // --- Core Processing Logic ---

  private handleActivityUpdate(appName: string, details: string, metadata?: any) {
      const now = Date.now();

      if (this.currentSession) {
          // If app changed OR detail changed significantly
          if (this.currentSession.appName !== appName || this.currentSession.details !== details) {
              this.flushSession(now);
              this.startSession(appName, details, metadata, now);
          } else {
              this.currentSession.lastUpdate = now;
              // Update metadata if new info arrived
              if (metadata) {
                  this.currentSession.metadata = { ...this.currentSession.metadata, ...metadata };
              }
          }
      } else {
          this.startSession(appName, details, metadata, now);
      }
  }

  private handleIdle() {
      if (this.currentSession) {
          const now = Date.now();
          this.flushSession(now);
      }
  }

  private checkSessionTimeout() {
      if (this.currentSession) {
          const now = Date.now();
          if (now - this.currentSession.lastUpdate > 30000) {
              this.flushSession(now);
          }
      }
  }

  private startSession(appName: string, details: string, metadata: any, now: number) {
      this.currentSession = {
          appName,
          details,
          metadata,
          startTime: now,
          lastUpdate: now
      };
  }

  private flushSession(endTime: number) {
      if (!this.currentSession) return;

      const durationMs = endTime - this.currentSession.startTime;
      const durationMinutes = Math.round(durationMs / 1000 / 60);

      // Filter noise < 1 min (optional, maybe keep it granular)
      if (durationMinutes >= 1) {
          const startTimeObj = new Date(this.currentSession.startTime);
          const startMinutes = startTimeObj.getHours() * 60 + startTimeObj.getMinutes();
          
          let desc = this.currentSession.details;
          // Clean up huge URLs
          if (this.currentSession.metadata?.url) {
              try {
                  const urlObj = new URL(this.currentSession.metadata.url);
                  desc += `\n${urlObj.hostname}${urlObj.pathname !== '/' ? urlObj.pathname : ''}`;
              } catch {
                  desc += `\n${this.currentSession.metadata.url.substring(0, 50)}...`;
              }
          }

          const newLog: TimeBlock = {
              id: `log_${this.currentSession.startTime}_${this.currentSession.appName.replace(/\s/g, '')}`,
              title: `${this.currentSession.appName} - ${this.currentSession.details}`,
              description: desc,
              date: getTodayDateString(),
              startTime: startMinutes,
              duration: durationMinutes,
              type: TaskType.DEVICE_LOG,
              status: TaskStatus.COMPLETED,
              deviceSource: this.getDeviceSource(),
              color: this.getAppColor(this.currentSession.appName),
              createdAt: Date.now()
          };
          
          this.saveLogToStorage(newLog);
      }

      this.currentSession = null;
  }

  private getDeviceSource(): 'desktop' | 'mobile' | 'tablet' {
      if (this.currentMode === 'MOBILE_BRIDGE') return 'mobile';
      if (this.currentMode === 'WEB_ONLY' || this.currentMode === 'LOCAL_SERVER' || this.currentMode === 'ELECTRON') return 'desktop';
      return 'desktop';
  }

  private saveLogToStorage(newLog: TimeBlock) {
    // 1. Update In-Memory
    const lastLogIndex = this.memoryLogs.length - 1;
    const lastLog = this.memoryLogs[lastLogIndex];
    
    // Merge if: Same App, Same Date, Same Title, and Adjoining time
    // This reduces fragmentation significantly in real-world usage
    if (lastLog && 
        lastLog.title === newLog.title && 
        lastLog.date === newLog.date) {
        
        const lastEnd = lastLog.startTime + lastLog.duration;
        const gap = newLog.startTime - lastEnd;

        // Allow small gap or overlap (up to 5 mins)
        if (Math.abs(gap) <= 5) {
            lastLog.duration = (newLog.startTime + newLog.duration) - lastLog.startTime;
            lastLog.description = newLog.description; // Update description to latest
            lastLog.updatedAt = Date.now();
            // No need to push, just mutated the object in array
        } else {
            this.memoryLogs.push(newLog);
        }
    } else {
        this.memoryLogs.push(newLog);
    }

    // 2. Persist
    localStorage.setItem(this.logsKey, JSON.stringify(this.memoryLogs));
  }

  private getAppColor(appName: string): string {
    const name = appName.toLowerCase();
    if (name.includes('code') || name.includes('dev') || name.includes('term')) return '#007acc'; // Blue for dev
    if (name.includes('chrome') || name.includes('edge') || name.includes('safari')) return '#eab308'; // Yellow for web
    if (name.includes('chat') || name.includes('slack') || name.includes('discord') || name.includes('wechat')) return '#10b981'; // Green for comms
    if (name.includes('music') || name.includes('spotify')) return '#1db954'; 
    if (name.includes('game') || name.includes('steam')) return '#ec4899'; // Pink for games
    if (name.includes('video') || name.includes('youtube') || name.includes('netflix')) return '#ef4444'; // Red for media
    if (name.includes('word') || name.includes('docs')) return '#2b579a';
    if (name.includes('excel') || name.includes('sheets')) return '#217346';
    return '#8b5cf6'; // Default Purple
  }

  // O(1) Access
  public getAllDeviceLogs(): TimeBlock[] {
    if(!this.hasLoadedFromStorage) this.loadLogsFromStorage();
    return this.memoryLogs;
  }

  /**
   * Retrieves logs specific to a date.
   * This is used by SyncService to pull real history.
   */
  public getLogsByDate(date: string): TimeBlock[] {
      if(!this.hasLoadedFromStorage) this.loadLogsFromStorage();
      return this.memoryLogs.filter(log => log.date === date);
  }
}

export const deviceMonitor = new DeviceMonitor();

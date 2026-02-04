
const { app, BrowserWindow, ipcMain, powerMonitor, shell } = require('electron');
const path = require('path');

// Helper to dynamically import active-win (since it's an ESM module)
const getActiveWindow = async () => {
  try {
    const { default: activeWin } = await import('active-win');
    return await activeWin();
  } catch (error) {
    console.error('Error importing or executing active-win:', error);
    return undefined;
  }
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Mac-like style
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true, // Secure context
      sandbox: false // Required for some system APIs
    },
  });

  // Load the React app
  // In Dev: Load localhost
  // In Prod: Load index.html
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
  mainWindow.loadURL(startUrl);

  // Open external links in browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // IPC Handler: Get Active Window & Idle State
  ipcMain.handle('get-active-window', async () => {
    try {
      const windowData = await getActiveWindow();
      
      // Get system idle time in seconds
      const idleSeconds = powerMonitor.getSystemIdleTime();
      const isIdle = idleSeconds > 60; // Mark as idle if > 1 minute no activity

      if (!windowData) return { isIdle };

      return {
        ...windowData,
        isIdle
      };
    } catch (error) {
      console.error('IPC get-active-window error:', error);
      return undefined;
    }
  });

  // IPC Handler: Get System Processes (Stub for future use with 'ps-list')
  ipcMain.handle('get-system-processes', async () => {
    return [];
  });

  // IPC Handler: WebDAV Request Proxy (Bypasses CORS)
  ipcMain.handle('webdav-request', async (event, url, options) => {
    try {
      // Use Node's native fetch (Node 18+)
      const response = await fetch(url, options);
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      console.error('WebDAV Request Proxy Error:', error);
      return {
        ok: false,
        status: 0,
        statusText: error.message || 'Network Error',
        text: '',
        headers: {}
      };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

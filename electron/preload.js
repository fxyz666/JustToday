
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),
  getSystemProcesses: () => ipcRenderer.invoke('get-system-processes'),
  webdavRequest: (url, options) => ipcRenderer.invoke('webdav-request', url, options),
});

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  sd: {
    status: () => ipcRenderer.invoke('sd:status'),
    start: () => ipcRenderer.invoke('sd:start'),
    stop: () => ipcRenderer.invoke('sd:stop'),
    getAutostart: () => ipcRenderer.invoke('sd:get-autostart'),
    setAutostart: (enabled) => ipcRenderer.invoke('sd:set-autostart', enabled),
  },
  log: {
    read: () => ipcRenderer.invoke('log:read'),
    clear: () => ipcRenderer.invoke('log:clear'),
  },
})

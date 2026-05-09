'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, narrow API to the renderer (React app).
// The renderer calls window.mfiles.* — never touches Node directly.
contextBridge.exposeInMainWorld('mfiles', {
  listVaults:   ()     => ipcRenderer.invoke('mfiles:list-vaults'),
  pushWorkflow: (json) => ipcRenderer.invoke('mfiles:push', json),
  // Subscribe to streaming progress messages from the main process
  onProgress: (cb) => ipcRenderer.on('mfiles:progress', (_e, msg) => cb(msg)),
});

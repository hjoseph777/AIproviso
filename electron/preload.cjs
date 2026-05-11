'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mfiles', {
  // payload: { vaultGuid, server, authType, username, password }
  listVaults:   (payload)  => ipcRenderer.invoke('mfiles:list-vaults', payload),
  // payload: { json, vaultGuid, server, authType, username, password }
  pushWorkflow: (payload)  => ipcRenderer.invoke('mfiles:push', payload),
  // Subscribe to streaming progress — wrapper strips IPC event arg so cb receives message string directly
  onProgress:   (cb)       => ipcRenderer.on('mfiles:progress', (_e, msg) => cb(msg)),
  // Unsubscribe — NOTE: removeListener needs the exact wrapper reference; use ipcRenderer.removeAllListeners if needed
  offProgress:  ()         => ipcRenderer.removeAllListeners('mfiles:progress'),
});

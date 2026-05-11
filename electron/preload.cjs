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

contextBridge.exposeInMainWorld('sow', {
  // Calls Anthropic API from Node main process (no CORS, key stays in main)
  // payload: { apiKey, model, systemPrompt, text }
  // returns: { ok, json } | { ok: false, error }
  claudeExtract: (payload) => ipcRenderer.invoke('sow:claude-extract', payload),
  // Calls Cacoo REST API (with key) or localhost:5000 proxy (without key)
  // payload: { diagramId, apiKey }
  // returns: { ok, raw } | { ok: false, error }
  cacooFetch:    (payload) => ipcRenderer.invoke('sow:cacoo-fetch', payload),
});

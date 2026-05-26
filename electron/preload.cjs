'use strict';
const { contextBridge, ipcRenderer } = require('electron');

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
contextBridge.exposeInMainWorld('file', {
  // Opens OS Save-As dialog and writes the file
  // payload: { content, defaultName, filters }
  // returns: { ok, filePath } | { ok: false, cancelled: true }
  save: (payload) => ipcRenderer.invoke('file:save', payload),
});

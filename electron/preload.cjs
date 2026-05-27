'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sow', {
  // Calls Anthropic API from Node main process (no CORS, key stays in main)
  // payload: { apiKey, model, systemPrompt, text }
  // returns: { ok, json } | { ok: false, error }
  claudeExtract: (payload) => ipcRenderer.invoke('sow:claude-extract', payload),
});
contextBridge.exposeInMainWorld('file', {
  // Opens OS Save-As dialog and writes the file
  // payload: { content, defaultName, filters }
  // returns: { ok, filePath } | { ok: false, cancelled: true }
  save: (payload) => ipcRenderer.invoke('file:save', payload),
});

contextBridge.exposeInMainWorld('proviso', {
  openOriginalMockup: () => ipcRenderer.invoke('proviso:open-original-mockup'),
});

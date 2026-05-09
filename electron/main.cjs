'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const isDev  = !app.isPackaged;
const DEV_URL = 'http://localhost:3000';

// ── Window ───────────────────────────────────────────────────────
function createWindow () {
  const win = new BrowserWindow({
    width:     1440,
    height:    900,
    minWidth:  1100,
    minHeight: 700,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    title:           'Proviso — Workflow Ingestion',
    autoHideMenuBar: true,         // clean look, no browser-style menu bar
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    // DevTools detached so they don't crowd the app window
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC Handlers ─────────────────────────────────────────────────
// Phase III-B will replace these stubs with the real M-Files bridge.

ipcMain.handle('mfiles:list-vaults', async () => {
  // TODO Phase III-B: spawn PowerShell → enumerate MFiles vaults
  return { ok: false, message: 'M-Files bridge not yet configured.' };
});

ipcMain.handle('mfiles:push', async (_event, json) => {
  // TODO Phase III-B: spawn scripts/push-to-vault.ps1 with json payload
  return { ok: false, message: 'M-Files push bridge not yet configured.' };
});

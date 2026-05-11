'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn }     = require('child_process');
const { writeFile, unlink } = require('fs/promises');
const os   = require('os');

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
    autoHideMenuBar: true,
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Resolve script paths (dev vs packaged) ────────────────────────
function scriptPath (name) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'scripts', name)
    : path.join(__dirname, '../scripts', name);
}

// ── IPC: Connection test ──────────────────────────────────────────
// Uses MFilesServerApplication (server-side COM) so it works even
// while M-Files Desktop has an active client session on this vault.
// Script: scripts/test-connection.ps1
ipcMain.handle('mfiles:list-vaults', async (_event, payload) => {
  const {
    vaultGuid   = '{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}',
    server      = 'localhost',
    authType    = 'windows',
    username    = '',
    password    = '',
  } = payload || {};

  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File',          scriptPath('test-connection.ps1'),
      '-VaultGuid',     vaultGuid,
      '-ServerAddress', server,
      '-AuthType',      authType === 'mfiles' ? 'MFiles' : 'Windows',
      '-Username',      username,
      '-Password',      password,
    ]);

    let out = '';
    ps.stdout.on('data', d => { out += d.toString(); });
    ps.stderr.on('data', d => { out += d.toString(); });
    ps.on('close', code => {
      const ok        = code === 0 && out.includes('OK:');
      const vaultName = ok ? (out.match(/OK:(.+)/)?.[1]?.trim() || '') : '';
      const error     = ok ? '' : out.replace(/OK:[^\n]*/g, '').trim();
      resolve({ ok, vaultName, error });
    });
  });
});

// ── IPC: Push workflow to vault ───────────────────────────────────
// Writes workflow JSON to a temp file, then hands off to push-to-vault.ps1
// which uses MFilesServerApplication — no Desktop session conflict.
// Progress lines are streamed back to the renderer via mfiles:progress.
ipcMain.handle('mfiles:push', async (event, payload) => {
  const {
    json,
    vaultGuid   = '{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}',
    server      = 'localhost',
    authType    = 'windows',
    username    = '',
    password    = '',
    licenseType = 0,
  } = payload;

  const tmpFile = path.join(os.tmpdir(), `proviso-wf-${Date.now()}.json`);
  await writeFile(tmpFile, JSON.stringify(json, null, 2), 'utf8');

  const send = (line) => {
    const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed()) ;
    win?.webContents.send('mfiles:progress', line.trim());
  };

  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File',          scriptPath('push-to-vault.ps1'),
      '-JsonPath',      tmpFile,
      '-VaultGuid',     vaultGuid,
      '-ServerAddress', server,
      '-AuthType',      authType === 'mfiles' ? 'MFiles' : 'Windows',
      '-Username',      username,
      '-Password',      password,
      '-LicenseType',   String(licenseType),
    ]);

    ps.stdout.on('data', d =>
      d.toString().split('\n').filter(l => l.trim()).forEach(send)
    );
    ps.stderr.on('data', d => send(`[ERROR] ${d.toString().trim()}`));

    ps.on('close', async (code) => {
      await unlink(tmpFile).catch(() => {});
      resolve({ ok: code === 0, exitCode: code });
    });
  });
});

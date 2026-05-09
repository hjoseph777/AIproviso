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

// List M-Files vaults accessible on a server (quick PS query)
ipcMain.handle('mfiles:list-vaults', async (_event, serverAddress = 'localhost') => {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `$app = New-Object -ComObject MFilesAPI.MFilesClientApplication;
       $app.Connect('TCP','${serverAddress}',2266,$false);
       $app.GetOnlineVaults('${serverAddress}') | ForEach-Object { Write-Output $_.Name + '|' + $_.GUID }`
    ]);
    const vaults = [];
    ps.stdout.on('data', d => {
      d.toString().split('\n').filter(Boolean).forEach(line => {
        const [name, guid] = line.trim().split('|');
        if (name && guid) vaults.push({ name, guid });
      });
    });
    ps.on('close', code => resolve({ ok: code === 0, vaults }));
  });
});

// Push workflow JSON to M-Files vault via PowerShell COM bridge
ipcMain.handle('mfiles:push', async (event, payload) => {
  const { json, vaultGuid = '{08E9A947-7E05-4722-A890-559D36FDC8FF}', server = 'localhost' } = payload;

  // Write JSON to a temp file — PowerShell reads it from disk
  const tmpFile = path.join(os.tmpdir(), `proviso-wf-${Date.now()}.json`);
  await writeFile(tmpFile, JSON.stringify(json, null, 2), 'utf8');

  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'scripts', 'push-to-vault.ps1')
    : path.join(__dirname, '../scripts/push-to-vault.ps1');

  const win = BrowserWindow.getAllWindows()[0];
  const send = (line) => win?.webContents.send('mfiles:progress', line);

  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-JsonPath',     tmpFile,
      '-VaultGuid',    vaultGuid,
      '-ServerAddress', server,
    ]);

    ps.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(send));
    ps.stderr.on('data', d => send(`[ERROR] ${d.toString().trim()}`));

    ps.on('close', async (code) => {
      await unlink(tmpFile).catch(() => {});   // clean up temp file
      resolve({ ok: code === 0, exitCode: code });
    });
  });
});

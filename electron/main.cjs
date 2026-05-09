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

// Real connection test — tries GetVaultConnection + LogInAs/LogInAsUser
ipcMain.handle('mfiles:list-vaults', async (_event, payload) => {
  const { vaultGuid, authType = 'windows', username = '', password = '' } = payload || {};
  return new Promise((resolve) => {
    const authCmd = authType === 'mfiles'
      ? `$vault = $conn.LogInAsUser(2,'${username}','${password}',$null,$null); Write-Output "OK:$($vault.Name)"`
      : `$vault = $conn.LogInAs(0,0,$false); Write-Output "OK:$($vault.Name)"`;
    const cmd =
      `$app=$app = New-Object -ComObject MFilesAPI.MFilesClientApplication;` +
      `$conns=$app.GetVaultConnections();` +
      `$conn=$null; foreach($c in $conns){if($c.GetGUID() -ieq '${vaultGuid}'){$conn=$c;break}};` +
      `if(-not $conn){Write-Output 'ERR:VaultNotRegistered'; exit 1};` +
      authCmd;
    const ps = spawn('powershell.exe', ['-NoProfile','-NonInteractive','-Command', cmd]);
    let out = '';
    ps.stdout.on('data', d => { out += d.toString(); });
    ps.stderr.on('data', d => { out += d.toString(); });
    ps.on('close', code => {
      const ok = code === 0 && out.includes('OK:');
      const vaultName = ok ? out.match(/OK:(.+)/)?.[1]?.trim() : '';
      const error = ok ? '' : out.replace(/OK:[^\n]*/g,'').trim();
      resolve({ ok, vaultName, error });
    });
  });
});


// Push workflow JSON to M-Files vault via PowerShell COM bridge
ipcMain.handle('mfiles:push', async (event, payload) => {
  const {
    json, vaultGuid = '{08E9A947-7E05-4722-A890-559D36FDC8FF}',
    server = 'localhost', authType = 'windows', username = '', password = ''
  } = payload;

  const tmpFile = path.join(os.tmpdir(), `proviso-wf-${Date.now()}.json`);
  await writeFile(tmpFile, JSON.stringify(json, null, 2), 'utf8');

  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'scripts', 'push-to-vault.ps1')
    : path.join(__dirname, '../scripts/push-to-vault.ps1');

  const win = BrowserWindow.getAllWindows()[0];
  const send = (line) => win?.webContents.send('mfiles:progress', line.trim());

  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-JsonPath',     tmpFile,
      '-VaultGuid',    vaultGuid,
      '-ServerAddress', server,
      '-AuthType',     authType,
      '-Username',     username,
      '-Password',     password,
    ]);
    ps.stdout.on('data', d => d.toString().split('\n').filter(l => l.trim()).forEach(send));
    ps.stderr.on('data', d => send(`[ERROR] ${d.toString().trim()}`));
    ps.on('close', async (code) => {
      await unlink(tmpFile).catch(() => {});
      resolve({ ok: code === 0, exitCode: code });
    });
  });
});

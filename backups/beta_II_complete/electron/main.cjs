'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn }     = require('child_process');
const { writeFile, unlink } = require('fs/promises');
const os    = require('os');
const https = require('https');
const http  = require('http');

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
    let lastError = '';

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

    ps.stdout.on('data', d => {
      d.toString().split('\n').filter(l => l.trim()).forEach(line => {
        send(line);
        if (line.includes('[ERROR]')) lastError = line.replace(/\[ERROR\]\s*/,'').trim();
      });
    });
    ps.stderr.on('data', d => {
      const msg = d.toString().trim();
      send(`[ERROR] ${msg}`);
      lastError = msg;
    });

    ps.on('close', async (code) => {
      await unlink(tmpFile).catch(() => {});
      resolve({ ok: code === 0, exitCode: code, error: lastError || '' });
    });
  });
});

// ── IPC: M-Files List Workflows ───────────────────────────────────
ipcMain.handle('mfiles:list-workflows', async (_event, { vaultGuid, server, authType, username, password }) => {
  return new Promise((resolve) => {
    let resultJson = '';
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File',          scriptPath('pull-from-vault.ps1'),
      '-VaultGuid',     vaultGuid,
      '-ServerAddress', server,
      '-AuthType',      authType === 'mfiles' ? 'MFiles' : 'Windows',
      '-Username',      username,
      '-Password',      password,
      '-ListOnly'
    ]);

    ps.stdout.on('data', d => {
      const text = d.toString();
      if (text.includes('[RESULT]')) {
        resultJson += text.substring(text.indexOf('[RESULT]') + 8);
      }
    });

    ps.on('close', (code) => {
      if (code === 0 && resultJson) {
        try {
          let parsed = JSON.parse(resultJson);
          if (parsed && !Array.isArray(parsed)) parsed = [parsed];
          resolve({ ok: true, workflows: parsed || [] });
        } catch (e) {
          resolve({ ok: false, error: 'Failed to parse JSON from PowerShell' });
        }
      } else {
        resolve({ ok: false, error: 'Failed to list workflows from vault' });
      }
    });
  });
});

// ── IPC: M-Files Pull Workflows ───────────────────────────────────
ipcMain.handle('mfiles:pull-workflows', async (_event, { vaultGuid, server, authType, username, password, workflowIds }) => {
  const send = (line) => {
    const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed()) ;
    win?.webContents.send('mfiles:progress', line.trim());
  };

  return new Promise((resolve) => {
    let resultJson = '';
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File',          scriptPath('pull-from-vault.ps1'),
      '-VaultGuid',     vaultGuid,
      '-ServerAddress', server,
      '-AuthType',      authType === 'mfiles' ? 'MFiles' : 'Windows',
      '-Username',      username,
      '-Password',      password,
      '-WorkflowIds',   workflowIds.join(',')
    ]);

    ps.stdout.on('data', d => {
      const text = d.toString();
      if (text.includes('[RESULT]')) {
        resultJson += text.substring(text.indexOf('[RESULT]') + 8);
      } else {
        text.split('\n').filter(l => l.trim()).forEach(send);
      }
    });
    ps.stderr.on('data', d => send(`[ERROR] ${d.toString().trim()}`));

    ps.on('close', (code) => {
      if (code === 0 && resultJson) {
        try {
          let parsed = JSON.parse(resultJson);
          if (parsed && !Array.isArray(parsed)) parsed = [parsed];
          resolve({ ok: true, workflows: parsed || [] });
        } catch (e) {
          resolve({ ok: false, error: 'Failed to parse JSON from PowerShell' });
        }
      } else {
        resolve({ ok: false, error: 'Failed to pull workflows from vault' });
      }
    });
  });
});

// ── IPC: Native Save-As dialog ────────────────────────────────────
// Renderer sends { content, defaultName, filters }
// Opens OS save-as dialog, writes file, returns { ok, filePath }
ipcMain.handle('file:save', async (_event, { content, defaultName, filters }) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'export.md',
    filters: filters || [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return { ok: false, cancelled: true };
  await writeFile(filePath, content, 'utf8');
  return { ok: true, filePath };
});

// ── Helper: HTTPS POST from Node (no CORS) ────────────────────────
function httpsPost(host, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req  = https.request(
      { hostname: host, path: urlPath, method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            try { reject(new Error(JSON.parse(raw)?.error?.message || `HTTP ${res.statusCode}`)); }
            catch { reject(new Error(`HTTP ${res.statusCode}`)); }
          } else {
            try { resolve(JSON.parse(raw)); }
            catch { reject(new Error('Invalid JSON response')); }
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Helper: HTTPS GET from Node ───────────────────────────────────
function httpsGet(host, urlPath, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, path: urlPath, method: 'GET', headers },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            try { reject(new Error(JSON.parse(raw)?.message || `HTTP ${res.statusCode}`)); }
            catch { reject(new Error(`HTTP ${res.statusCode}`)); }
          } else {
            try { resolve(JSON.parse(raw)); }
            catch { reject(new Error('Invalid JSON response')); }
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── IPC: Claude SOW extraction ────────────────────────────────────
// Renderer sends { apiKey, model, systemPrompt, text }
// Main process calls Anthropic from Node — no CORS, key never leaves main.
ipcMain.handle('sow:claude-extract', async (_event, { apiKey, model, systemPrompt, text }) => {
  try {
    const data = await httpsPost(
      'api.anthropic.com',
      '/v1/messages',
      {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      { model, max_tokens: 4096, system: systemPrompt,
        messages: [{ role: 'user', content: text }] }
    );
    const raw   = data.content?.[0]?.text || '';
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return { ok: true, json: clean };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── IPC: Cacoo diagram fetch ──────────────────────────────────────
// With apiKey  → calls Cacoo REST API directly from Node (no CORS).
// Without key  → falls back to localhost:5000 Python proxy.
ipcMain.handle('sow:cacoo-fetch', async (_event, { diagramId, apiKey }) => {
  try {
    if (apiKey && apiKey.trim()) {
      const data = await httpsGet(
        'cacoo.com',
        `/api/v1/diagrams/${encodeURIComponent(diagramId)}.json`,
        { 'X-Auth-Token': apiKey.trim() }
      );
      return { ok: true, raw: data };
    }
    // Fallback: local Python backend
    const result = await new Promise((resolve, reject) => {
      http.get(
        `http://localhost:5000/api/cacoo-fetch?diagramId=${encodeURIComponent(diagramId)}`,
        { timeout: 10000 },
        (res) => {
          let raw = '';
          res.on('data', c => { raw += c; });
          res.on('end', () => {
            try { resolve(JSON.parse(raw)); }
            catch { reject(new Error('Invalid JSON from backend')); }
          });
        }
      ).on('error', reject);
    });
    return { ok: true, raw: result };
  } catch (e) {
    const isDown = e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND';
    return {
      ok: false,
      error: isDown
        ? 'Backend not running — start with: python backend/app.py'
        : e.message,
    };
  }
});

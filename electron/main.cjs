'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn }     = require('child_process');
const { writeFile } = require('fs/promises');
const http  = require('http');
const https = require('https');

const isDev  = !app.isPackaged;
const DEV_URL = process.env.PROVISO_DEV_URL || 'http://127.0.0.1:3000';

if (isDev) {
  const runId = `${process.pid}-${Date.now().toString(36)}`;
  const devRoot = path.join(os.tmpdir(), 'proviso-electron-dev', runId);
  const userDataPath = path.join(devRoot, 'userData');
  const sessionDataPath = path.join(devRoot, 'sessionData');

  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(sessionDataPath, { recursive: true });

  app.setPath('userData', userDataPath);
  app.setPath('sessionData', sessionDataPath);
  app.commandLine.appendSwitch('disable-http-cache');
}

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
    autoHideMenuBar: false,
    menuBarVisible:  true,
    backgroundColor: '#0b1220',
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[electron] did-fail-load', { errorCode, errorDescription, validatedURL });

    const escapedMessage = String(errorDescription || 'Unknown load failure')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    win.loadURL(`data:text/html,${encodeURIComponent(`
      <html>
        <body style="margin:0;background:#0b1220;color:#d7e6ff;font-family:monospace;display:grid;place-items:center;min-height:100vh;">
          <div style="max-width:680px;padding:24px;line-height:1.6;">
            <h2 style="margin:0 0 8px;">Renderer failed to load</h2>
            <p style="margin:0 0 8px;opacity:0.85;">Tried URL: ${validatedURL || DEV_URL}</p>
            <p style="margin:0 0 16px;opacity:0.85;">Error: ${escapedMessage}</p>
            <p style="margin:0;opacity:0.7;">Ensure Vite is running, then restart <code>npm run electron:dev</code>.</p>
          </div>
        </body>
      </html>
    `)}`);
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function openOriginalMockupWindow () {
  const win = new BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: false,
    menuBarVisible: true,
    title: 'Proviso Mockup 3 — Original Reference',
  });

  const mockupPath = path.join(app.getAppPath(), 'Proviso_AP_Mockup3.html');
  return win.loadFile(mockupPath);
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

ipcMain.handle('proviso:open-original-mockup', async () => {
  try {
    await openOriginalMockupWindow();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
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

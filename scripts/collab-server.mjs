/**
 * collab-server.mjs
 * Standalone Yjs WebSocket collaboration server for the workflow designer.
 * Run with: node scripts/collab-server.mjs
 * Default port: 1234  (override with PORT env var)
 *
 * Each "room" corresponds to a collaboration session ID entered in the toolbar.
 * Clients connecting to the same room share a Y.Doc and receive presence updates.
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setPersistence, setupWSConnection } from 'y-websocket/bin/utils.js';

const PORT = parseInt(process.env.PORT || '1234', 10);

// In-memory Y.Doc persistence (docs live as long as at least one client is connected)
const docs = new Map();

setPersistence({
  bindState: async (docName, ydoc) => {
    docs.set(docName, ydoc);
  },
  writeState: async (_docName, _ydoc) => {
    // No-op for in-memory mode.
    // For production, write to PostgreSQL here using the workflow persistence API.
  },
});

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('AI Proviso — Yjs collaboration server\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req, {
    docName: new URL(req.url, `ws://localhost:${PORT}`).pathname.slice(1) || 'default',
    gc: true,
  });
});

server.listen(PORT, () => {
  console.log(`[collab-server] Yjs WebSocket server running on ws://localhost:${PORT}`);
});

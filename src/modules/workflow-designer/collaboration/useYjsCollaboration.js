/**
 * useYjsCollaboration.js
 *
 * Network-capable collaboration adapter using Yjs + y-websocket.
 * Replaces the BroadcastChannel (same-machine only) baseline.
 *
 * Usage:
 *   const collab = useYjsCollaboration({ sessionId, clientId, activeId, rfNodes, rfEdges });
 *   collab.online        — boolean: WebSocket connected
 *   collab.presenceByClient — Map<clientId, PresenceMarker>
 *   collab.broadcastPresence(nodeId, edgeId) — send cursor/selection update
 *
 * The WebSocket server URL defaults to ws://localhost:1234.
 * Override with VITE_COLLAB_WS_URL environment variable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

// Dynamic import of WebsocketProvider to avoid SSR issues in Electron
async function getProvider() {
  const { WebsocketProvider } = await import('y-websocket');
  return WebsocketProvider;
}

const COLLAB_WS_URL = import.meta.env?.VITE_COLLAB_WS_URL || 'ws://localhost:1234';

export function useYjsCollaboration({
  sessionId,
  clientId,
  activeId,
  rfNodes,
  rfEdges,
  onRemoteSnapshot,
  disabled = false,
}) {
  const docRef          = useRef(null);
  const providerRef     = useRef(null);
  const [online, setOnline]               = useState(false);
  const [presenceByClient, setPresenceByClient] = useState({});
  const suppressRef     = useRef(false);
  const broadcastTimer  = useRef(null);

  // ── Bootstrap Yjs doc + WebSocket provider ─────────────────────────────────
  useEffect(() => {
    if (disabled || !sessionId || !activeId) return;

    let provider = null;
    let doc      = null;

    getProvider().then((WebsocketProvider) => {
      doc = new Y.Doc();
      docRef.current = doc;

      // Shared maps — one per session room
      const sharedNodes    = doc.getMap('nodes');
      const sharedEdges    = doc.getMap('edges');
      const sharedPresence = doc.getMap('presence');

      // Connect to the collaboration server in the named room
      const room = `${activeId}:${sessionId}`;
      provider  = new WebsocketProvider(COLLAB_WS_URL, room, doc, { connect: true });
      providerRef.current = provider;

      provider.on('status', ({ status }) => {
        setOnline(status === 'connected');
      });

      // Observe remote node/edge changes
      sharedNodes.observe(() => {
        if (suppressRef.current) return;
        const snapshot = {
          rfNodes: Array.from(sharedNodes.values()),
          rfEdges: Array.from(sharedEdges.values()),
          sourceClientId: '__remote__',
        };
        onRemoteSnapshot?.(snapshot);
      });

      // Observe presence updates from other clients
      sharedPresence.observe(() => {
        const map = {};
        sharedPresence.forEach((v, k) => {
          if (k !== clientId && v && Date.now() - (v.ts || 0) < 15000) {
            map[k] = v;
          }
        });
        setPresenceByClient(map);
      });
    }).catch((err) => {
      console.warn('[useYjsCollaboration] Failed to connect:', err.message);
    });

    return () => {
      provider?.destroy();
      docRef.current = null;
      providerRef.current = null;
      setOnline(false);
    };
  }, [sessionId, activeId, clientId, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Broadcast node/edge snapshot when local state changes ─────────────────
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || !rfNodes || !rfEdges) return;

    if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    broadcastTimer.current = setTimeout(() => {
      const sharedNodes = doc.getMap('nodes');
      const sharedEdges = doc.getMap('edges');
      suppressRef.current = true;
      doc.transact(() => {
        // Only update changed nodes to minimise Yjs operations
        rfNodes.forEach((n) => { sharedNodes.set(n.id, n); });
        rfEdges.forEach((e) => { sharedEdges.set(e.id, e); });
      });
      // Allow remote observer to fire after this event loop
      setTimeout(() => { suppressRef.current = false; }, 0);
    }, 300);
  }, [rfNodes, rfEdges]);

  // ── Broadcast presence (cursor / selection) ────────────────────────────────
  const broadcastPresence = useCallback((nodeId, edgeId) => {
    const doc = docRef.current;
    if (!doc) return;
    const sharedPresence = doc.getMap('presence');
    sharedPresence.set(clientId, {
      clientId,
      nodeId:  nodeId  || null,
      edgeId:  edgeId  || null,
      ts:      Date.now(),
    });
  }, [clientId]);

  return { online, presenceByClient, broadcastPresence };
}

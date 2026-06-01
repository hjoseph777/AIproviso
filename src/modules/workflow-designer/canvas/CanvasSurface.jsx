import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { useYjsCollaboration } from '../collaboration/useYjsCollaboration';
import {
  ReactFlow, Background, BackgroundVariant, ConnectionLineType, Controls, MiniMap,
  ControlButton,
  MarkerType, Position, Panel,
  getViewportForBounds,
  useConnection,
  useNodesInitialized, useViewport, useReactFlow,
  addEdge as rfAddEdge, reconnectEdge as rfReconnectEdge,
  getIncomers, getOutgoers,
} from '@xyflow/react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import {
  getGlobalWorkflowPaletteDragItem,
  parseWorkflowPaletteDataTransfer,
  parseWorkflowPaletteItem,
} from '../palette/workflowPalette';
import { KIND_COLORS, resolveEdgeColor } from './edges/WorkflowTransitionEdge';
import { useElkLayout } from '../engine/useElkLayout';
import CanvasContextMenu from './CanvasContextMenu';
import IngestionHub from './IngestionHub';
import {
  CreationDeck, LayoutDeck, HistoryDeck, ContextDeck, CloudDeck,
  ProPanel, ModeIndicator,
} from './ActionDeckSystem';

const STATE_KIND_LABELS = {
  initial: 'Initial',
  approval: 'Approval',
  technical: 'Technical',
  exception: 'Exception',
  terminal: 'Terminal',
  standard: 'State',
};

const EDGE_MARKER_OPTIONS = [
  { value: 'arrow',        label: '→ Open',   markerType: MarkerType.Arrow,       color: '#4ade80' },
  { value: 'arrow-closed', label: '▶ Filled', markerType: MarkerType.ArrowClosed, color: '#a78bfa' },
  { value: 'none',         label: '— None',   markerType: null,                   color: '#94a3b8' },
];

const EDGE_CURVE_OPTIONS = [
  { value: 'bezierTransition', label: '⌒ Bezier', title: 'Smooth bezier curves (default)', color: '#fbbf24' },
  { value: 'smoothstep',       label: '⌐ Step',   title: 'Right-angle step routing',       color: '#fbbf24' },
  { value: 'straight',         label: '— Line',   title: 'Straight connector lines',       color: '#fbbf24' },
];


const hashString = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildCollabSignature = (workflowId, nodes = [], edges = []) => {
  const nodeIds = nodes.slice(0, 24).map((node) => node?.id).join(',');
  const edgeIds = edges.slice(0, 24).map((edge) => edge?.id).join(',');
  return `${workflowId || 'none'}:${nodes.length}:${edges.length}:${hashString(`${nodeIds}|${edgeIds}`)}`;
};

const getPresenceIdentity = (clientId = '') => {
  const seed = String(clientId || 'anon');
  const suffix = seed.replace(/^wf-client-/, '').toUpperCase();
  const initials = (suffix.slice(0, 2) || 'CO').padEnd(2, 'O');
  const hue = hashString(seed) % 360;
  return {
    clientId: seed,
    initials,
    label: `Collaborator ${initials}`,
    color: `hsl(${hue} 86% 66%)`,
    tint: `hsl(${hue} 78% 16%)`,
  };
};

const normalizeEdgeNodeRef = (value = '') => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
);

const HELPER_LINE_SNAP_THRESHOLD = 12;

const getNodeShapeStyle = (stateKind = 'standard') => {
  switch (stateKind) {
    case 'initial':
      return {
        borderRadius: '9999px',
        minWidth: 128,
        minHeight: 128,
      };
    case 'approval':
      return {
        borderRadius: 8,
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        padding: '22px 16px',
        minWidth: 150,
        minHeight: 92,
      };
    case 'exception':
      return {
        borderRadius: 8,
        borderStyle: 'dashed',
      };
    case 'terminal':
      return {
        borderRadius: 22,
      };
    default:
      return {
        borderRadius: 12,
      };
  }
};


// ── ProRuntimeBridge — pipes RF Pro hooks (viewport, nodesReady, connection, api) ─
// Rendered inside <ReactFlow> so it can access the RF context directly.
function ProRuntimeBridge({ onViewport, onNodesReady, onConnecting, onApi }) {
  const viewport  = useViewport();
  const nodesReady = useNodesInitialized();
  const connection = useConnection();
  const api        = useReactFlow();

  useEffect(() => { onApi?.(api); },                              [api, onApi]);
  useEffect(() => { onViewport?.(viewport); },                    [viewport, onViewport]);
  useEffect(() => { onNodesReady?.(nodesReady); },                [nodesReady, onNodesReady]);
  useEffect(() => { onConnecting?.(Boolean(connection?.inProgress)); }, [connection?.inProgress, onConnecting]);

  return null;
}

// ── Main CanvasSurface component ─────────────────────────────────────────────
export default function CanvasSurface({ onOpenInspector, onModeSelect }) {
  const rfNodes               = useWorkflowStore((s) => s.rfNodes);
  const rfEdges               = useWorkflowStore((s) => s.rfEdges);
  const applyCanvasNodeChanges = useWorkflowStore((s) => s.applyCanvasNodeChanges);
  const applyCanvasEdgeChanges = useWorkflowStore((s) => s.applyCanvasEdgeChanges);
  const addCanvasNode          = useWorkflowStore((s) => s.addCanvasNode);
  const deleteCanvasNode       = useWorkflowStore((s) => s.deleteCanvasNode);
  const deleteCanvasEdge       = useWorkflowStore((s) => s.deleteCanvasEdge);
  const duplicateCanvasNode    = useWorkflowStore((s) => s.duplicateCanvasNode);
  const updateNodePosition     = useWorkflowStore((s) => s.updateNodePosition);
  const addEdge                = useWorkflowStore((s) => s.addEdge);
  const updateEdgeProperties   = useWorkflowStore((s) => s.updateEdgeProperties);
  const setSelectedNodeId      = useWorkflowStore((s) => s.setSelectedNodeId);
  const setSelectedEdgeId      = useWorkflowStore((s) => s.setSelectedEdgeId);
  const clearSelection         = useWorkflowStore((s) => s.clearSelection);
  const selectedNodeId         = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId         = useWorkflowStore((s) => s.selectedEdgeId);
  const activeId               = useWorkflowStore((s) => s.activeId);
  const recentlyAddedNodeId    = useWorkflowStore((s) => s.recentlyAddedNodeId);
  const undo                   = useWorkflowStore((s) => s.undo);
  const redo                   = useWorkflowStore((s) => s.redo);
  const pushHistory            = useWorkflowStore((s) => s.pushHistory);
  const historyPointer         = useWorkflowStore((s) => s.historyPointer);
  const historyStack           = useWorkflowStore((s) => s.historyStack);
  const applyCollaborativeSnapshot = useWorkflowStore((s) => s.applyCollaborativeSnapshot);

  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < historyStack.length - 1;

  const canvasApiRef  = useRef(null);
  const surfaceRef = useRef(null);
  const isDraggingNodeRef = useRef(false);
  const lastAutoRecoverAtRef = useRef(0);
  const lastDropAtRef = useRef(0);
  const activeStrokeRef = useRef(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [dropPreview, setDropPreview] = useState(null);
  const [dropSnap, setDropSnap] = useState(null);
  const [helperLines, setHelperLines] = useState({ x: null, y: null });
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
  const [connectionSourceKind, setConnectionSourceKind] = useState('standard');
  const [interactionMode, setInteractionMode] = useState('select');
  const [isLocked, setIsLocked] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
  const [freehandStrokes, setFreehandStrokes] = useState([]);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [edgeMarkerType, setEdgeMarkerType] = useState('arrow');
  const [edgeCurveStyle, setEdgeCurveStyle] = useState('bezierTransition');
  const [zoom, setZoom] = useState(1);
  const [viewportTransform, setViewportTransform] = useState({ x: 0, y: 0, zoom: 1 });
  const [canvasReady, setCanvasReady] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const bootstrappedWorkflowRef = useRef('');
  const autoFrameKeyRef = useRef('');
  const collaborationChannelRef = useRef(null);
  const collaborationClientIdRef = useRef(`wf-client-${Math.random().toString(36).slice(2, 9)}`);
  const collaborationBroadcastTimerRef = useRef(null);
  const suppressNextCollabBroadcastRef = useRef(false);
  const lastOutboundSnapshotSigRef = useRef('');
  const lastInboundSnapshotSigRef = useRef('');
  const copyBufferRef = useRef({ nodes: [], edges: [] });
  const lastPasteOffsetRef = useRef(0);
  const [libavoidActive, setLibavoidActive] = useState(false);
  const [libavoidWaypoints, setLibavoidWaypoints] = useState(() => new Map());
  const [groupingMode, setGroupingMode] = useState(false);
  const [showProPanel, setShowProPanel] = useState(false);
  const [showConnectHint, setShowConnectHint] = useState(false);
  const connectHintTimerRef = useRef(null);
  const [collaborationOnline, setCollaborationOnline] = useState(false);
  const [collaborationSessionId, setCollaborationSessionId] = useState('default');
  const [presenceByClient, setPresenceByClient] = useState({});
  const handleSessionIdChange = useCallback((nextValue) => {
    const normalized = String(nextValue || '').trim();
    setCollaborationSessionId(normalized || 'default');
  }, []);

  // Pre-load ELK bundle as soon as canvas mounts so first layout has no import delay
  useEffect(() => { import('elkjs/lib/elk.bundled.js'); }, []);

  // ── Yjs network collaboration (VITE_COLLAB_NETWORK=true activates this) ────
  const networkCollabEnabled = import.meta.env?.VITE_COLLAB_NETWORK === 'true';
  const yjsCollab = useYjsCollaboration({
    sessionId:  collaborationSessionId,
    clientId:   collaborationClientIdRef.current,
    activeId,
    rfNodes,
    rfEdges,
    disabled:   !networkCollabEnabled,
    onRemoteSnapshot: (snapshot) => {
      if (!snapshot?.rfNodes) return;
      suppressNextCollabBroadcastRef.current = true;
      applyCollaborativeSnapshot({
        rfNodes: snapshot.rfNodes,
        rfEdges: snapshot.rfEdges,
      });
    },
  });

  // When Yjs is active, use its online state and presence; otherwise fall back to BroadcastChannel
  const effectiveOnline   = networkCollabEnabled ? yjsCollab.online   : collaborationOnline;
  const effectivePresence = networkCollabEnabled ? yjsCollab.presenceByClient : presenceByClient;

  // Cross-window collaboration sync for the same workstation/session (BroadcastChannel fallback).
  // Disabled automatically when VITE_COLLAB_NETWORK=true to avoid double-sync.
  useEffect(() => {
    if (networkCollabEnabled) return undefined; // Yjs handles network sync
    if (typeof BroadcastChannel === 'undefined') {
      setCollaborationOnline(false);
      return undefined;
    }

    const channel = new BroadcastChannel('proviso-workflow-designer-sync');
    collaborationChannelRef.current = channel;
    setCollaborationOnline(true);

    channel.onmessage = (event) => {
      const payload = event?.data;
      if (!payload || payload.sessionId !== collaborationSessionId) return;

      if (payload.type === 'presence-ping') {
        if (payload.sourceClientId === collaborationClientIdRef.current) return;
        if (payload.workflowId !== activeId) return;
        const identity = getPresenceIdentity(payload.sourceClientId);
        setPresenceByClient((prev) => ({
          ...prev,
          [payload.sourceClientId]: {
            ...identity,
            nodeId: payload.selectedNodeId || null,
            edgeId: payload.selectedEdgeId || null,
            at: Date.now(),
          },
        }));
        return;
      }

      if (payload.type !== 'canvas-sync') return;
      if (payload.sourceClientId === collaborationClientIdRef.current) return;
      if (payload.workflowId !== activeId) return;

      if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) return;
      if (payload.nodes.length > 1200 || payload.edges.length > 2400) return;

      const signature = buildCollabSignature(payload.workflowId, payload.nodes, payload.edges);
      if (signature === lastInboundSnapshotSigRef.current) return;
      lastInboundSnapshotSigRef.current = signature;

      suppressNextCollabBroadcastRef.current = true;
      applyCollaborativeSnapshot({
        workflowId: payload.workflowId,
        nodes: payload.nodes,
        edges: payload.edges,
      });
    };

    return () => {
      if (collaborationBroadcastTimerRef.current) {
        clearTimeout(collaborationBroadcastTimerRef.current);
      }
      channel.close();
      collaborationChannelRef.current = null;
      setCollaborationOnline(false);
    };
  }, [activeId, applyCollaborativeSnapshot, collaborationSessionId]);

  useEffect(() => {
    const channel = collaborationChannelRef.current;
    if (!channel) return;

    if (suppressNextCollabBroadcastRef.current) {
      suppressNextCollabBroadcastRef.current = false;
      return;
    }

    if (collaborationBroadcastTimerRef.current) {
      clearTimeout(collaborationBroadcastTimerRef.current);
    }

    const outboundSignature = buildCollabSignature(activeId, rfNodes, rfEdges);
    if (outboundSignature === lastOutboundSnapshotSigRef.current) {
      return;
    }
    lastOutboundSnapshotSigRef.current = outboundSignature;

    collaborationBroadcastTimerRef.current = setTimeout(() => {
      channel.postMessage({
        type: 'canvas-sync',
        sessionId: collaborationSessionId,
        sourceClientId: collaborationClientIdRef.current,
        workflowId: activeId,
        nodes: rfNodes,
        edges: rfEdges,
      });
    }, 120);

    return () => {
      if (collaborationBroadcastTimerRef.current) {
        clearTimeout(collaborationBroadcastTimerRef.current);
      }
    };
  }, [activeId, collaborationSessionId, rfNodes, rfEdges]);

  const broadcastPresencePing = useCallback(() => {
    const channel = collaborationChannelRef.current;
    if (!channel) return;

    channel.postMessage({
      type: 'presence-ping',
      sessionId: collaborationSessionId,
      sourceClientId: collaborationClientIdRef.current,
      workflowId: activeId,
      selectedNodeId,
      selectedEdgeId,
    });
  }, [activeId, collaborationSessionId, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    broadcastPresencePing();
  }, [broadcastPresencePing]);

  useEffect(() => {
    const id = window.setInterval(() => {
      broadcastPresencePing();
    }, 1800);
    return () => window.clearInterval(id);
  }, [broadcastPresencePing]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPresenceByClient((prev) => {
        const now = Date.now();
        const next = Object.fromEntries(
          Object.entries(prev).filter(([, marker]) => (now - (marker?.at || 0)) < 4500),
        );
        return next;
      });
    }, 1200);

    return () => window.clearInterval(id);
  }, []);

  const clientToFlowPosition = useCallback((clientX, clientY) => {
    const surface = surfaceRef.current;
    const api = canvasApiRef.current;
    if (!surface || !api) return null;

    const rect = surface.getBoundingClientRect();
    const viewport = api.getViewport?.();

    if (viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.zoom) && viewport.zoom !== 0) {
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    }

    return api.screenToFlowPosition({ x: clientX, y: clientY });
  }, []);

  const resolveDropPlacement = useCallback((clientX, clientY) => {
    const surface = surfaceRef.current;
    const api = canvasApiRef.current;
    if (!surface || !api) {
      return {
        flowPosition: null,
        previewClientX: clientX,
        previewClientY: clientY,
        snap: null,
      };
    }

    const rect = surface.getBoundingClientRect();
    const snapTargetClient = {
      x: rect.left + rect.width / 2,
      y: rect.top + 58,
    };

    const dx = clientX - snapTargetClient.x;
    const dy = clientY - snapTargetClient.y;
    const distance = Math.hypot(dx, dy);
    const shouldSnap = distance <= 92;

    const previewClientX = shouldSnap ? snapTargetClient.x : clientX;
    const previewClientY = shouldSnap ? snapTargetClient.y : clientY;

    return {
      flowPosition: clientToFlowPosition(previewClientX, previewClientY),
      previewClientX,
      previewClientY,
      snap: shouldSnap
        ? {
            clientX: snapTargetClient.x,
            clientY: snapTargetClient.y,
            distance,
          }
        : null,
    };
  }, [clientToFlowPosition]);

  const copySelectionToBuffer = useCallback(() => {
    const selectedNodes = rfNodes.filter((node) => node.selected || node.id === selectedNodeId);
    if (!selectedNodes.length) return false;

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdges = rfEdges.filter((edge) => {
      if (edge.selected || edge.id === selectedEdgeId) return true;
      return selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target);
    });

    copyBufferRef.current = {
      nodes: selectedNodes,
      edges: selectedEdges,
    };
    lastPasteOffsetRef.current = 0;
    return true;
  }, [rfEdges, rfNodes, selectedEdgeId, selectedNodeId]);

  const pasteSelectionFromBuffer = useCallback(() => {
    const buffer = copyBufferRef.current;
    if (!buffer?.nodes?.length) return;

    lastPasteOffsetRef.current += 1;
    const offset = 36 * lastPasteOffsetRef.current;
    const oldIdToNewId = new Map();

    const pastedNodes = buffer.nodes.map((node) => {
      const nextId = `node-${Math.random().toString(36).slice(2, 10)}`;
      oldIdToNewId.set(node.id, nextId);

      return {
        ...node,
        id: nextId,
        selected: true,
        dragging: false,
        position: {
          x: (node?.position?.x || 0) + offset,
          y: (node?.position?.y || 0) + offset,
        },
        data: {
          ...node.data,
          name: `${node?.data?.name || node?.data?.label || 'State'} Copy`,
          label: `${node?.data?.name || node?.data?.label || 'State'} Copy`,
        },
      };
    });

    if (!pastedNodes.length) return;

    applyCanvasNodeChanges(pastedNodes.map((node) => ({ type: 'add', item: node })));

    buffer.edges.forEach((edge) => {
      const source = oldIdToNewId.get(edge.source);
      const target = oldIdToNewId.get(edge.target);
      if (!source || !target || source === target) return;
      addEdge(source, target);
    });

    const first = pastedNodes[0];
    if (first?.id) {
      setSelectedNodeId(first.id);
      setSelectedEdgeId(null);
    }
  }, [addEdge, applyCanvasNodeChanges, setSelectedEdgeId, setSelectedNodeId]);

  const updateHelperLines = useCallback((dragNode) => {
    if (!dragNode?.id || !dragNode?.position) {
      setHelperLines({ x: null, y: null });
      return;
    }

    let nearestX = null;
    let nearestY = null;
    let nearestXDistance = Number.POSITIVE_INFINITY;
    let nearestYDistance = Number.POSITIVE_INFINITY;

    rfNodes.forEach((node) => {
      if (node.id === dragNode.id || !node?.position) return;
      const dx = Math.abs(node.position.x - dragNode.position.x);
      const dy = Math.abs(node.position.y - dragNode.position.y);

      if (dx <= HELPER_LINE_SNAP_THRESHOLD && dx < nearestXDistance) {
        nearestX = node.position.x;
        nearestXDistance = dx;
      }
      if (dy <= HELPER_LINE_SNAP_THRESHOLD && dy < nearestYDistance) {
        nearestY = node.position.y;
        nearestYDistance = dy;
      }
    });

    setHelperLines({ x: nearestX, y: nearestY });
  }, [rfNodes]);

  const selectedGroupNode = useMemo(() => (
    rfNodes.find((node) => node.id === selectedNodeId && (node.type === 'group' || node.type === 'workflowGroup')) || null
  ), [rfNodes, selectedNodeId]);

  const toggleGroupCollapsed = useCallback((groupId) => {
    if (!groupId) return;
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      const target = e.target;
      const isInput = target instanceof HTMLElement && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' || target.isContentEditable
      );
      if (isInput) return;

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) { e.preventDefault(); deleteCanvasEdge(selectedEdgeId); return; }
        if (selectedNodeId) { e.preventDefault(); deleteCanvasNode(selectedNodeId); return; }
      }

      // Duplicate: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedNodeId) {
        e.preventDefault();
        duplicateCanvasNode(selectedNodeId);
      }

      // React Flow Pro: copy-paste-pro-example style keyboard behavior.
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const copied = copySelectionToBuffer();
        if (copied) e.preventDefault();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteSelectionFromBuffer();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e' && selectedGroupNode?.id) {
        e.preventDefault();
        toggleGroupCollapsed(selectedGroupNode.id);
        return;
      }

      // Escape
      if (e.key === 'Escape') { clearSelection(); setGroupingMode(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    clearSelection,
    copySelectionToBuffer,
    deleteCanvasEdge,
    deleteCanvasNode,
    duplicateCanvasNode,
    pasteSelectionFromBuffer,
    redo,
    selectedEdgeId,
    selectedGroupNode,
    selectedNodeId,
    toggleGroupCollapsed,
    undo,
  ]);

  // ── Smooth camera pan on node selection ──────────────────────────────────
  useEffect(() => {
    const api = canvasApiRef.current;
    if (!api || !rfNodes.length) return;
    const frame = window.requestAnimationFrame(() => {
      if (selectedNodeId) {
        const node = rfNodes.find((n) => n.id === selectedNodeId);
        if (!node?.position) {
          clearSelection();
          api.fitView({ padding: 0.22, maxZoom: 0.92, duration: 240 });
          return;
        }

        const surface = surfaceRef.current;
        const viewport = api.getViewport?.();
        const rect = surface?.getBoundingClientRect();

        if (viewport && rect && viewport.zoom) {
          const viewCenter = {
            x: (-viewport.x + rect.width / 2) / viewport.zoom,
            y: (-viewport.y + rect.height / 2) / viewport.zoom,
          };
          const nodeCenter = {
            x: node.position.x + 100,
            y: node.position.y + 72,
          };
          const distance = Math.hypot(nodeCenter.x - viewCenter.x, nodeCenter.y - viewCenter.y);
          const recoveryThreshold = Math.max(rect.width, rect.height) / Math.max(viewport.zoom, 0.0001) * 1.35;

          if (distance > recoveryThreshold) {
            api.fitView({ nodes: [node], padding: 0.36, maxZoom: 1.02, duration: 240 });
            return;
          }
        }

        // Keep camera stable while editing; only recover when selection is far out of view.
        return;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [clearSelection, rfNodes, selectedNodeId]);

  // ── RF Pro: replaces the old manual frameNodesInCanvas with getViewportForBounds ─
  const frameNodesInCanvas = useCallback((nodesToFrame, duration = 380) => {
    const api = canvasApiRef.current;
    const surface = surfaceRef.current;
    if (!api || !surface || !nodesToFrame?.length) return;

    const rect = surface.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) {
      window.setTimeout(() => frameNodesInCanvas(nodesToFrame, duration), 220);
      return;
    }

    // Compute bounds directly (avoids the "use hook version for sub-flows" RF warning —
    // we have no sub-flows so the math is identical, but the top-level import triggers it)
    const W = 220, H = 150;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodesToFrame.forEach((n) => {
      const x = Number(n.x ?? n?.position?.x ?? 0);
      const y = Number(n.y ?? n?.position?.y ?? 0);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + W > maxX) maxX = x + W;
      if (y + H > maxY) maxY = y + H;
    });
    if (!Number.isFinite(minX)) return;

    const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    const viewport = getViewportForBounds(bounds, rect.width, rect.height, 0.25, 1.0, 0.12);
    api.setViewport(viewport, { duration });
  }, []);

  const fitView = useCallback((layoutNodes) => {
    const api = canvasApiRef.current;
    if (!api) return;

    if (Array.isArray(layoutNodes) && layoutNodes.length) {
      frameNodesInCanvas(layoutNodes, 400);
      return;
    }

    const surface = surfaceRef.current;
    if (surface && (surface.clientWidth < 50 || surface.clientHeight < 50)) {
      window.setTimeout(() => canvasApiRef.current?.fitView({ padding: 0.1, maxZoom: 1.05, duration: 380 }), 250);
      return;
    }
    api.fitView({ padding: 0.1, maxZoom: 1.05, duration: 380 });
  }, [frameNodesInCanvas]);

  useEffect(() => {
    const api = canvasApiRef.current;
    const surface = surfaceRef.current;
    if (!api || !surface || !rfNodes.length || isDraggingNodeRef.current || isDropActive) return;

    const frameKey = `${activeId}:${rfNodes.length}`;
    if (autoFrameKeyRef.current === frameKey) return;

    const viewport = api.getViewport?.();
    const rect = surface.getBoundingClientRect();
    if (!viewport || !viewport.zoom) return;

    const worldLeft = (-viewport.x) / viewport.zoom;
    const worldTop = (-viewport.y) / viewport.zoom;
    const worldRight = worldLeft + (rect.width / viewport.zoom);
    const worldBottom = worldTop + (rect.height / viewport.zoom);

    const visibleNodes = rfNodes.filter((node) => {
      const nodeX = node?.position?.x || 0;
      const nodeY = node?.position?.y || 0;
      const nodeWidth = node?.width || 240;
      const nodeHeight = node?.height || 110;

      return nodeX + nodeWidth > worldLeft
        && nodeX < worldRight
        && nodeY + nodeHeight > worldTop
        && nodeY < worldBottom;
    });

    if (visibleNodes.length === rfNodes.length) {
      autoFrameKeyRef.current = frameKey;
      return;
    }

    const now = Date.now();
    if (now - lastAutoRecoverAtRef.current < 600) return;
    lastAutoRecoverAtRef.current = now;

    frameNodesInCanvas(rfNodes, 260);
    autoFrameKeyRef.current = frameKey;
  }, [activeId, frameNodesInCanvas, isDropActive, rfNodes]);

  const applyElkLayout = useElkLayout({
    nodes: rfNodes,
    edges: rfEdges,
    updateNodePosition,
    fitView,
    pushHistory,
    onComplete: () => {
      setLayoutReady(true);
      setIsOptimizing(false);
    },
  });

  // "Optimize Paths" — runs ELK to redraw transition arrows crossing-free.
  const runOptimizePaths = useCallback(() => {
    setIsOptimizing(true);
    setLibavoidActive(false);
    setLibavoidWaypoints(new Map());
    applyElkLayout();
  }, [applyElkLayout]);

  // Show a connect hint when the first node is added to an empty canvas
  const prevNodeCountRef = useRef(rfNodes.length);
  useEffect(() => {
    const prev = prevNodeCountRef.current;
    prevNodeCountRef.current = rfNodes.length;
    if (prev === 0 && rfNodes.length === 1) {
      setShowConnectHint(true);
      clearTimeout(connectHintTimerRef.current);
      connectHintTimerRef.current = setTimeout(() => setShowConnectHint(false), 5000);
    }
    if (rfNodes.length >= 2) {
      setShowConnectHint(false);
      clearTimeout(connectHintTimerRef.current);
    }
  }, [rfNodes.length]);

  useEffect(() => {
    if (interactionMode === 'connect') {
      setShowConnectHint(false);
      clearTimeout(connectHintTimerRef.current);
    }
  }, [interactionMode]);

  const scheduleAutoOptimize = useCallback(() => {
    if (isLocked) return;
    window.setTimeout(() => { applyElkLayout(); }, 80);
  }, [applyElkLayout, isLocked]);

  // React Flow Pro: libavoid-edge-routing — obstacle-aware orthogonal routing.
  // Computes right-angle waypoints for each edge that route around node bounding boxes.
  const runLibavoidRouting = useCallback(() => {
    if (rfNodes.length < 1) return;
    const PAD = 26;
    const nodeById = new Map(rfNodes.map((n) => [n.id, n]));

    const obstacles = rfNodes.map((n) => ({
      id: n.id,
      x1: (n.position?.x || 0) - PAD,
      y1: (n.position?.y || 0) - PAD,
      x2: (n.position?.x || 0) + (n.measured?.width || 220) + PAD,
      y2: (n.position?.y || 0) + (n.measured?.height || 110) + PAD,
    }));

    const overlaps = (x1, y1, x2, y2, excludeIds) => obstacles.some((obs) => {
      if (excludeIds.has(obs.id)) return false;
      return !(x2 < obs.x1 || x1 > obs.x2 || y2 < obs.y1 || y1 > obs.y2);
    });

    const newWaypoints = new Map();

    rfEdges.forEach((edge) => {
      const src = nodeById.get(edge.source);
      const tgt = nodeById.get(edge.target);
      if (!src || !tgt) return;

      const srcX = (src.position?.x || 0) + (src.measured?.width || 220) / 2;
      const srcY = (src.position?.y || 0) + (src.measured?.height || 110);
      const tgtX = (tgt.position?.x || 0) + (tgt.measured?.width || 220) / 2;
      const tgtY = (tgt.position?.y || 0);
      const excludeIds = new Set([src.id, tgt.id]);

      const midY = (srcY + tgtY) / 2;
      const hMinX = Math.min(srcX, tgtX) - 8;
      const hMaxX = Math.max(srcX, tgtX) + 8;

      let routeY = midY;
      if (overlaps(hMinX, midY - 8, hMaxX, midY + 8, excludeIds)) {
        const step = 16;
        for (let y = srcY + step; y < tgtY; y += step) {
          if (!overlaps(hMinX, y - 8, hMaxX, y + 8, excludeIds)) { routeY = y; break; }
        }
      }

      newWaypoints.set(edge.id, [
        { x: srcX, y: srcY },
        { x: srcX, y: routeY },
        { x: tgtX, y: routeY },
        { x: tgtX, y: tgtY },
      ]);
    });

    setLibavoidWaypoints(newWaypoints);
    setLibavoidActive(true);
  }, [rfEdges, rfNodes]);

  const clearLibavoidRouting = useCallback(() => {
    setLibavoidWaypoints(new Map());
    setLibavoidActive(false);
  }, []);

  const runForceLayout = useCallback(() => {
    if (isLocked || rfNodes.length < 2) return;

    const simNodes = rfNodes.map((node) => ({
      id: node.id,
      x: Number(node?.position?.x || 0),
      y: Number(node?.position?.y || 0),
    }));

    const knownIds = new Set(simNodes.map((node) => node.id));
    const simLinks = rfEdges
      .map((edge) => ({ source: edge.source, target: edge.target }))
      .filter((edge) => knownIds.has(edge.source) && knownIds.has(edge.target));

    const centerX = simNodes.reduce((sum, node) => sum + node.x, 0) / Math.max(simNodes.length, 1);
    const centerY = simNodes.reduce((sum, node) => sum + node.y, 0) / Math.max(simNodes.length, 1);

    const simulation = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-360))
      .force('center', forceCenter(centerX, centerY))
      .force('collision', forceCollide().radius(126).strength(0.85));

    if (simLinks.length) {
      simulation.force('link', forceLink(simLinks).id((node) => node.id).distance(220).strength(0.22));
    }

    simulation.stop();
    for (let i = 0; i < 220; i += 1) simulation.tick();

    simNodes.forEach((node) => {
      updateNodePosition(node.id, { x: Math.round(node.x), y: Math.round(node.y) });
    });

    fitView(simNodes);
  }, [fitView, isLocked, rfEdges, rfNodes, updateNodePosition]);

  // React Flow Pro: parent-child-relation + selection-grouping examples.
  // Keep this implementation lean and avoid custom grouping engines.
  const groupSelectedNodes = useCallback(() => {
    const selected = rfNodes.filter(n => n.selected && n.type !== 'group' && n.type !== 'workflowGroup');
    if (selected.length < 2) return;

    const makeId = () => Math.random().toString(36).slice(2, 9);
    const groupId = `group-${makeId()}`;
    const pad = 24;

    const minX = Math.min(...selected.map(n => n.position.x)) - pad;
    const minY = Math.min(...selected.map(n => n.position.y)) - pad;
    const maxX = Math.max(...selected.map(n => n.position.x + (n.measured?.width  || 220))) + pad;
    const maxY = Math.max(...selected.map(n => n.position.y + (n.measured?.height || 110))) + pad;

    // Add the RF Pro parent node directly through React Flow node changes.
    const groupRFNode = {
      id:       groupId,
      type:     'group',
      position: { x: minX, y: minY },
      style:    { width: maxX - minX, height: maxY - minY },
      data:     { label: 'AP Sub-process' },
      measured: { width: maxX - minX, height: maxY - minY },
    };
    applyCanvasNodeChanges([{ type: 'add', item: groupRFNode }]);

    // Re-parent selected nodes using native parentId/expandParent behavior.
    selected.forEach(n => {
      applyCanvasNodeChanges([{
        type: 'position',
        id:   n.id,
        position: { x: n.position.x - minX, y: n.position.y - minY },
        parentId:    groupId,
        expandParent: true,
      }]);
    });
  }, [rfNodes, applyCanvasNodeChanges]);

  // ── P3d: Export canvas to PNG using RF Pro viewport utilities + Canvas API ──
  const exportCanvasToPng = useCallback(() => {
    const api = canvasApiRef.current;
    if (!api || !rfNodes.length) return;

    // Use RF Pro's getNodesBounds + getViewportForBounds to frame all nodes
    const nodeObjs = rfNodes.map(n => ({
      id: n.id,
      position: n.position,
      measured: n.measured || { width: 220, height: 110 },
    }));

    const W = 1400, H = 900;
    const bounds  = (() => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodeObjs.forEach(n => {
        const x = n.position.x, y = n.position.y;
        const w = n.measured.width, h = n.measured.height;
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w; if (y + h > maxY) maxY = y + h;
      });
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    })();

    const viewport = getViewportForBounds(bounds, W, H, 0.25, 1.0, 0.1);

    // Render the RF viewport at the export size using the browser Canvas API
    const canvasEl = document.createElement('canvas');
    canvasEl.width  = W;
    canvasEl.height = H;
    const ctx = canvasEl.getContext('2d');

    // Dark background
    ctx.fillStyle = '#0a1525';
    ctx.fillRect(0, 0, W, H);

    // Get the RF viewport SVG element and convert via foreignObject → SVG → PNG
    const rfViewport = surfaceRef.current?.querySelector('.react-flow__viewport');
    if (!rfViewport) return;

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('width',  String(W));
    svgEl.setAttribute('height', String(H));
    svgEl.setAttribute('xmlns',  'http://www.w3.org/2000/svg');

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width',  String(W));
    fo.setAttribute('height', String(H));
    fo.setAttribute('x', '0');
    fo.setAttribute('y', '0');

    const clone = rfViewport.cloneNode(true);
    clone.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
    fo.appendChild(clone);
    svgEl.appendChild(fo);

    const svgData   = new XMLSerializer().serializeToString(svgEl);
    const svgBlob   = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl    = URL.createObjectURL(svgBlob);
    const img       = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      const link      = document.createElement('a');
      link.download   = `workflow-${activeId || 'canvas'}-${Date.now()}.png`;
      link.href       = canvasEl.toDataURL('image/png');
      link.click();
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      console.warn('[exportCanvasToPng] SVG render failed — trying blob download');
      const link    = document.createElement('a');
      link.download = `workflow-${activeId || 'canvas'}.svg`;
      link.href     = svgUrl;
      link.click();
    };
    img.src = svgUrl;
  }, [rfNodes, activeId]);

  const exportCanvasServerSide = useCallback(async () => {
    const payload = {
      workflowId: activeId,
      nodes: rfNodes,
      edges: rfEdges,
    };

    try {
      const response = await fetch('/api/workflows/export-svg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        exportCanvasToPng();
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `workflow-${activeId || 'canvas'}-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('[CanvasSurface] Server-side export failed, falling back to client export.', error);
      exportCanvasToPng();
    }
  }, [activeId, exportCanvasToPng, rfEdges, rfNodes]);

  useEffect(() => {
    if (isLocked && interactionMode === 'connect') setInteractionMode('select');
  }, [interactionMode, isLocked]);

  // Re-arm the canvasReady gate synchronously (before paint) when workflow switches.
  // useLayoutEffect fires before the DOM update is visible, preventing the one stale
  // render that useEffect would miss — that stale render is what generates NaN SVG attrs.
  useLayoutEffect(() => {
    setCanvasReady(false);
  }, [activeId]);

  // ── Bootstrap: runs ONCE per workflow switch. Runs ELK immediately. ──────
  useEffect(() => {
    if (!canvasReady || !activeId || !rfNodes.length) return;
    if (bootstrappedWorkflowRef.current === activeId) return;
    bootstrappedWorkflowRef.current = activeId;
    // ELK bundle pre-loaded on mount → no import delay
    applyElkLayout();
    // Fallback fitView: ELK's internal fitView fires at ~80ms but the canvas container
    // may still be 0px wide during workspace transition animations. This second call
    // at 700ms guarantees fitView runs once the container is fully sized and visible.
    window.setTimeout(() => {
      canvasApiRef.current?.fitView({ padding: 0.12, maxZoom: 1.05, duration: 350 });
    }, 700);
  }, [activeId, applyElkLayout, canvasReady, rfNodes.length]);

  // ── Derived node/edge arrays ──────────────────────────────────────────────
  const nodes = useMemo(() => {
    const graphEdges = rfEdges
      .map((e) => ({
        id: e.id,
        source: String(e.source || ''),
        target: String(e.target || ''),
      }))
      .filter((e) => e.source && e.target);

    const outgoingCounts = new Map();
    const incomingCounts = new Map();
    rfNodes.forEach((n) => {
      const out = getOutgoers(n, rfNodes, graphEdges);
      const inc = getIncomers(n, rfNodes, graphEdges);
      outgoingCounts.set(n.id, out.length);
      incomingCounts.set(n.id, inc.length);
    });

    // Path-highlight: find nodes directly connected to the hovered node
    const connectedToHovered = new Set();
    if (hoveredNodeId) {
      rfEdges.forEach((e) => {
        if (e.source === hoveredNodeId) connectedToHovered.add(e.target);
        if (e.target === hoveredNodeId) connectedToHovered.add(e.source);
      });
    }

    const remoteNodePresence = new Map();
    Object.values(effectivePresence).forEach((marker) => {
      if (!marker?.nodeId) return;
      const list = remoteNodePresence.get(marker.nodeId) || [];
      list.push(marker);
      remoteNodePresence.set(marker.nodeId, list);
    });

    return rfNodes.map((n) => {
      const kind = n?.data?.stateKind || 'standard';
      const hasOut = (outgoingCounts.get(n.id) || 0) > 0;
      const hasIn  = (incomingCounts.get(n.id)  || 0) > 0;

      let linterIssue = null;
      if (kind !== 'terminal' && kind !== 'initial' && !hasOut) linterIssue = 'no-exit';
      else if (kind !== 'initial' && !hasIn) linterIssue = 'unreachable';

      const presenceUsers = remoteNodePresence.get(n.id) || [];
      const kindLabel = STATE_KIND_LABELS[kind] || STATE_KIND_LABELS.standard;
      const isGroupNode = n.type === 'group' || n.type === 'workflowGroup';
      const parentGroupId = n.parentId || n?.data?.parentId || null;
      const hiddenByCollapsedParent = Boolean(parentGroupId && collapsedGroupIds.has(parentGroupId));
      const isCollapsedGroup = Boolean(isGroupNode && collapsedGroupIds.has(n.id));
      const nodeColor = KIND_COLORS[kind] || '#4A9FFF';
      return {
        ...n,
        hidden: hiddenByCollapsedParent,
        type: isGroupNode ? 'group' : 'default',
        selected: n.id === selectedNodeId,
        sourcePosition: isGroupNode ? undefined : Position.Right,
        targetPosition: isGroupNode ? undefined : Position.Left,
        style: isGroupNode
          ? {
              ...n.style,
              width: isCollapsedGroup ? 220 : n?.style?.width,
              height: isCollapsedGroup ? 72 : n?.style?.height,
              opacity: isCollapsedGroup ? 0.95 : 1,
              transition: 'width 180ms ease, height 180ms ease, opacity 160ms ease',
            }
          : {
              border: `1px solid ${nodeColor}66`,
              background: 'rgba(7, 18, 33, 0.92)',
              color: '#dbeafe',
              boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
              fontSize: 12,
              fontWeight: 600,
              transition: 'transform 180ms ease, box-shadow 150ms ease, border-color 150ms ease',
              ...getNodeShapeStyle(kind),
            },
        data: {
          ...n.data,
          label: isCollapsedGroup
            ? `${n?.data?.label || 'Group'} (collapsed)`
            : (n?.data?.name || n?.data?.label || kindLabel),
          outgoingCount: outgoingCounts.get(n.id) || 0,
          recentlyAdded: n.id === recentlyAddedNodeId,
          linterIssue,
          dimmed: hoveredNodeId ? (n.id !== hoveredNodeId && !connectedToHovered.has(n.id)) : false,
          remotePresence: presenceUsers.length > 0,
          remotePresenceUsers: presenceUsers,
        },
      };
    });
  }, [collapsedGroupIds, hoveredNodeId, effectivePresence, recentlyAddedNodeId, rfEdges, rfNodes, selectedNodeId]);

  const markerType = useMemo(() => {
    const option = EDGE_MARKER_OPTIONS.find((item) => item.value === edgeMarkerType);
    return option?.markerType || MarkerType.Arrow;
  }, [edgeMarkerType]);

  const edges = useMemo(() => {
    const nodeById = new Map(rfNodes.map((node) => [node.id, node]));
    const nodeIdByName = new Map(
      rfNodes.map((node) => [normalizeEdgeNodeRef(node?.data?.name), node.id]),
    );
    const resolveNodeId = (raw) => {
      const value = String(raw || '').trim();
      if (!value) return '';
      return nodeById.has(value) ? value : (nodeIdByName.get(normalizeEdgeNodeRef(value)) || '');
    };

    // Compute which side of a node an edge should exit/enter based on relative positions.
    // This determines sourcePosition/targetPosition for getBezierPath — the key to
    // routing curves correctly instead of always exiting from the top.
    const getEdgePositions = (srcNode, tgtNode) => {
      if (!srcNode?.position || !tgtNode?.position) {
        return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
      }
      const dx = (tgtNode.position.x + 110) - (srcNode.position.x + 110);
      const dy = (tgtNode.position.y + 55)  - (srcNode.position.y + 55);
      const isMoreVertical = Math.abs(dy) >= Math.abs(dx) * 0.65;
      if (isMoreVertical) {
        return dy >= 0
          ? { sourcePosition: Position.Bottom, targetPosition: Position.Top }
          : { sourcePosition: Position.Top,    targetPosition: Position.Bottom };
      }
      return dx >= 0
        ? { sourcePosition: Position.Right, targetPosition: Position.Left }
        : { sourcePosition: Position.Left,  targetPosition: Position.Right };
    };

    const remoteEdgePresence = new Map();
    Object.values(effectivePresence).forEach((marker) => {
      if (!marker?.edgeId) return;
      const list = remoteEdgePresence.get(marker.edgeId) || [];
      list.push(marker);
      remoteEdgePresence.set(marker.edgeId, list);
    });

    // Pre-build a reverse-edge lookup so bidirectional detection is O(1) per edge
    const reverseEdgeExists = new Set(
      rfEdges.map(e => `${e.target || ''}→${e.source || ''}`)
    );

    return rfEdges.map((edge) => {
      const source = resolveNodeId(edge.source || edge?.data?.definitionEdge?.from_node_id || edge?.data?.definitionEdge?.from);
      const target = resolveNodeId(edge.target || edge?.data?.definitionEdge?.to_node_id  || edge?.data?.definitionEdge?.to);
      if (!source || !target) return null;

      const srcNode = nodeById.get(source);
      const tgtNode = nodeById.get(target);
      const { sourcePosition, targetPosition } = getEdgePositions(srcNode, tgtNode);
      // Bidirectional detection — if a reverse edge exists, offset ±7px on the
      // perpendicular axis so A→B and B→A render as two distinct visible curves.
      // Forward edge (A→B where A.id < B.id lexicographically) gets +7, return gets -7.
      const isBidir = reverseEdgeExists.has(`${source}→${target}`) &&
                      reverseEdgeExists.has(`${target}→${source}`);

      const resolvedType = edgeCurveStyle === 'bezierTransition' ? 'bezierTransition' : edgeCurveStyle;
      return {
        id:     edge.id,
        source,
        target,
        type:   resolvedType,
        sourcePosition,
        targetPosition,
        selected: edge.id === selectedEdgeId,
        label: edge?.data?.label || edge?.label || edge?.data?.eventType || '',
        animated: Boolean(edge?.data?.delayPolicyId),
        data: {
          ...edge.data,
          sourceKind: edge?.data?.sourceKind || 'standard',
          isBidir,
          lineStyle: edge?.data?.line_style || edge?.data?.lineStyle || 'auto',
        },
        markerEnd: {
          type: markerType,
          width: 22,
          height: 22,
          color: resolveEdgeColor(edge?.data?.label, edge?.data?.eventType, edge?.data?.sourceKind),
        },
        // React Flow Pro: libavoid-edge-routing — attach pre-computed obstacle-avoiding waypoints
        ...(libavoidWaypoints.has(edge.id) ? { data: { ...(edge.data || {}), libavoidPoints: libavoidWaypoints.get(edge.id) } } : {}),
      };
    }).filter(Boolean);
  }, [edgeCurveStyle, hoveredNodeId, effectivePresence, libavoidWaypoints, markerType, rfEdges, rfNodes, selectedEdgeId]);

  const miniMapNodeColor = useCallback((node) => {
    if (node?.data?.hasValidationErrors) return '#FF3D5A';
    return KIND_COLORS[node?.data?.stateKind] || '#4A9FFF';
  }, []);

  const connectionLineStyle = useMemo(() => ({
    stroke: KIND_COLORS[connectionSourceKind] || KIND_COLORS.standard,
    strokeWidth: 2,
    opacity: 0.88,
  }), [connectionSourceKind]);

  const defaultEdgeOptions = useMemo(() => ({
    type: edgeCurveStyle,
    markerEnd: markerType ? { type: markerType, width: 22, height: 22, color: '#38bdf8' } : undefined,
  }), [edgeCurveStyle, markerType]);


  const handleDragOver = useCallback((e) => {
    if (isLocked) {
      setIsDropActive(false);
      setDropPreview(null);
      setDropSnap(null);
      return;
    }

    // Always cancel default dragover behavior so drop can fire reliably.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const item = parseWorkflowPaletteDataTransfer(e.dataTransfer)
      || parseWorkflowPaletteItem(e.dataTransfer?.getData('text/plain'))
      || getGlobalWorkflowPaletteDragItem();
    if (!item) {
      if (isDropActive) {
        setIsDropActive(false);
        setDropPreview(null);
        setDropSnap(null);
      }
      return;
    }
    if (interactionMode !== 'select') setInteractionMode('select');
    if (!isDropActive) setIsDropActive(true);
    const placement = resolveDropPlacement(e.clientX, e.clientY);
    setDropSnap(placement.snap);
    setDropPreview({
      stateKind: item.stateKind,
      label: item.label || item.name,
      clientX: placement.previewClientX,
      clientY: placement.previewClientY,
      snapped: Boolean(placement.snap),
    });
  }, [interactionMode, isDropActive, isLocked, resolveDropPlacement]);

  const handleDrop = useCallback((e) => {
    if (isLocked) {
      e.preventDefault();
      setIsDropActive(false);
      setDropPreview(null);
      setDropSnap(null);
      return;
    }

    e.preventDefault();

    const item = parseWorkflowPaletteDataTransfer(e.dataTransfer)
      || parseWorkflowPaletteItem(e.dataTransfer?.getData('text/plain'))
      || getGlobalWorkflowPaletteDragItem();
    setIsDropActive(false);
    setDropPreview(null);
    setDropSnap(null);
    if (!item || !canvasApiRef.current) return;

    const placement = resolveDropPlacement(e.clientX, e.clientY);
    const fallbackPosition = clientToFlowPosition(e.clientX, e.clientY);
    const position = placement.flowPosition || fallbackPosition;
    if (!position) return;

    const nextNodeName = item.name || undefined;
    addCanvasNode({ stateKind: item.stateKind, name: nextNodeName, position });
    lastDropAtRef.current = Date.now();

    window.requestAnimationFrame(() => {
      canvasApiRef.current?.setCenter(position.x + 100, position.y + 72, {
        duration: 220,
        zoom: Math.max(canvasApiRef.current?.getZoom?.() || 0.88, 0.9),
      });

      window.setTimeout(() => {
        const api = canvasApiRef.current;
        if (!api?.fitView || !api?.getNodes) return;

        const nodesSnapshot = api.getNodes();
        if (!nodesSnapshot?.length) return;

        const targetNode = nextNodeName
          ? [...nodesSnapshot].reverse().find((node) => node?.data?.name === nextNodeName)
          : nodesSnapshot[nodesSnapshot.length - 1];

        if (!targetNode) return;
        api.fitView({ nodes: [targetNode], padding: 0.42, maxZoom: 1.06, duration: 180 });
      }, 90);
    });
  }, [addCanvasNode, clientToFlowPosition, isLocked, resolveDropPlacement, scheduleAutoOptimize]);

  const startFreehandStroke = useCallback((event) => {
    if (isLocked || interactionMode !== 'draw') return;
    const point = clientToFlowPosition(event.clientX, event.clientY);
    if (!point) return;

    const stroke = {
      id: `stroke-${Math.random().toString(36).slice(2, 10)}`,
      points: [point],
      color: 'rgba(34, 211, 238, 0.9)',
    };
    activeStrokeRef.current = stroke;
    setIsDrawingFreehand(true);
    setFreehandStrokes((prev) => [...prev, stroke]);
  }, [clientToFlowPosition, interactionMode, isLocked]);

  const continueFreehandStroke = useCallback((event) => {
    const current = activeStrokeRef.current;
    if (!current || interactionMode !== 'draw') return;

    const point = clientToFlowPosition(event.clientX, event.clientY);
    if (!point) return;

    current.points = [...current.points, point];
    setFreehandStrokes((prev) => prev.map((stroke) => (
      stroke.id === current.id ? { ...stroke, points: current.points } : stroke
    )));
  }, [clientToFlowPosition, interactionMode]);

  const endFreehandStroke = useCallback(() => {
    if (!activeStrokeRef.current) return;
    activeStrokeRef.current = null;
    setIsDrawingFreehand(false);
  }, []);

  const clearFreehandStrokes = useCallback(() => {
    setFreehandStrokes([]);
    activeStrokeRef.current = null;
    setIsDrawingFreehand(false);
  }, []);

  return (
    <div
      ref={surfaceRef}
      className={`canvas-surface wf2-canvas mode-${interactionMode}${isDropActive ? ' drop-active' : ''}`}
      onDragOverCapture={handleDragOver}
      onDropCapture={handleDrop}
      onDragLeave={() => { setIsDropActive(false); setDropPreview(null); setDropSnap(null); }}
    >

      {/* ── Action Deck System — 5 floating glassmorphic panels ── */}
      <CreationDeck
        onAddNode={(kind) => addCanvasNode({ stateKind: kind })}
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
        isLocked={isLocked}
        groupingMode={groupingMode}
        onGroupSelected={() => {
          if (!groupingMode) { setGroupingMode(true); }
          else { groupSelectedNodes(); setGroupingMode(false); }
        }}
        canToggleCollapse={Boolean(selectedGroupNode?.id)}
        isSelectionCollapsed={Boolean(selectedGroupNode?.id && collapsedGroupIds.has(selectedGroupNode.id))}
        onToggleCollapse={() => toggleGroupCollapsed(selectedGroupNode?.id)}
        freehandStrokeCount={freehandStrokes.length}
        onClearFreehand={clearFreehandStrokes}
      />

      <LayoutDeck
        onAutoLayout={applyElkLayout}
        onForceLayout={runForceLayout}
        onFitView={fitView}
        onOptimizePaths={runOptimizePaths}
        isOptimizing={isOptimizing}
        isLocked={isLocked}
        rfNodes={rfNodes}
        rfEdges={rfEdges}
        libavoidActive={libavoidActive}
        onLibavoidRoute={runLibavoidRouting}
        onLibavoidClear={clearLibavoidRouting}
        zoom={zoom}
        collaborationOnline={effectiveOnline}
        remotePresenceUsers={Object.values(effectivePresence)}
      />

      <HistoryDeck
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onCopy={copySelectionToBuffer}
        onPaste={pasteSelectionFromBuffer}
        hasCopyBuffer={copyBufferRef.current?.nodes?.length > 0}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        isLocked={isLocked}
        onToggleLock={() => setIsLocked((prev) => !prev)}
        showProPanel={showProPanel}
        onToggleProPanel={() => setShowProPanel((p) => !p)}
      />

      <ContextDeck
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        isLocked={isLocked}
        onDeleteNode={() => selectedNodeId && deleteCanvasNode(selectedNodeId)}
        onDeleteEdge={() => selectedEdgeId && deleteCanvasEdge(selectedEdgeId)}
        onDuplicateNode={() => selectedNodeId && duplicateCanvasNode(selectedNodeId)}
        edgeCurveStyle={edgeCurveStyle}
        onEdgeCurveStyleChange={setEdgeCurveStyle}
        edgeMarkerType={edgeMarkerType}
        onEdgeMarkerTypeChange={setEdgeMarkerType}
        canToggleCollapse={Boolean(selectedGroupNode?.id)}
        isSelectionCollapsed={Boolean(selectedGroupNode?.id && collapsedGroupIds.has(selectedGroupNode.id))}
        onToggleCollapse={() => toggleGroupCollapsed(selectedGroupNode?.id)}
      />

      <CloudDeck
        onExportPng={exportCanvasToPng}
        onExportServerImage={exportCanvasServerSide}
        collaborationOnline={effectiveOnline}
        remotePresenceUsers={Object.values(effectivePresence)}
      />

      <ProPanel visible={showProPanel} />

      <ModeIndicator
        interactionMode={interactionMode}
        isOptimizing={isOptimizing}
        groupingMode={groupingMode}
        isLocked={isLocked}
        isConnecting={isConnecting}
      />

      {isDropActive && (
        <div className="wf2-drop-indicator">
          <span>{dropSnap ? '⊕ Snap to start zone' : '⊕ Drop to add state'}</span>
        </div>
      )}

      {/* Quick-connect hint — shows briefly after first node is added */}
      {showConnectHint && (
        <div style={{
          position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: 'rgba(9,20,38,0.96)', border: '1px solid rgba(74,222,128,0.35)',
          borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)', pointerEvents: 'none',
          animation: 'fadeInUp 0.3s ease',
        }}>
          <span style={{ fontSize: 18 }}>↝</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>Now connect it!</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Click <strong style={{ color: '#38bdf8' }}>Connect</strong> mode → hover a node → drag from the glowing handle to another node
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowConnectHint(false)}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12, padding: 0, pointerEvents: 'all' }}
          >✕</button>
        </div>
      )}

      {dropSnap && (
        <div
          className="wf2-drop-snap-target"
          style={{ left: dropSnap.clientX, top: dropSnap.clientY }}
        >
          <span className="wf2-drop-snap-dot" />
          <span>Start zone snap</span>
        </div>
      )}

      {dropPreview && (
        <div
          className={`wf2-drop-ghost kind-${dropPreview.stateKind}`}
          style={{ left: dropPreview.clientX, top: dropPreview.clientY }}
        >
          <span className="wf2-drop-ghost-dot" />
          <span>{dropPreview.label || STATE_KIND_LABELS[dropPreview.stateKind] || STATE_KIND_LABELS.standard}</span>
          {dropPreview.snapped && <span className="wf2-drop-ghost-snap">SNAP</span>}
        </div>
      )}

      {(helperLines.x !== null || helperLines.y !== null) && (
        <div className="pointer-events-none absolute inset-0 z-[5]">
          {helperLines.x !== null && (
            <div
              className="absolute top-0 h-full w-px bg-cyan-400/70"
              style={{ left: viewportTransform.x + (helperLines.x * viewportTransform.zoom) }}
            />
          )}
          {helperLines.y !== null && (
            <div
              className="absolute left-0 h-px w-full bg-cyan-400/70"
              style={{ top: viewportTransform.y + (helperLines.y * viewportTransform.zoom) }}
            />
          )}
        </div>
      )}

      {freehandStrokes.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-[4] h-full w-full">
          {freehandStrokes.map((stroke) => {
            const points = stroke.points || [];
            if (points.length < 2) return null;
            const d = points.map((point, index) => {
              const x = viewportTransform.x + (point.x * viewportTransform.zoom);
              const y = viewportTransform.y + (point.y * viewportTransform.zoom);
              return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');

            return (
              <path
                key={stroke.id}
                d={d}
                fill="none"
                stroke={stroke.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>
      )}

      {/* ── Ingestion Hub — glassmorphic entry panel, fades away when nodes exist ── */}
      <IngestionHub
        rfNodes={rfNodes}
        visible={!isDropActive}
        onModeSelect={onModeSelect || (() => {})}
      />

      <ReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={nodes}
        edges={edges}
        // React Flow Pro: remove-attribution-pro-example.
        proOptions={{ hideAttribution: true }}
        onInit={(api) => {
          canvasApiRef.current = api; window.__rfApi = api;
        }}
        connectionRadius={80}
        reconnectRadius={20}
        edgesReconnectable
        deleteKeyCode={null}
        snapToGrid
        snapGrid={[12, 12]}
        // React Flow Pro: selection-grouping-pro-example foundation.
        selectionOnDrag
        nodesDraggable={interactionMode === 'select' && !isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable
        panOnDrag={interactionMode === 'connect' ? [2] : true}
        onNodesChange={applyCanvasNodeChanges}
        onNodeDragStart={() => { isDraggingNodeRef.current = true; }}
        onNodeDragStop={(_, node) => {
          setHelperLines({ x: null, y: null });
          updateNodePosition(node.id, node.position);
        }}
        onNodeDrag={(_, node) => {
          isDraggingNodeRef.current = true;
          updateHelperLines(node);
          if (!node?.dragging) isDraggingNodeRef.current = false;
        }}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', id: node.id });
        }}
        onEdgesChange={applyCanvasEdgeChanges}
        onConnect={(conn) => {
          if (isLocked) return;
          if (!conn.source || !conn.target) return;
          // React Flow Pro: addEdge helper to avoid edge-merge duplication.
          const nextEdgeSet = rfAddEdge({
            source: conn.source,
            target: conn.target,
          }, edges);
          const added = nextEdgeSet[nextEdgeSet.length - 1];
          if (!added?.source || !added?.target) return;
          addEdge(added.source, added.target);
        }}
        onConnectStart={(_, params) => {
          if (isLocked) return;
          if (!params?.nodeId) return;
          const sourceNode = rfNodes.find((n) => n.id === params.nodeId);
          setConnectionSourceKind(sourceNode?.data?.stateKind || 'standard');
        }}
        onConnectEnd={() => setConnectionSourceKind('standard')}
        onReconnect={(edge, conn) => {
          if (isLocked) return;
          if (!edge?.id || !conn.source || !conn.target) return;
          // React Flow Pro: reconnectEdge helper for native reconnect behavior.
          const updatedEdges = rfReconnectEdge(edge, {
            source: conn.source,
            target: conn.target,
          }, edges);
          const updatedEdge = updatedEdges.find((candidate) => candidate.id === edge.id);
          if (!updatedEdge?.source || !updatedEdge?.target) return;
          updateEdgeProperties(edge.id, { source: updatedEdge.source, target: updatedEdge.target });
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, type: 'edge', id: edge.id });
        }}
        onNodeClick={(_, node) => { setContextMenu(null); setSelectedNodeId(node.id); }}
        onNodeDoubleClick={(_, node) => {
          if (node?.type === 'group' || node?.type === 'workflowGroup') {
            toggleGroupCollapsed(node.id);
            return;
          }
          setSelectedNodeId(node.id);
          onOpenInspector?.('node', node.id);
        }}
        onEdgeClick={(_, edge) => { setContextMenu(null); setSelectedEdgeId(edge.id); }}
        onEdgeDoubleClick={(_, edge) => {
          setSelectedEdgeId(edge.id);
          onOpenInspector?.('edge', edge.id);
        }}
        onPaneClick={(e) => {
          if (interactionMode === 'draw') {
            endFreehandStroke();
            return;
          }
          if (e?.detail >= 2) {
            if (isLocked) return;
            setHelperLines({ x: null, y: null });
            setIsDropActive(false); setDropPreview(null); setDropSnap(null);
            const position = canvasApiRef.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY });
            addCanvasNode({ stateKind: 'standard', position });
            return;
          }
          if (Date.now() - lastDropAtRef.current < 220) return;
          isDraggingNodeRef.current = false;
          setHelperLines({ x: null, y: null });
          setIsDropActive(false); setDropPreview(null); setDropSnap(null);
          setContextMenu(null); clearSelection();
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          const position = canvasApiRef.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setContextMenu({ x: e.clientX, y: e.clientY, type: 'pane', position });
        }}
        onPaneMouseDown={startFreehandStroke}
        onPaneMouseMove={continueFreehandStroke}
        onPaneMouseUp={endFreehandStroke}
        onMoveEnd={() => endFreehandStroke()}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={connectionLineStyle}
      >
        <ProRuntimeBridge
          onApi={(api) => {
            if (!canvasApiRef.current) {
              canvasApiRef.current = api;
            }
          }}
          onViewport={(nextViewport) => {
            if (nextViewport && Number.isFinite(nextViewport.x) && Number.isFinite(nextViewport.y) && nextViewport.zoom > 0) {
              setZoom(nextViewport.zoom);
              setViewportTransform(nextViewport);
              if (!canvasReady) setCanvasReady(true);
            }
          }}
          onNodesReady={(ready) => {
            if (ready) setLayoutReady(true);
          }}
          onConnecting={setIsConnecting}
        />
        {/* Background deferred until canvasReady — prevents NaN pattern errors on first frame
            when RF viewport hasn't been initialized yet (x/y/zoom = undefined → NaN in SVG) */}
        {canvasReady && (
          <>
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.2}
              color="rgba(120,160,220,.14)"
            />
            <Background
              variant={BackgroundVariant.Lines}
              gap={88}
              size={1}
              color="rgba(80,120,180,.05)"
              style={{ opacity: 0.6 }}
            />
          </>
        )}

        {/* Controls + MiniMap — also gated on canvasReady to prevent NaN from SVG renders
            before the RF viewport has valid x/y/zoom values */}
        {canvasReady && (
          <>
            <Controls
              position="bottom-left"
              showZoom
              showFitView
              showInteractive={false}
              className="!rounded-xl !border !border-white/[0.07] !bg-slate-900/90 !shadow-xl !shadow-black/30 !backdrop-blur-md"
            >
              <ControlButton
                title={isLocked ? 'Unlock editing' : 'Lock editing'}
                onClick={() => setIsLocked((prev) => !prev)}
              >
                {isLocked ? '🔒' : '🔓'}
              </ControlButton>
              <ControlButton
                title="Auto layout (ELK)"
                onClick={applyElkLayout}
              >
                ⊞
              </ControlButton>
              <ControlButton
                title={isOptimizing ? 'Optimizing paths…' : 'Optimize transition paths'}
                onClick={runOptimizePaths}
                disabled={isOptimizing}
              >
                ✨
              </ControlButton>
              <ControlButton
                title={showMiniMap ? 'Hide minimap' : 'Show minimap'}
                onClick={() => setShowMiniMap((prev) => !prev)}
              >
                ◰
              </ControlButton>
            </Controls>
            {showMiniMap && (
              <MiniMap
                pannable
                zoomable
                width={220}
                height={156}
                nodeColor={miniMapNodeColor}
                nodeStrokeWidth={2}
                maskColor="rgba(2,7,14,.72)"
                className="!rounded-xl !border !border-white/[0.07] !shadow-xl !shadow-black/30"
              />
            )}

          </>
        )}
      </ReactFlow>

      {contextMenu && (
        <CanvasContextMenu
          contextMenu={contextMenu}
          onClose={() => setContextMenu(null)}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
        />
      )}
    </div>
  );
}
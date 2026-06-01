/**
 * ActionDeckSystem — Translucent floating action decks for the Workflow Designer.
 *
 * Five glassmorphic panels replace the old single toolbar:
 *   1. Creation Deck     — left-center   — add nodes, freehand, grouping
 *   2. Layout Deck       — top-center    — ELK, force, paths, route, fit
 *   3. History Deck      — bottom-left   — undo/redo, copy/paste, lock
 *   4. Context Deck      — context-right — edge style, collapse (edge/node selected)
 *   5. Cloud Deck        — top-right     — collaboration, export
 */

import { useState } from 'react';
import { Panel } from '@xyflow/react';
import {
  Undo2, Redo2, Copy, Clipboard,
  LayoutGrid, Zap, Maximize2, GitBranch, Waypoints,
  Users, Download, ImageDown,
  Lock, Unlock, Pencil,
  Group, Layers, ChevronDown, ChevronRight,
  MousePointer2, Workflow,
  Spline, ArrowRight, ArrowRightCircle, Minus,
  Trash2, CopyPlus,
  Star, Info,
} from 'lucide-react';

// ── Glassmorphism constants ───────────────────────────────────────────────────
const GLASS = {
  background: 'rgba(7, 12, 23, 0.82)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderTop: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
  borderRadius: 14,
};

// ── Icon button with luminosity states ───────────────────────────────────────
function DeckBtn({ icon: Icon, label, active, activeColor = '#38bdf8', onClick, disabled, danger, size = 18, vertical = false }) {
  const [hovered, setHovered] = useState(false);

  const dimColor   = 'rgba(100, 116, 139, 0.5)';
  const hoverColor = 'rgba(148, 163, 184, 0.9)';
  const color = disabled ? 'rgba(100,116,139,0.2)'
    : active  ? activeColor
    : danger  ? (hovered ? '#f87171' : 'rgba(248,113,113,0.45)')
    : hovered ? hoverColor
    : dimColor;

  const bgColor = disabled ? 'transparent'
    : active  ? `${activeColor}18`
    : danger  ? (hovered ? 'rgba(248,113,113,0.1)' : 'transparent')
    : hovered ? 'rgba(255,255,255,0.06)'
    : 'transparent';

  const glowStyle = active && !disabled ? {
    boxShadow: `0 0 0 1px ${activeColor}40, 0 0 12px ${activeColor}30`,
    filter: `drop-shadow(0 0 4px ${activeColor}80)`,
  } : {};

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: vertical ? 3 : 5,
        width: vertical ? 44 : 'auto',
        height: vertical ? 44 : 36,
        padding: vertical ? '6px 0' : '0 10px',
        borderRadius: 9,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: bgColor,
        color,
        transition: 'all 0.16s ease',
        ...glowStyle,
      }}
    >
      <Icon size={size} strokeWidth={active ? 2.2 : 1.8} />
      {label && !vertical && (
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.2px', lineHeight: 1 }}>
          {label}
        </span>
      )}
    </button>
  );
}

function DeckDivider({ vertical = false }) {
  return (
    <div style={{
      width: vertical ? 1 : '80%',
      height: vertical ? '80%' : 1,
      background: 'rgba(255,255,255,0.07)',
      margin: vertical ? '0 auto' : 'auto 0',
      flexShrink: 0,
    }} />
  );
}

function DeckLabel({ text }) {
  return (
    <div style={{
      fontSize: 7.5,
      fontWeight: 700,
      letterSpacing: '.8px',
      textTransform: 'uppercase',
      color: 'rgba(100,116,139,0.5)',
      padding: '4px 6px 2px',
      textAlign: 'center',
    }}>
      {text}
    </div>
  );
}

// ── Deck 1: CREATION & COMPOSITION — Left Center ─────────────────────────────
export function CreationDeck({
  onAddNode,
  interactionMode,
  setInteractionMode,
  isLocked,
  groupingMode,
  onGroupSelected,
  canToggleCollapse,
  isSelectionCollapsed,
  onToggleCollapse,
  freehandStrokeCount,
  onClearFreehand,
}) {
  const NODE_KINDS = [
    { kind: 'initial',   icon: '◉', color: '#00C870', label: 'Initial state — entry point of the workflow' },
    { kind: 'standard',  icon: '◎', color: '#4A9FFF', label: 'Standard state — general routing step' },
    { kind: 'approval',  icon: '✦', color: '#F0A500', label: 'Approval gate — decision and approval step' },
    { kind: 'technical', icon: '⚙', color: '#20C3D8', label: 'Technical state — system or service task' },
    { kind: 'exception', icon: '⚑', color: '#FF3D5A', label: 'Exception state — escalation or error path' },
    { kind: 'terminal',  icon: '⏹', color: '#9B7EFF', label: 'Terminal state — completion or closed outcome' },
  ];

  return (
    <Panel position="top-left" style={{ top: 80, left: 12 }}>
      <div style={{ ...GLASS, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 6px', width: 52 }}>
        <DeckLabel text="Add" />

        {NODE_KINDS.map(({ kind, icon, color, label }) => (
          <button
            key={kind}
            type="button"
            title={label}
            onClick={() => onAddNode(kind)}
            style={{
              width: 40, height: 34, margin: '0 auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: `1px solid ${color}30`,
              background: `${color}0e`,
              color, fontSize: 14, cursor: 'pointer',
              transition: 'all .15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${color}22`;
              e.currentTarget.style.borderColor = `${color}55`;
              e.currentTarget.style.boxShadow = `0 0 8px ${color}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${color}0e`;
              e.currentTarget.style.borderColor = `${color}30`;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {icon}
          </button>
        ))}

        <DeckDivider />

        {/* Mode: Connect */}
        <DeckBtn
          icon={Workflow}
          label="Connect"
          active={interactionMode === 'connect'}
          activeColor="#38bdf8"
          disabled={isLocked}
          onClick={() => setInteractionMode(interactionMode === 'connect' ? 'select' : 'connect')}
          vertical
        />

        {/* Mode: Draw */}
        <DeckBtn
          icon={Pencil}
          label="Draw"
          active={interactionMode === 'draw'}
          activeColor="#a78bfa"
          disabled={isLocked}
          onClick={() => setInteractionMode(interactionMode === 'draw' ? 'select' : 'draw')}
          vertical
        />
        {freehandStrokeCount > 0 && (
          <DeckBtn
            icon={Trash2}
            label="Clear"
            danger
            onClick={onClearFreehand}
            vertical
          />
        )}

        <DeckDivider />

        {/* Group */}
        <DeckBtn
          icon={Group}
          label="Group"
          active={groupingMode}
          activeColor="#fbbf24"
          disabled={isLocked}
          onClick={onGroupSelected}
          vertical
        />

        {/* Collapse */}
        <DeckBtn
          icon={isSelectionCollapsed ? ChevronRight : ChevronDown}
          label={isSelectionCollapsed ? 'Expand' : 'Fold'}
          active={isSelectionCollapsed}
          activeColor="#fbbf24"
          disabled={!canToggleCollapse}
          onClick={onToggleCollapse}
          vertical
        />
      </div>
    </Panel>
  );
}

// ── Deck 2: INTELLIGENT LAYOUTING — Top Center ───────────────────────────────
export function LayoutDeck({
  onAutoLayout,
  onForceLayout,
  onFitView,
  onOptimizePaths,
  isOptimizing,
  isLocked,
  rfNodes,
  libavoidActive,
  onLibavoidRoute,
  onLibavoidClear,
  zoom,
  rfEdges,
  collaborationOnline,
  remotePresenceUsers,
}) {
  return (
    <Panel position="top-center" style={{ top: 12 }}>
      <div style={{ ...GLASS, display: 'flex', alignItems: 'center', gap: 2, padding: '5px 8px' }}>
        <DeckBtn icon={LayoutGrid} label="Layout" activeColor="#34d399" onClick={onAutoLayout} title="Auto Layout — ELK top-down AP flow" />
        <DeckBtn icon={Zap} label="Force" activeColor="#34d399" disabled={isLocked || rfNodes.length < 2} onClick={onForceLayout} />
        <DeckBtn icon={Maximize2} label="Fit" activeColor="#34d399" onClick={onFitView} />
        <DeckBtn icon={Waypoints} label="Paths" active={isOptimizing} activeColor="#34d399" disabled={isLocked || isOptimizing} onClick={onOptimizePaths} />
        <DeckBtn
          icon={GitBranch}
          label={libavoidActive ? 'Ortho' : 'Route'}
          active={libavoidActive}
          activeColor="#34d399"
          disabled={isLocked}
          onClick={libavoidActive ? onLibavoidClear : onLibavoidRoute}
        />

        <DeckDivider vertical />

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px', fontSize: 10, color: 'rgba(100,116,139,0.7)' }}>
          <span>{Math.round((zoom || 1) * 100)}%</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span>{rfNodes.length} states</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span>{rfEdges.length} transitions</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span style={{ color: collaborationOnline ? '#34d399' : 'rgba(100,116,139,0.4)' }}>
            {collaborationOnline ? '● Live' : '○ Local'}
          </span>
          {remotePresenceUsers?.length > 0 && (
            <span style={{ color: '#818cf8' }}>👥 {remotePresenceUsers.length}</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ── Deck 3: HISTORY & CANVAS CONTROL — Bottom Left ───────────────────────────
export function HistoryDeck({
  undo, redo, canUndo, canRedo,
  onCopy, onPaste, hasCopyBuffer,
  selectedNodeId, selectedEdgeId,
  isLocked, onToggleLock,
  showProPanel, onToggleProPanel,
}) {
  return (
    <Panel position="bottom-left" style={{ bottom: 20, left: 12 }}>
      <div style={{ ...GLASS, display: 'flex', alignItems: 'center', gap: 2, padding: '5px 8px' }}>
        <DeckBtn icon={Undo2} label="Undo" disabled={!canUndo} onClick={undo} activeColor="#94a3b8" />
        <DeckBtn icon={Redo2} label="Redo" disabled={!canRedo} onClick={redo} activeColor="#94a3b8" />

        <DeckDivider vertical />

        <DeckBtn icon={Copy} label="Copy" disabled={!selectedNodeId && !selectedEdgeId} onClick={onCopy} activeColor="#94a3b8" />
        <DeckBtn icon={Clipboard} label="Paste" disabled={!hasCopyBuffer} onClick={onPaste} activeColor="#94a3b8" />

        <DeckDivider vertical />

        <DeckBtn
          icon={isLocked ? Lock : Unlock}
          label={isLocked ? 'Locked' : 'Unlock'}
          active={isLocked}
          activeColor="#fbbf24"
          onClick={onToggleLock}
        />

        <DeckDivider vertical />

        <DeckBtn
          icon={Star}
          label="Pro"
          active={showProPanel}
          activeColor="#a78bfa"
          onClick={onToggleProPanel}
        />
      </div>
    </Panel>
  );
}

// ── Deck 4: CONTEXT DECK — Appears when node or edge is selected ──────────────
export function ContextDeck({
  selectedNodeId,
  selectedEdgeId,
  isLocked,
  onDeleteNode,
  onDeleteEdge,
  onDuplicateNode,
  edgeCurveStyle,
  onEdgeCurveStyleChange,
  edgeMarkerType,
  onEdgeMarkerTypeChange,
  canToggleCollapse,
  isSelectionCollapsed,
  onToggleCollapse,
}) {
  const isNodeSelected = Boolean(selectedNodeId);
  const isEdgeSelected = Boolean(selectedEdgeId);

  if (!isNodeSelected && !isEdgeSelected) return null;

  const CURVE_OPTS = [
    { value: 'bezierTransition', icon: Spline,         label: 'Bezier',   color: '#fbbf24', title: 'Smooth bezier curves' },
    { value: 'smoothstep',       icon: GitBranch,      label: 'Step',     color: '#38bdf8', title: 'Right-angle step routing' },
    { value: 'straight',         icon: ArrowRight,     label: 'Straight', color: '#94a3b8', title: 'Direct straight lines' },
  ];
  const ARROW_OPTS = [
    { value: 'arrow',        label: 'Open',   color: '#4ade80', title: 'Open arrowhead' },
    { value: 'arrow-closed', label: 'Filled', color: '#a78bfa', title: 'Filled arrowhead' },
    { value: 'none',         label: 'None',   color: '#64748b', title: 'No arrowhead' },
  ];

  return (
    <Panel position="top-right" style={{ top: 80, right: 12 }}>
      <div style={{ ...GLASS, display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 8px' }}>

        {isNodeSelected && (
          <>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'rgba(100,116,139,0.5)', paddingBottom: 2 }}>State</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <DeckBtn icon={CopyPlus} label="Dupe" disabled={isLocked} onClick={onDuplicateNode} />
              <DeckBtn icon={Trash2}   label="Del"  disabled={isLocked} danger onClick={onDeleteNode} />
            </div>
            {canToggleCollapse && (
              <DeckBtn
                icon={isSelectionCollapsed ? ChevronRight : ChevronDown}
                label={isSelectionCollapsed ? 'Expand' : 'Collapse'}
                active={isSelectionCollapsed}
                activeColor="#fbbf24"
                onClick={onToggleCollapse}
              />
            )}
          </>
        )}

        {isEdgeSelected && (
          <>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'rgba(100,116,139,0.5)', paddingBottom: 2 }}>Curve</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {CURVE_OPTS.map(({ value, icon: Icon, label, color, title }) => (
                <button
                  key={value}
                  type="button"
                  title={title}
                  onClick={() => onEdgeCurveStyleChange(value)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '5px 7px', borderRadius: 8, border: '1px solid',
                    fontSize: 8, fontWeight: 600, cursor: 'pointer', transition: 'all .14s',
                    background: edgeCurveStyle === value ? `${color}18` : 'transparent',
                    borderColor: edgeCurveStyle === value ? `${color}55` : 'rgba(255,255,255,0.08)',
                    color: edgeCurveStyle === value ? color : 'rgba(100,116,139,0.5)',
                    boxShadow: edgeCurveStyle === value ? `0 0 8px ${color}30` : 'none',
                  }}
                >
                  <Icon size={13} strokeWidth={1.8} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <DeckDivider />

            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'rgba(100,116,139,0.5)', paddingBottom: 2 }}>Arrow</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {ARROW_OPTS.map(({ value, label, color, title }) => (
                <button
                  key={value}
                  type="button"
                  title={title}
                  onClick={() => onEdgeMarkerTypeChange(value)}
                  style={{
                    padding: '4px 8px', borderRadius: 7, border: '1px solid',
                    fontSize: 9, fontWeight: 600, cursor: 'pointer', transition: 'all .14s',
                    background: edgeMarkerType === value ? `${color}18` : 'transparent',
                    borderColor: edgeMarkerType === value ? `${color}55` : 'rgba(255,255,255,0.08)',
                    color: edgeMarkerType === value ? color : 'rgba(100,116,139,0.5)',
                    boxShadow: edgeMarkerType === value ? `0 0 8px ${color}30` : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <DeckDivider />

            <DeckBtn icon={Trash2} label="Delete" disabled={isLocked} danger onClick={onDeleteEdge} />
          </>
        )}
      </div>
    </Panel>
  );
}

// ── Deck 5: ENTERPRISE SYNC & EXPORT — Top Right ─────────────────────────────
export function CloudDeck({
  onExportPng,
  onExportServerImage,
  collaborationOnline,
  remotePresenceUsers,
}) {
  return (
    <Panel position="top-right" style={{ top: 12, right: 12 }}>
      <div style={{ ...GLASS, display: 'flex', alignItems: 'center', gap: 2, padding: '5px 8px' }}>
        {/* Collab status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 8,
          background: collaborationOnline ? 'rgba(34,197,94,0.1)' : 'transparent',
          border: `1px solid ${collaborationOnline ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.07)'}`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: collaborationOnline ? '#22c55e' : '#334155',
            boxShadow: collaborationOnline ? '0 0 6px rgba(34,197,94,0.9)' : 'none',
          }} />
          <Users size={13} strokeWidth={1.8} style={{ color: collaborationOnline ? '#4ade80' : 'rgba(100,116,139,0.4)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: collaborationOnline ? '#4ade80' : 'rgba(100,116,139,0.4)' }}>
            {collaborationOnline ? 'Live' : 'Local'}
          </span>
          {remotePresenceUsers?.length > 0 && (
            <span style={{ fontSize: 9, color: '#818cf8' }}>{remotePresenceUsers.length}</span>
          )}
        </div>

        <DeckDivider vertical />

        <DeckBtn icon={Download}   label="PNG" activeColor="#38bdf8" onClick={onExportPng} />
        <DeckBtn icon={ImageDown}  label="SVG" activeColor="#38bdf8" onClick={onExportServerImage} />
      </div>
    </Panel>
  );
}

// ── Pro Panel — floating overlay ─────────────────────────────────────────────
export function ProPanel({ visible }) {
  if (!visible) return null;

  const features = [
    ['⊞', 'Auto Layout',         'Layout deck — ELK top-down AP flow'],
    ['↩', 'Undo / Redo',          'History deck · Ctrl+Z / Ctrl+Y'],
    ['⧉', 'Copy / Paste',         'History deck · Ctrl+C / Ctrl+V'],
    ['↝', 'Collaborative',        '● Live indicator — Yjs real-time sync'],
    ['⌒', 'Editable Edge',        'Context deck — drag bend handle on edge'],
    ['▣', 'Selection Grouping',   'Creation deck — Group button'],
    ['▼', 'Expand / Collapse',    'Creation deck — Fold/Expand button'],
    ['⟳', 'Force Layout',         'Layout deck — D3 physics spacing'],
    ['✏', 'Freehand Draw',        'Creation deck — Draw mode'],
    ['⌇', 'Helper Lines',         'Auto — alignment guides on drag'],
    ['⊸', 'Edge Routing',         'Layout deck — libavoid orthogonal'],
    ['◎', 'Node Position Anim',   'Auto — smooth pan on selection'],
    ['▣', 'Parent-Child Groups',  'Creation deck — drag into container'],
    ['✓', 'Remove Attribution',   'Auto — proOptions hideAttribution'],
    ['☁', 'Server-Side Image',    'Cloud deck — SVG server export'],
    ['◆', 'Shapes',               'Creation deck — 6 semantic state kinds'],
    ['⊞', 'Dynamic Layouting',    'Layout deck — ELK on node add'],
  ];

  return (
    <Panel position="bottom-right" style={{ bottom: 20, right: 12 }}>
      <div style={{
        ...GLASS,
        padding: '12px 14px',
        width: 400,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 8 }}>
          ✦ React Flow Pro — 17 / 17 features active
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 14px' }}>
          {features.map(([icon, name, how]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0' }}>
              <span style={{ fontSize: 11, color: '#4ade80', flexShrink: 0, width: 14 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>{name}</div>
                <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.4 }}>{how}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Mode indicator strip — replaces old status bar text ──────────────────────
export function ModeIndicator({ interactionMode, isOptimizing, groupingMode, isLocked, isConnecting }) {
  const states = {
    optimizing: { text: 'Optimizing paths…',                          color: '#34d399' },
    grouping:   { text: '▣ Grouping mode — select then click Group',  color: '#fbbf24' },
    connect:    { text: 'Drag from a handle to another node',         color: '#38bdf8' },
    draw:       { text: '✏ Drawing mode — click and drag to annotate', color: '#a78bfa' },
    locked:     { text: '🔒 Canvas locked',                           color: '#fbbf24' },
  };

  const active = isOptimizing ? states.optimizing
    : groupingMode ? states.grouping
    : isConnecting ? states.connect
    : interactionMode === 'draw' ? states.draw
    : isLocked ? states.locked
    : null;

  if (!active) return null;

  return (
    <Panel position="bottom-center" style={{ bottom: 20 }}>
      <div style={{
        ...GLASS,
        padding: '6px 14px',
        fontSize: 11,
        fontWeight: 600,
        color: active.color,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: active.color, boxShadow: `0 0 6px ${active.color}` }} />
        {active.text}
      </div>
    </Panel>
  );
}

import { useCallback, useRef, useState } from 'react';
import { Handle, NodeResizer, NodeToolbar, Position } from '@xyflow/react';
import { useWorkflowStore } from '../../store/useWorkflowStore';

// ── Kind configuration ────────────────────────────────────────────────────────
export const KIND_CONFIG = {
  initial:   { label: 'Initial',   icon: '◉', color: '#00C870', glow: 'rgba(0,200,112,.28)',   tw: 'text-emerald-400',  ring: 'ring-emerald-500/60',  border: 'border-l-emerald-500',  badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  approval:  { label: 'Approval',  icon: '✦', color: '#F0A500', glow: 'rgba(240,165,0,.28)',   tw: 'text-amber-400',    ring: 'ring-amber-500/60',    border: 'border-l-amber-500',    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  exception: { label: 'Exception', icon: '⚑', color: '#FF3D5A', glow: 'rgba(255,61,90,.28)',   tw: 'text-rose-400',     ring: 'ring-rose-500/60',     border: 'border-l-rose-500',     badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  technical: { label: 'Technical', icon: '⚙', color: '#20C3D8', glow: 'rgba(32,195,216,.28)',  tw: 'text-cyan-400',     ring: 'ring-cyan-500/60',     border: 'border-l-cyan-500',     badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  terminal:  { label: 'Terminal',  icon: '⏹', color: '#9B7EFF', glow: 'rgba(155,126,255,.28)', tw: 'text-violet-400',   ring: 'ring-violet-500/60',   border: 'border-l-violet-500',   badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  standard:  { label: 'Standard',  icon: '◎', color: '#4A9FFF', glow: 'rgba(74,159,255,.28)',  tw: 'text-sky-400',      ring: 'ring-sky-500/60',      border: 'border-l-sky-500',      badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
};

const LINTER_COPY = {
  'no-exit':     { label: '⚠ No Exit',     title: 'No outgoing transitions — this state is a dead end' },
  'unreachable': { label: '⚠ Unreachable', title: 'Nothing connects to this state' },
};

export default function WorkflowStateNode({ data, selected }) {
  const updateNodeProperties = useWorkflowStore((s) => s.updateNodeProperties);
  const duplicateCanvasNode  = useWorkflowStore((s) => s.duplicateCanvasNode);
  const deleteCanvasNode     = useWorkflowStore((s) => s.deleteCanvasNode);
  const setSelectedNodeId    = useWorkflowStore((s) => s.setSelectedNodeId);

  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const inputRef = useRef(null);

  const kind = String(data.stateKind || 'standard');
  const cfg  = KIND_CONFIG[kind] ?? KIND_CONFIG.standard;

  const startEdit = useCallback((e) => {
    e.stopPropagation();
    setDraft(data.name || '');
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 10);
  }, [data.name]);

  const commitEdit = useCallback(() => {
    const next = draft.trim();
    if (next && next !== data.name) updateNodeProperties(data.nodeId, { name: next });
    setEditing(false);
  }, [draft, data.name, data.nodeId, updateNodeProperties]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditing(false);
    e.stopPropagation();
  }, [commitEdit]);

  const linterIssue = data.linterIssue;
  const remoteUsers = Array.isArray(data.remotePresenceUsers) ? data.remotePresenceUsers : [];
  const isDimmed    = !!data.dimmed;

  const handleStyle = { zIndex: 20 };

  return (
    <>
      {/* ── RF Pro: NodeToolbar ── */}
      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(7,14,26,.97)', backdropFilter: 'blur(8px)', padding: '3px 4px', boxShadow: '0 4px 16px rgba(0,0,0,.5)' }}>
          {[
            ['Inspect',   () => setSelectedNodeId(data.nodeId),      '#38bdf8'],
            ['Duplicate', () => duplicateCanvasNode(data.nodeId),     '#34d399'],
            ['Delete',    () => deleteCanvasNode(data.nodeId),        '#f87171'],
          ].map(([label, action, color]) => (
            <button
              key={label}
              type="button"
              onClick={(e) => { e.stopPropagation(); action(); }}
              style={{ background: 'none', border: 'none', padding: '3px 9px', borderRadius: 5, fontSize: 10, fontWeight: 600, color: '#64748b', cursor: 'pointer', transition: 'all .12s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = color + '18'; e.currentTarget.style.color = color; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </NodeToolbar>

      {/* ── RF Pro: NodeResizer ── */}
      <NodeResizer
        isVisible={selected}
        minWidth={155}
        minHeight={64}
        lineClassName="border border-white/20 rounded"
        handleClassName="h-2 w-2 rounded-sm border border-white/25 bg-slate-800 hover:bg-white/20"
      />

      {/* ── 8-direction handles — z-index:20 ensures top/bottom appear above card ── */}
      <Handle type="source" id="src-t" position={Position.Top}    className="wf2-handle wf2-src" style={handleStyle} />
      <Handle type="source" id="src-r" position={Position.Right}  className="wf2-handle wf2-src" style={handleStyle} />
      <Handle type="source" id="src-b" position={Position.Bottom} className="wf2-handle wf2-src" style={handleStyle} />
      <Handle type="source" id="src-l" position={Position.Left}   className="wf2-handle wf2-src" style={handleStyle} />
      <Handle type="target" id="tgt-t" position={Position.Top}    className="wf2-handle wf2-tgt" style={handleStyle} />
      <Handle type="target" id="tgt-r" position={Position.Right}  className="wf2-handle wf2-tgt" style={handleStyle} />
      <Handle type="target" id="tgt-b" position={Position.Bottom} className="wf2-handle wf2-tgt" style={handleStyle} />
      <Handle type="target" id="tgt-l" position={Position.Left}   className="wf2-handle wf2-tgt" style={handleStyle} />

      {/* ── Card — clean, professional, no gradients ── */}
      <div style={{
        position: 'relative',
        minWidth: 155,
        maxWidth: 220,
        background: '#070e1a',
        border: `1px solid ${selected ? cfg.color + '50' : 'rgba(255,255,255,0.08)'}`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: 8,
        opacity: isDimmed ? 0.2 : 1,
        boxShadow: selected
          ? `0 0 0 1px ${cfg.color}28, 0 8px 24px rgba(0,0,0,.55)`
          : '0 3px 12px rgba(0,0,0,.4)',
        transition: 'opacity .18s ease, box-shadow .15s',
        cursor: 'grab',
        userSelect: 'none',
      }}>

        {/* Kind row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px 3px' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, letterSpacing: '.5px', textTransform: 'uppercase', flexShrink: 0 }}>
            {cfg.icon} {cfg.label}
          </span>
          <span style={{ flex: 1 }} />

          {kind === 'initial' && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 5px ${cfg.color}`, flexShrink: 0 }} />
          )}
          {data.recentlyAdded && (
            <span style={{ fontSize: 8, fontWeight: 700, color: '#38bdf8', border: '1px solid rgba(56,189,248,.3)', borderRadius: 99, padding: '1px 5px', lineHeight: 1.4 }}>New</span>
          )}
          {Number(data.outgoingCount || 0) > 1 && (
            <span style={{ fontSize: 8, color: '#475569', lineHeight: 1 }}>×{data.outgoingCount}</span>
          )}
          {data.hasValidationErrors && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', border: '1px solid rgba(248,113,113,.3)', borderRadius: 99, padding: '1px 5px', lineHeight: 1.4 }} title="Validation error">!</span>
          )}
          {linterIssue && (
            <span style={{ fontSize: 8, color: '#fbbf24', border: '1px solid rgba(251,191,36,.25)', borderRadius: 99, padding: '1px 5px', lineHeight: 1.4 }} title={LINTER_COPY[linterIssue]?.title}>
              {LINTER_COPY[linterIssue]?.label}
            </span>
          )}
        </div>

        {/* State name */}
        <div style={{ padding: '2px 10px 8px' }}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.4)', borderRadius: 5, padding: '3px 7px', fontSize: 13, fontWeight: 600, color: '#e2e8f0', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          ) : (
            <div
              onDoubleClick={startEdit}
              title={`${data.name || 'Untitled'} — double-click to rename`}
              style={{ fontSize: 13, fontWeight: 600, color: '#d4e0f0', lineHeight: 1.3, cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {data.name || <span style={{ color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>Untitled State</span>}
            </div>
          )}
        </div>

        {/* Meta chips — only when configured, no empty placeholders */}
        {(data.assigneeRoleId || data.slaPolicyId || data.tags?.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 10px 7px' }}>
            {data.assigneeRoleId && (
              <span style={{ fontSize: 9, color: '#38bdf8', border: '1px solid rgba(56,189,248,.2)', borderRadius: 99, padding: '1px 7px', lineHeight: 1.6 }}>
                👤 {data.assigneeRoleId}
              </span>
            )}
            {data.slaPolicyId && (
              <span style={{ fontSize: 9, color: '#fbbf24', border: '1px solid rgba(251,191,36,.2)', borderRadius: 99, padding: '1px 7px', lineHeight: 1.6 }}>
                ⏱ {data.slaPolicyId}
              </span>
            )}
            {data.tags?.length > 0 && (
              <span style={{ fontSize: 9, color: '#a78bfa', border: '1px solid rgba(167,139,250,.2)', borderRadius: 99, padding: '1px 7px', lineHeight: 1.6 }}>
                🏷 {data.tags.length}
              </span>
            )}
          </div>
        )}

        {/* Collaboration presence */}
        {remoteUsers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 10px 6px' }}>
            {remoteUsers.slice(0, 4).map((user) => (
              <span
                key={user.clientId}
                title={user.label}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', fontSize: 7, fontWeight: 700, background: user.tint, color: user.color, border: `1.5px solid ${user.color}`, flexShrink: 0 }}
              >
                {user.initials}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

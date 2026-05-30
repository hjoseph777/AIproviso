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

// ── Semantic icons for transition labels ──────────────────────────────────────
const LINTER_COPY = {
  'no-exit':     { label: '⚠ No Exit',     title: 'No outgoing transitions — this state is a dead end' },
  'unreachable': { label: '⚠ Unreachable', title: 'Nothing connects to this state' },
};

export default function WorkflowStateNode({ data, selected, id }) {
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

  // ── Dynamic classes ──────────────────────────────────────────────────────────
  const cardBase = [
    'relative flex flex-col rounded-xl border-l-[3px]',
    'bg-gradient-to-br from-slate-900/98 to-slate-950/98',
    'shadow-2xl shadow-black/50',
    'min-w-[210px] max-w-[255px]',
    'transition-all duration-150 select-none',
    cfg.border,
    selected
      ? `ring-2 ${cfg.ring} cursor-grab`
      : 'ring-1 ring-white/[0.07] hover:ring-white/[0.18] cursor-grab',
  ].join(' ');

  return (
    <>
      {/* ── Node Toolbar (RF Pro) — appears above node when selected ── */}
      <NodeToolbar isVisible={selected} position={Position.Top} offset={6}>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-md px-1 py-1 shadow-xl shadow-black/40">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSelectedNodeId(data.nodeId); }}
            className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-sky-500/20 hover:text-sky-200 transition-colors"
            title="Open in inspector"
          >
            Inspect
          </button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); duplicateCanvasNode(data.nodeId); }}
            className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors"
            title="Duplicate state"
          >
            Duplicate
          </button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteCanvasNode(data.nodeId); }}
            className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
            title="Delete state"
          >
            Delete
          </button>
        </div>
      </NodeToolbar>

      {/* ── Node Resizer (RF Pro) ── */}
      <NodeResizer
        isVisible={selected}
        minWidth={210}
        minHeight={110}
        lineClassName="border border-sky-400/40 rounded"
        handleClassName="h-2.5 w-2.5 rounded-sm border border-sky-300/70 bg-sky-900/80 hover:bg-sky-500/50 transition-colors"
      />

      {/* ── 4-direction connection handles ── */}
      <Handle type="source" id="src-t" position={Position.Top}    className="wf2-handle wf2-src" />
      <Handle type="source" id="src-r" position={Position.Right}  className="wf2-handle wf2-src" />
      <Handle type="source" id="src-b" position={Position.Bottom} className="wf2-handle wf2-src" />
      <Handle type="source" id="src-l" position={Position.Left}   className="wf2-handle wf2-src" />
      <Handle type="target" id="tgt-t" position={Position.Top}    className="wf2-handle wf2-tgt" />
      <Handle type="target" id="tgt-r" position={Position.Right}  className="wf2-handle wf2-tgt" />
      <Handle type="target" id="tgt-b" position={Position.Bottom} className="wf2-handle wf2-tgt" />
      <Handle type="target" id="tgt-l" position={Position.Left}   className="wf2-handle wf2-tgt" />

      {/* ── Card ── */}
      <div
        className={cardBase}
        style={{
          opacity: isDimmed ? 0.18 : 1,
          transition: 'opacity 0.18s ease',
          boxShadow: selected
            ? `0 16px 35px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.color}55, 0 0 24px ${cfg.color}55`
            : '0 16px 35px rgba(0,0,0,0.5)',
        }}
      >
        {/* Subtle top glow line */}
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-xl opacity-50"
          style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}88, transparent)` }}
        />

        {/* ── Drag handle — visible affordance so users know the card is draggable ── */}
        <div className="absolute top-2 right-2.5 flex items-center gap-1 rounded-full border border-white/[0.1] bg-slate-800/70 px-2 py-0.5 text-[8px] font-bold text-white/30 select-none cursor-grab hover:text-white/60 hover:border-white/20 transition-colors">
          <svg width="7" height="9" viewBox="0 0 7 9" fill="none" className="opacity-70">
            <circle cx="1.5" cy="1.5" r="1" fill="currentColor"/>
            <circle cx="5.5" cy="1.5" r="1" fill="currentColor"/>
            <circle cx="1.5" cy="4.5" r="1" fill="currentColor"/>
            <circle cx="5.5" cy="4.5" r="1" fill="currentColor"/>
            <circle cx="1.5" cy="7.5" r="1" fill="currentColor"/>
            <circle cx="5.5" cy="7.5" r="1" fill="currentColor"/>
          </svg>
        </div>

        {/* ── Header row: kind + badges ── */}
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5">
          {/* Kind icon */}
          <span className={`text-[11px] leading-none ${cfg.tw} flex-shrink-0`} title={cfg.label}>
            {cfg.icon}
          </span>

          {/* Kind label */}
          <span className={`text-[9.5px] font-bold uppercase tracking-wider ${cfg.tw}`}>
            {cfg.label}
          </span>

          {/* Spacer */}
          <span className="flex-1" />

          {/* Recently added badge */}
          {data.recentlyAdded && (
            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-px text-[8px] font-bold text-sky-300 leading-none">
              New
            </span>
          )}

          {/* Parallel badge */}
          {Number(data.outgoingCount || 0) > 1 && (
            <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-1.5 py-px text-[8px] font-bold text-sky-400/80 leading-none">
              ×{data.outgoingCount}
            </span>
          )}

          {/* Initial pulse */}
          {kind === 'initial' && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          )}

          {/* Validation error */}
          {data.hasValidationErrors && (
            <span className="rounded-full border border-rose-500/50 bg-rose-500/10 px-1 py-px text-[9px] font-bold text-rose-400 leading-none" title="Validation errors">!</span>
          )}

          {/* Linter badge */}
          {linterIssue && (
            <span
              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[8px] font-bold text-amber-400 leading-none"
              title={LINTER_COPY[linterIssue]?.title}
            >
              {LINTER_COPY[linterIssue]?.label}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-white/[0.05]" />

        {/* ── State name ── */}
        <div className="px-3 py-2.5">
          {editing ? (
            <input
              ref={inputRef}
              className="w-full rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-1 text-[14px] font-bold text-white/90 outline-none placeholder-white/30 focus:border-sky-400/70 focus:ring-1 focus:ring-sky-400/30"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="text-[14px] font-bold text-white/90 leading-snug cursor-text hover:text-white transition-colors truncate"
              title={`${data.name || 'Untitled State'} — double-click to rename`}
              onDoubleClick={startEdit}
            >
              {data.name || <span className="italic text-white/30">Untitled State</span>}
            </div>
          )}
        </div>

        {/* ── Collaboration presence row ── */}
        {remoteUsers.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 pb-1.5">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">Live</span>
            <div className="flex -space-x-1">
              {remoteUsers.slice(0, 4).map((user) => (
                <span
                  key={user.clientId}
                  title={user.label}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold ring-1 ring-slate-900"
                  style={{ background: user.tint, color: user.color, border: `1.5px solid ${user.color}` }}
                >
                  {user.initials}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer metadata chips ── */}
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2.5 pt-0.5">
          {/* Assignee */}
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[9px] font-medium leading-none ${data.assigneeRoleId ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-white/8 bg-white/4 text-white/30'}`}
            title={data.assigneeRoleId ? `Assignee: ${data.assigneeRoleId}` : 'No assignee'}
          >
            <span className="text-[9px]">👤</span>
            <span className="truncate max-w-[60px]">{data.assigneeRoleId || 'Unassigned'}</span>
          </span>

          {/* SLA */}
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[9px] font-medium leading-none ${data.slaPolicyId ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-white/8 bg-white/4 text-white/30'}`}
            title={data.slaPolicyId ? `SLA: ${data.slaPolicyId}` : 'No SLA'}
          >
            <span className="text-[9px]">⏱</span>
            <span>{data.slaPolicyId || 'No SLA'}</span>
          </span>

          {/* Tags */}
          {data.tags?.length > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-px text-[9px] font-medium text-violet-300 leading-none"
              title={`Tags: ${data.tags.join(', ')}`}
            >
              <span className="text-[9px]">🏷</span>
              <span>{data.tags.length} tag{data.tags.length > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

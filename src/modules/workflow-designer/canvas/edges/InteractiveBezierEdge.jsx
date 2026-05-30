import { useEffect, useRef, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType } from '@xyflow/react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { resolveEdgeColor } from './WorkflowTransitionEdge';

const CURVATURE = 0.4;

// Stroke patterns for each line style
const DASH_PATTERNS = {
  solid:    undefined,
  dashed:   '9 5',
  dotted:   '2 5',
  'dash-dot': '10 4 2 4',
};

// Auto-detect line style from label/eventType keywords when no explicit override
function resolveLineStyle(label = '', eventType = '', explicit) {
  if (explicit && explicit !== 'auto') return explicit;
  const t = `${label} ${eventType}`.toLowerCase();
  if (/exception|error|fail|reject|invalid|discard/.test(t)) return 'dashed';
  if (/timeout|overdue|escalat|expir|sla/.test(t))           return 'dotted';
  if (/condition|guard|when\b|if\b|only\b/.test(t))          return 'dash-dot';
  return 'solid';
}

// React Flow Pro: libavoid-edge-routing — build a rounded-corner orthogonal path
// from an array of {x,y} waypoints computed by the obstacle router.
function buildOrthogonalPath(points) {
  if (!points || points.length < 2) return '';
  const R = 10;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dx1 = curr.x - prev.x; const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x; const dy2 = next.y - curr.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (!len1 || !len2) { d += ` L ${curr.x},${curr.y}`; continue; }
    const r = Math.min(R, len1 / 2, len2 / 2);
    const bx = curr.x - (dx1 / len1) * r; const by = curr.y - (dy1 / len1) * r;
    const ax = curr.x + (dx2 / len2) * r; const ay = curr.y + (dy2 / len2) * r;
    d += ` L ${bx},${by} Q ${curr.x},${curr.y} ${ax},${ay}`;
  }
  d += ` L ${points[points.length - 1].x},${points[points.length - 1].y}`;
  return d;
}

// Semantic icons mapped to edge label keywords
function semanticIcon(label = '', eventType = '') {
  const t = `${label} ${eventType}`.toLowerCase();
  if (/approv|accept|confirm|grant|pass\b/.test(t)) return '✓';
  if (/reject|deny|declin|refus|void/.test(t))       return '✕';
  if (/escalat|after|timeout|overdu/.test(t))        return '↑';
  if (/return|rework|send.?back/.test(t))             return '↩';
  if (/review|inspect|flag|audit/.test(t))            return '🔍';
  if (/complet|done|post|paid|clos/.test(t))          return '✔';
  return null;
}

export default function InteractiveBezierEdge({
  id,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data = {},
  selected,
}) {
  const setSelectedEdgeId    = useWorkflowStore((s) => s.setSelectedEdgeId);
  const updateEdgeProperties = useWorkflowStore((s) => s.updateEdgeProperties);

  const [editing, setEditing] = useState(false);
  const [localBend, setLocalBend] = useState(data?.bendPoint || null);
  const inputRef = useRef(null);
  const dragStateRef = useRef(null);
  const bendValueRef = useRef(localBend);

  useEffect(() => {
    setLocalBend(data?.bendPoint || null);
  }, [data?.bendPoint]);

  useEffect(() => {
    bendValueRef.current = localBend;
  }, [localBend]);

  const labelText = (data?.label || data?.eventType || '').trim();
  const icon      = semanticIcon(data?.label, data?.eventType);

  // Bidirectional offset — shift ±7px on the axis perpendicular to the dominant direction.
  // This keeps A→B and B→A visually separate instead of rendering as one merged line.
  // Dominant axis is determined by sourcePosition: vertical dominant → offset on X,
  // horizontal dominant → offset on Y.
  const offset = data?.bidirOffset ?? 0;
  const isVertical = sourcePosition === 'bottom' || sourcePosition === 'top';
  const sx = sourceX + (isVertical ? offset : 0);
  const sy = sourceY + (isVertical ? 0 : offset);
  const tx = targetX + (isVertical ? offset : 0);
  const ty = targetY + (isVertical ? 0 : offset);

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;
  const bendPoint = localBend || data?.bendPoint || null;

  let edgePath;
  let labelX;
  let labelY;

  const libavoidPoints = data?.libavoidPoints;

  if (libavoidPoints?.length >= 2) {
    // React Flow Pro: libavoid-edge-routing — use obstacle-aware orthogonal waypoints
    edgePath = buildOrthogonalPath(libavoidPoints);
    const mid = libavoidPoints[Math.floor(libavoidPoints.length / 2)];
    labelX = mid.x;
    labelY = mid.y;
  } else if (bendPoint && Number.isFinite(bendPoint.x) && Number.isFinite(bendPoint.y)) {
    const cx = midX + bendPoint.x;
    const cy = midY + bendPoint.y;
    edgePath = `M ${sx},${sy} Q ${cx},${cy} ${tx},${ty}`;
    labelX = (sx + (2 * cx) + tx) / 4;
    labelY = (sy + (2 * cy) + ty) / 4;
  } else {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX: sx, sourceY: sy, sourcePosition,
      targetX: tx, targetY: ty, targetPosition,
      curvature: CURVATURE,
    });
  }

  const handleBendMouseDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const start = {
      x: event.clientX,
      y: event.clientY,
      bendX: bendPoint?.x || 0,
      bendY: bendPoint?.y || 0,
    };
    dragStateRef.current = start;

    const onMouseMove = (moveEvent) => {
      if (!dragStateRef.current) return;
      const dx = moveEvent.clientX - dragStateRef.current.x;
      const dy = moveEvent.clientY - dragStateRef.current.y;
      setLocalBend({
        x: dragStateRef.current.bendX + dx,
        y: dragStateRef.current.bendY + dy,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!dragStateRef.current) return;

      const next = bendValueRef.current || {
        x: dragStateRef.current.bendX,
        y: dragStateRef.current.bendY,
      };
      updateEdgeProperties(id, { bend_point: next });
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const edgeColor         = resolveEdgeColor(data?.label, data?.eventType, data?.sourceKind);
  const isDimmed          = !!data?.dimmed;
  const hasRemotePresence = !!data?.remotePresence;
  const remoteUsers       = Array.isArray(data?.remotePresenceUsers) ? data.remotePresenceUsers : [];
  const collaboratorColor = data?.remotePresenceColor || remoteUsers[0]?.color || edgeColor;

  const strokeColor = selected         ? '#93C5FD'
                    : hasRemotePresence ? collaboratorColor
                    : edgeColor;
  const strokeWidth = hasRemotePresence ? 2.8 : selected ? 2.6 : 2.0;
  const opacity     = isDimmed ? 0.1 : selected ? 1 : hasRemotePresence ? 0.98 : 0.85;

  const lineStyle      = resolveLineStyle(data?.label, data?.eventType, data?.lineStyle);
  const strokeDasharray = DASH_PATTERNS[lineStyle];

  return (
    <>
      {/* Transparent wide hit-area — easy to click thin curves */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        onClick={() => setSelectedEdgeId(id)}
      />

      {/* Visual edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={0}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          strokeLinecap: 'round',
          opacity,
          filter: selected
            ? `drop-shadow(0 0 6px ${strokeColor}bb)`
            : hasRemotePresence
              ? `drop-shadow(0 0 5px ${collaboratorColor}88)`
              : `drop-shadow(0 0 3px ${strokeColor}33)`,
          transition: 'opacity 0.18s ease, stroke-width 0.12s ease',
        }}
        markerEnd={{ type: MarkerType.Arrow, color: strokeColor, width: 20, height: 20 }}
      />

      {/* Floating pill label */}
      {!isDimmed && (labelText || selected) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10,
            }}
            className="nodrag nopan"
            onClick={() => setSelectedEdgeId(id)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setTimeout(() => inputRef.current?.select(), 10);
            }}
            title="Double-click to rename"
          >
            {editing ? (
              <input
                ref={inputRef}
                defaultValue={labelText}
                autoFocus
                className="rounded-md border border-sky-400/50 bg-slate-900/95 px-2 py-px text-[10px] font-semibold text-sky-200 outline-none focus:border-sky-400/80 focus:ring-1 focus:ring-sky-400/30"
                style={{ minWidth: 60, maxWidth: 160, fontFamily: 'var(--mono, monospace)' }}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next) updateEdgeProperties(id, { label: next });
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  e.target.blur();
                  if (e.key === 'Escape') setEditing(false);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9.5px] font-semibold leading-none cursor-pointer transition-all"
                style={{
                  background: 'rgba(8,18,32,0.92)',
                  border: `1px solid ${strokeColor}55`,
                  color: selected ? strokeColor : 'rgba(200,220,255,0.88)',
                  boxShadow: selected ? `0 0 0 2px ${strokeColor}22, 0 2px 8px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.4)',
                  fontFamily: 'var(--mono, JetBrains Mono, monospace)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {icon && <span className="opacity-80">{icon}</span>}
                <span>{labelText || (selected ? '+ label' : '')}</span>

                {/* Remote presence avatars on edge */}
                {remoteUsers.length > 0 && (
                  <span className="ml-1 flex -space-x-0.5">
                    {remoteUsers.slice(0, 2).map((user) => (
                      <span
                        key={user.clientId}
                        title={user.label}
                        className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[6px] font-bold"
                        style={{ background: user.tint, color: user.color, border: `1px solid ${user.color}` }}
                      >
                        {user.initials}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Bend handle — drag to reshape selected path. Persist on mouse-up only. */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midX + (bendPoint?.x || 0)}px, ${midY + (bendPoint?.y || 0)}px)`,
              pointerEvents: 'all',
              zIndex: 11,
            }}
          >
            <button
              type="button"
              onMouseDown={handleBendMouseDown}
              title="Drag to bend path"
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                border: `1px solid ${strokeColor}`,
                background: 'rgba(8,18,32,0.94)',
                boxShadow: `0 0 0 2px ${strokeColor}22`,
                cursor: 'grab',
                padding: 0,
              }}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

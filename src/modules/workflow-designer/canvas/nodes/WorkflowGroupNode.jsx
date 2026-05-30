/**
 * WorkflowGroupNode.jsx
 * RF Pro parent-node component for grouping AP sub-processes.
 * Uses RF v12's native parent-child relationship — child nodes are
 * positioned relative to this group node and expand it when moved near edges.
 */
import { NodeResizer } from '@xyflow/react';

export default function WorkflowGroupNode({ data, selected }) {
  return (
    <>
      {/* RF Pro NodeResizer — resize handles on selected group */}
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={180}
        lineClassName="border border-violet-400/40 rounded"
        handleClassName="h-2.5 w-2.5 rounded-sm border border-violet-300/70 bg-violet-900/80 hover:bg-violet-500/50 transition-colors"
      />

      {/* Group frame — click-through so child nodes receive events */}
      <div
        style={{
          width:  '100%',
          height: '100%',
          borderRadius: 16,
          border: `1.5px ${selected ? 'solid' : 'dashed'} rgba(155,126,255,${selected ? '.55' : '.28'})`,
          background: `rgba(155,126,255,${selected ? '.06' : '.03'})`,
          pointerEvents: 'none',
          boxShadow: selected ? '0 0 0 1px rgba(155,126,255,.15), 0 8px 24px rgba(0,0,0,.3)' : 'none',
          transition: 'border-color .18s, background .18s, box-shadow .18s',
        }}
      />

      {/* Group label */}
      {data?.label && (
        <div style={{
          position: 'absolute',
          top: -22,
          left: 12,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '.5px',
          textTransform: 'uppercase',
          color: 'rgba(155,126,255,.7)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--mono, JetBrains Mono, monospace)',
        }}>
          ▣ {data.label}
        </div>
      )}
    </>
  );
}

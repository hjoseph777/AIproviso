import { useEffect, useRef } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

export default function CanvasContextMenu({ contextMenu, onClose, selectedNodeId, selectedEdgeId }) {
  const menuRef = useRef(null);

  const addCanvasNode         = useWorkflowStore((s) => s.addCanvasNode);
  const deleteCanvasNode      = useWorkflowStore((s) => s.deleteCanvasNode);
  const duplicateCanvasNode   = useWorkflowStore((s) => s.duplicateCanvasNode);
  const deleteCanvasEdge      = useWorkflowStore((s) => s.deleteCanvasEdge);
  const reverseCanvasEdge     = useWorkflowStore((s) => s.reverseCanvasEdge);
  const updateEdgeProperties  = useWorkflowStore((s) => s.updateEdgeProperties);
  const setSelectedNodeId     = useWorkflowStore((s) => s.setSelectedNodeId);

  // Close on click-outside or Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onOutside);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onOutside); };
  }, [onClose]);

  // Keep menu within viewport
  const style = {
    position: 'fixed',
    left: contextMenu.x,
    top: contextMenu.y,
    zIndex: 9999,
    transform: contextMenu.x > window.innerWidth - 200 ? 'translateX(-100%)' : 'none',
  };

  const item = (icon, label, action, danger = false) => (
    <button
      key={label}
      className={`wf2-ctx-item${danger ? ' danger' : ''}`}
      onClick={() => { action(); onClose(); }}
    >
      <span className="wf2-ctx-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );

  const sep = () => <div className="wf2-ctx-sep" />;

  return (
    <div ref={menuRef} className="wf2-ctx-menu" style={style}>
      {contextMenu.type === 'node' && contextMenu.id && (() => {
        const nid = contextMenu.id;
        return (
          <>
            {item('✎', 'Open inspector',  () => setSelectedNodeId(nid))}
            {item('⧉', 'Duplicate state', () => duplicateCanvasNode(nid))}
            {sep()}
            {item('↘', 'Add connected state →', () => {
              addCanvasNode({ stateKind: 'standard', position: { x: (contextMenu.x || 0) + 300, y: contextMenu.y || 0 } });
            })}
            {sep()}
            {item('🗑', 'Delete state', () => deleteCanvasNode(nid), true)}
          </>
        );
      })()}

      {contextMenu.type === 'edge' && contextMenu.id && (() => {
        const eid = contextMenu.id;
        return (
          <>
            {item('✎', 'Rename transition', () => {
              const next = window.prompt('Transition label');
              if (next?.trim()) updateEdgeProperties(eid, { label: next.trim() });
            })}
            {item('⇄', 'Reverse direction', () => reverseCanvasEdge(eid))}
            {sep()}
            {item('🗑', 'Delete transition', () => deleteCanvasEdge(eid), true)}
          </>
        );
      })()}

      {contextMenu.type === 'pane' && (
        <>
          <div className="wf2-ctx-header">Add state</div>
          {['initial', 'approval', 'technical', 'exception', 'terminal'].map((kind) =>
            item(
              { initial: '◉', approval: '✦', technical: '⚙', exception: '⚑', terminal: '⏹' }[kind],
              kind.charAt(0).toUpperCase() + kind.slice(1),
              () => addCanvasNode({ stateKind: kind, position: contextMenu.position || { x: 200, y: 200 } }),
            ),
          )}
        </>
      )}
    </div>
  );
}

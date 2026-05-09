import { useMemo } from 'react';

// ── useMermaid ─────────────────────────────────────────────────
// Transforms a workflow object into a valid stateDiagram-v2 string.
// Returns null if there are no states or no initial state (canvas stays blank).
export const useMermaid = (workflow) => {
  return useMemo(() => {
    if (!workflow) return null;
    const { states, transitions } = workflow;
    if (!states.length) return null;
    if (!states.some(s => s.initial)) return null;

    let d = 'stateDiagram-v2\n';

    // Declare every state node explicitly so isolated states still appear
    states.forEach(s => {
      if (!s.name.trim()) return;
      const id = s.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      d += `  ${id} : ${s.name}\n`;
      if (s.initial) d += `  [*] --> ${id}\n`;
    });

    // Declare transitions (skip any with empty from/to)
    transitions.forEach(t => {
      if (!t.from.trim() || !t.to.trim()) return;
      const f  = t.from.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const to = t.to.replace(/\s+/g,   '_').replace(/[^a-zA-Z0-9_]/g, '');
      d += `  ${f} --> ${to}\n`;
    });

    return d;
  }, [workflow]);
};

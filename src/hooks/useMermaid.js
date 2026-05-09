import { useMemo } from 'react';

// ── useMermaid ─────────────────────────────────────────────────
// Transforms a workflow object into a valid stateDiagram-v2 string.
// Returns null if there are no states or no initial state (canvas stays blank).
//
// DEFENSIVE NOTE — dependency design:
// We derive a stable string key from the actual data instead of depending on
// the workflow object reference. This prevents two known bugs:
//   1. Stale memo: object reference unchanged but content has changed
//   2. Frozen diagram after Reset: useMemo skips recompute if reference
//      equality passes even though data was cleared
// Zustand's resetAll() creates new object references via JSON.parse/stringify
// so reference equality usually works, but the string key is a belt-and-suspenders
// guard for edge cases (e.g. same workflow ID reused after reset).
export const useMermaid = (workflow) => {
  // Derive a stable cache key from the actual content — not the object reference
  const stateKey = workflow?.states.map(s => `${s.name}:${s.initial}`).join('|') ?? '';
  const transKey = workflow?.transitions.map(t => `${t.from}→${t.to}`).join('|') ?? '';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, transKey]); // ← granular content keys, not the whole object reference
};

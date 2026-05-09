# Proviso Core — Master Prompt & Architecture Notes

## Role
Senior Frontend Architect — React, Zustand, Zod, custom spreadsheet grids.

## Tech Stack

| Layer | Choice | Reason |
| :--- | :--- | :--- |
| Grid | **Custom HTML table** | react-spreadsheet v8 crashes when `data` with `DataEditor` changes during edit commit |
| State | Zustand | Single store, all workflows, full referential integrity |
| Validation | Zod | Cross-field rules: self-loops, orphaned transitions, duplicate pairs, missing initial |
| Diagram | Mermaid.js (CDN) | `stateDiagram-v2`, CDN-loaded, no npm package needed |

---

## Layout Architecture — "Command Center"

```
┌─────────────────────────┬──────────────────────────┐
│  LEFT PANE (flex:1)     │  RIGHT PANE (flex:1)     │
│  overflow-y: hidden     │  position: sticky        │
│  ─────────────────────  │  top: 0                  │
│  [States scrollbox]     │  height: 100vh           │
│    max-height: 350px    │                          │
│    overflow-y: auto     │  Live Mermaid Diagram    │
│  ─────────────────────  │  (never scrolls away)    │
│  [Transitions scrollbox]│                          │
│    max-height: 450px    │                          │
│    overflow-y: auto     │                          │
└─────────────────────────┴──────────────────────────┘
```

**Rules:**
- Left pane has two independent scroll areas (States + Transitions) — each has its own scrollbar
- Right pane (diagram) is `position: sticky` — stays fixed as left pane grows
- Section headers (`+ Add`, row count) always sticky at top of their section
- `thead` column headers are sticky WITHIN each scroll container

---

## Scroll Strategy — "Viewport Sweet Spot"

| Section | Max-Height | Visible Rows |
| :--- | :--- | :--- |
| States | 350px | ~12 rows |
| Transitions | 450px | ~14 rows |

**Why these numbers:** 12 states visible before scrolling. Once user hits row 13, the internal scrollbar appears. The Transitions section gets more space because workflows typically have more transitions than states.

### Shadow Scroll Indicators
Add `box-shadow: inset 0 8px 10px -10px rgba(0,0,0,.6)` at top and bottom of scroll containers. Signals "more data above/below" without taking any space.

### Zebra Striping
```css
.sheet-table tbody tr:nth-child(even) { background: rgba(255,255,255,.02); }
```
Essential for 100+ row readability. The eye tracks rows even without hovering.

### Ghost Row
Instead of empty space after the last row, append a dashed "ghost" row:
```jsx
<tr className="ghost-row">
  <td colSpan={4}>
    <div>─ ─ click + Add to continue ─ ─</div>
  </td>
</tr>
```

---

## Search/Filter Pattern for 100+ Rows

Add a mini search bar to each section header. Filter happens client-side, pure JS — no API needed.

```jsx
// In SpreadsheetGrid state:
const [stateFilter, setStateFilter] = useState('');
const [transFilter, setTransFilter] = useState('');

// Filtered views:
const filteredStates = wf.states.filter(st =>
  !stateFilter || st.name.toLowerCase().includes(stateFilter.toLowerCase())
);
const filteredTrans = wf.transitions.filter(t =>
  !transFilter ||
  t.from.toLowerCase().includes(transFilter.toLowerCase()) ||
  t.to.toLowerCase().includes(transFilter.toLowerCase())
);
```

**UX Rule:** Filter input appears inline in the section header. Placeholder: `"Filter states..."`. Typing "Sign" instantly hides all rows except "Signed Internally", "Signed by Customer". ESC clears the filter.

---

## Referential Integrity

```js
// deleteState — returns { ok, error }
// Blocked if state name appears in any transition
deleteState: (wfId, stateId) => {
  const inUse = wf.transitions.some(t => t.from === state.name || t.to === state.name);
  if (inUse) return { ok: false, error: `"${state.name}" is in use — remove its transitions first.` };
}

// renameState — auto-cascades to ALL transitions
renameState: (wfId, stateId, newName) => {
  // Updates state.name AND every t.from/t.to that matches old name
}
```

---

## useMermaid Hook

```js
// Returns null → diagram clears (no initial state set)
// All state nodes declared explicitly → isolated states still show as boxes
const useMermaid = (workflow) => useMemo(() => {
  if (!workflow?.states.length) return null;
  if (!workflow.states.some(s => s.initial)) return null;
  let d = 'stateDiagram-v2\n';
  workflow.states.forEach(s => {
    const id = s.name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    d += `  ${id} : ${s.name}\n`;
    if (s.initial) d += `  [*] --> ${id}\n`;
  });
  workflow.transitions.forEach(t => {
    if (!t.from || !t.to) return;
    const f  = t.from.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    const to = t.to.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    d += `  ${f} --> ${to}\n`;
  });
  return d;
}, [workflow]);
```

---

## Key Decision Log

| Decision | Reason |
| :--- | :--- |
| Dropped react-spreadsheet | Crashes on controlled data + DataEditor during commit cycle |
| Dropped Cacoo | Proviso is the source of truth — no external import |
| Dropped Flask backend | All state in-browser via Zustand |
| Custom grid | Stable, full UX control, integrity guards built in |
| `renameState` cascades | Renames auto-update all `from`/`to` in transitions |
| Zod cross-field | Catches self-loops, orphaned transitions, duplicates |
| Search/filter bars | Required for 100+ state workflows |
| Max-height scroll areas | Keeps diagram always visible on right pane |
| Zebra striping | Visual row tracking for large datasets |
| Ghost row | Eliminates "huge gap" at bottom of short lists |

---

## File Structure

```
src/
├── App.jsx                    ← Shell: layout, CSS, sidebar
├── store/useWorkflowStore.js  ← Zustand: all workflows + actions
├── validation/schema.js       ← Zod schemas
├── hooks/
│   ├── useMermaid.js          ← Diagram string generator
│   └── useExport.js           ← M-Files JSON exporter
└── components/
    ├── WorkflowEditor.jsx     ← Tabs + toolbar + split layout
    ├── SpreadsheetGrid.jsx    ← Custom grid + search + scroll
    ├── GlobalSection.jsx      ← Users, Properties, Rules
    ├── DiagramPane.jsx        ← Mermaid canvas (stateless)
    ├── PrdGenerator.jsx       ← PRD screen
    └── IngestWorkflow.jsx     ← Vault ingestion screen
```

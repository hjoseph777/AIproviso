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
//
// ⚠ CRITICAL: dependency must be content keys, NOT the workflow object reference.
// If you use [workflow], useMemo uses Object.is() — same reference = skip recompute.
// After resetAll(), Zustand creates new objects (JSON.parse/stringify), so reference
// changes. But as a belt-and-suspenders guard, we derive string keys from the
// actual data content so the memo ALWAYS recomputes when data changes.
export const useMermaid = (workflow) => {
  const stateKey = workflow?.states.map(s => `${s.name}:${s.initial}`).join('|') ?? '';
  const transKey = workflow?.transitions.map(t => `${t.from}→${t.to}`).join('|') ?? '';
  return useMemo(() => {
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
  }, [stateKey, transKey]); // ← granular content keys, not whole object
};
```

---

## Reset Button / Mermaid DOM Cache — Known Issue & Fix

**Symptom:** Clicking ↺ Reset clears the spreadsheet grid but the Mermaid diagram stays frozen showing old data.

**Root Causes:**

| # | Cause | Description |
| :- | :--- | :--- |
| 1 | **useMemo stale reference** | `useMemo([workflow])` uses `Object.is()` — if Zustand re-uses the same object reference, memo skips recompute and returns the old diagram string |
| 2 | **Mermaid DOM cache** | Mermaid injects SVG directly into the DOM. If React doesn't remount the component, the old SVG stays painted even if props change |
| 3 | **Empty string edge case** | If `useMermaid` returns `""` instead of `null`, Mermaid may crash silently and freeze on the last valid render |

**Our Fixes (all three applied):**

```jsx
// Fix 1 — useMermaid uses content keys, not object reference
const stateKey = workflow?.states.map(s => `${s.name}:${s.initial}`).join('|') ?? '';
return useMemo(() => { ... }, [stateKey, transKey]); // ← NOT [workflow]

// Fix 2 — resetCount bumps on every Reset → forces DiagramPane to fully remount
// WorkflowEditor.jsx:
const [resetCount, setResetCount] = useState(0);
const handleReset = () => {
  resetAll();
  setResetCount(c => c + 1); // React destroys + recreates DiagramPane → Mermaid DOM wiped
};
<DiagramPane key={resetCount} mermaidCode={mermaidStr} selectedState={selectedState} />

// Fix 3 — useMermaid returns null (not '') for empty state → DiagramPane clears innerHTML
if (!states.length) return null;
// DiagramPane:
if (!mermaidCode) { dRef.current.innerHTML = ''; return; }
```

**Rule:** Never use `key={JSON.stringify(data)}` on a component that renders on every keystroke — that would remount on every character typed. Use a counter that only increments on hard resets.

---

## ⚡ Stress Test Generator

**Trigger:** `⚡ Stress Test` button in the SOW Editor toolbar
**Action:** `loadStressTest(wfId)` in `useWorkflowStore.js`
**Output:** 100 states + 150 transitions loaded into the active workflow tab

### Generation Pattern (deterministic — same result every run)

| Layer | Pattern | Count | Cumulative |
| :--- | :--- | :---: | :---: |
| 1 | Linear chain: State 01 to 02 to 100 | 99 | 99 |
| 2 | Back to initial every 10th state | 10 | 109 |
| 3 | Skip-forward by 10 | 9 | 118 |
| 4 | Skip-forward by 5 | 19 | 137 |
| 5 | Branch +3 from even-indexed states (fills to 150) | 13 | 150 |
| 6 | Reverse -2 from tail (safety top-up if under 150) | 0 | 150 |

### Key Design Rules
```js
// Deduplication — O(1) per check, no nested loops
const seen = new Set();
const addT = (from, to) => {
  const key = `${from}|${to}`;
  if (seen.has(key) || from === to) return; // skip duplicates and self-loops
  seen.add(key);
  transitions.push(...);
};
// State naming — "State 01" to "State 100"
const pad = n => String(n).padStart(2, '0');
const nm  = i => `State ${pad(i + 1)}`;
```

### Performance Observations at 100 States / 150 Transitions
| Metric | Result |
| :--- | :--- |
| Grid render (initial load) | instant |
| Filter/search response | instant (Array.filter on 100 rows) |
| Mermaid diagram render | 1-3 sec (CPU layout, expected) |
| Cell edit latency | instant (content-key memo prevents diagram re-draw on keystroke) |
| Export JSON | instant |

### To Scale Further
Change N and target cap in loadStressTest:
```js
const N = 150; // states
for (let i = 0; transitions.length < 200 && ...) // target transitions
```
No other changes required — the layered generator fills to any target.

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
| `useMermaid` content keys | `[stateKey, transKey]` instead of `[workflow]` — prevents stale memo |
| `resetCount` key on DiagramPane | Increments on Reset → React remounts DiagramPane → Mermaid DOM wiped |

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

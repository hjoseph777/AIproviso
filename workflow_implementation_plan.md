# Implementation Plan — Workflow Designer (Direct Integration)

## Goal

Implement the workflow designer directly inside the main application module path, ship collaboration now, and defer backend save/load wiring until workflow UX is approved.

---

## Locked Decisions (2026-05-29)

1. Integration model: direct integration in the main app — no separate standalone app phase. ✅ Done
2. Collaboration: enabled in the current implementation stream. ✅ Done (BroadcastChannel baseline)
3. Canonical package: `@xyflow/react` v12 only. ✅ Done
4. Day-1 gate: palette drag/drop + custom node + custom edge + live inspector + undo/redo. ✅ Done
5. Persistence: keep workflow persistence local until explicit sign-off, then connect backend. ✅ Active policy

---

## Phase 1 — Foundation ✅ COMPLETE

### Setup

- Working module path: `src/modules/workflow-designer/`
- Installed: `@xyflow/react`, `elkjs`, `zustand`, `xstate`, `@xstate/react`
- Note: `@zustand/temporal` is **not** installed — custom 50-deep undo/redo stack is used instead

### Core Canvas

- ReactFlow v12 initialised via `@xyflow/react`
- Zoom / Pan / MiniMap (210×158, z-index 30, pannable, zoomable) / Controls — all active
- Bootstrap layout on workspace switch — ELK bundle pre-loaded on component mount

### State Management (Zustand 5)

Store shape (active):

```
rfNodes, rfEdges
selectedNodeId, selectedEdgeId
activeId, activeDefinition
historyStack (custom 50-deep, not @zustand/temporal)
workflows[], users[], properties[], rules[]
collaborativeSnapshot support
```

---

## Phase 2 — UX Features ✅ COMPLETE

### Custom Nodes

- `WorkflowStateNode` — 6-kind AP node cards (initial/approval/technical/exception/terminal/standard)
- `NodeResizer` from `@xyflow/react` — resize handles on selected nodes ✅ Pro feature
- `NodeToolbar` from `@xyflow/react` — Focus/Duplicate/Delete on selected nodes ✅ Pro feature
  - ⚠️ **Known issue**: NodeToolbar uses Tailwind CSS class names not installed in this project. Needs inline-style replacement.
- Linter badges: `⚠ No Exit` / `⚠ Unreachable`
- Remote-presence avatars (coloured initials) on nodes
- Path-highlighting (hover dims unrelated nodes/edges)

### Custom Edges

- `InteractiveBezierEdge` — active edge renderer (registered as `bezierTransition`)
- `getBezierPath` curvature 0.4 with directional source/target positions
- Semantic colour engine: approve=green, reject=red, escalate=orange, review=blue, complete=purple
- Pill labels with solid dark background, inline editing on double-click
- 16px transparent hit-area for easy clicking
- Animated dashes for `delayPolicyId` transitions
- Remote-presence edge colouring (collaborator hue when focused)
- `BezierTransitionEdge.jsx` is a one-line re-export shim pointing to `InteractiveBezierEdge` — can be removed

### Undo / Redo

- Custom 50-deep history stack in `useWorkflowStore`
- `Ctrl+Z` / `Ctrl+Y` — active

### Day-1 Gate — Passed ✅

- Palette drag/drop ✅
- `WorkflowStateNode` custom card ✅
- `InteractiveBezierEdge` custom edge ✅
- `CanvasInspector` live editing ✅
- Undo/redo ✅

---

## Phase 3 — Auto Layout (ELK) ✅ COMPLETE

### ELK Config (active)

```
elk.algorithm = 'layered'
elk.direction = 'DOWN'
elk.edgeRouting = 'SPLINES'
elk.layered.mergeEdges = 'true'
elk.layered.thoroughness = '20'
elk.layered.spacing.nodeNodeBetweenLayers = '140'
elk.spacing.nodeNode = '130'
elk.spacing.edgeNode = '70'
elk.spacing.edgeEdge = '50'
elk.portConstraints = 'FIXED_SIDE'
```

### AP Lane Map

Post-ELK positions are overridden by a topology-aware AP lane map:

| State (regex) | laneX | laneY | Notes |
| :--- | :--- | :--- | :--- |
| received | 0 | 0 | Spine |
| extracted | 0 | 1 | Spine |
| matched | 0 | 2 | Spine |
| pending approval | 0 | 3 | Spine |
| manager | -1 | 4 | Left branch |
| cfo | 1 | 4 | Right branch |
| approved | 0 | 5 | Spine |
| exception | 2.8 | 1.5 | Exception column, staggered between layers 1–2 |
| escalated | 2.8 | 3.5 | Exception column, staggered between layers 3–4 |

### ⚠️ Known Issue — laneGapX Causes Node Overlap

**Current value: `laneGapX = 180`**

Node width is 220px. At `laneX = -1`, Manager is placed at `x = spineX - laneGapX = 220 - 180 = 40`. Manager spans `[40 → 260]` but the spine column starts at `x = 220`, spanning `[220 → 440]`. **Overlap: 40px.**

**Required fix**: `laneGapX ≥ nodeWidth + gap = 220 + 80 = 300`

Safe values to try: `laneGapX = 310`, `spineX = 250`, `laneGapY = 200`

### Layout Hooks

- `useElkLayout()` hook — `onComplete` callback sets `layoutReady`, triggers `frameNodesInCanvas`
- `fitView` uses `frameNodesInCanvas(centeredNodes)` for ELK-triggered fit (bypasses RF internal positionAbsolute lag)
- `api.fitView()` used for user-triggered Fit button
- Bootstrap dimension guard: defers if `rect.width < 80` (fires during CSS transition)

---

## Phase 4 — Execution Engine ✅ PARTIALLY COMPLETE

### XState Integration

- XState 5.32 installed and active
- `propertyInspectorMachine` — drives Canvas Inspector tab/mode state
- Canonical IR compiles definition → XState machine spec on demand
- XState does not mutate UI directly — strict separation maintained

### Pending

- Full runtime execution loop (workflow runs as XState machine against invoice data)
- `xstate-migrate` for version upgrades — not yet needed

---

## Phase 5 — Collaboration ✅ LIVE (Local Baseline)

### Current: BroadcastChannel (same-machine cross-tab)

```
CanvasSurface
  collaborationChannelRef  — BroadcastChannel instance
  collaborationSessionId   — namespaces sessions (user-editable in toolbar)
  collaborationClientIdRef — random per-tab identity
  presenceByClient         — Map of remote user presence state
```

Broadcast events:
- `presence-ping` — fires on every selection change; carries nodeId, edgeId, colour
- `workflow-snapshot` — fires on every rfNodes/rfEdges change (debounced); carries full workflow state

Node and edge rendering picks up `data.remotePresenceUsers` to show coloured avatar badges.

### Planned: Network Collaboration (Liveblocks or Partykit)

The BroadcastChannel scaffolding (session IDs, presence state, snapshot apply) is designed to swap with minimal changes:

1. Replace `new BroadcastChannel(...)` with a WebSocket/CRDT provider
2. `applyCollaborativeSnapshot` in the store handles incoming snapshots already
3. Presence pings become presence objects in the provider

---

## Phase 6 — Testing 🔲 IN PROGRESS

### Integrated Validation

- Canvas drag + drop ✅
- Layout + Optimize Paths ✅
- Undo/redo ✅
- Workspace switching (all 3 modes) ✅ verified with Playwright

### Performance

- 9-node AP flow: rendering and layout stable ✅
- 100+ node stress test: not yet run

---

## Phase 7 — Backend Wiring 🔲 DEFERRED (awaiting UX sign-off)

### Step 1 — Freeze UX behaviours

- UX approval gate must pass first
- Open issues before gate: `laneGapX` cramped layout, NodeToolbar CSS

### Step 2 — Connect APIs

- Save/load workflows (`POST /api/workflows`, `GET /api/workflows/:id`)
- Execution endpoints (invoice routing through XState machine)

### Step 3 — Feature-flag rollout

- Collaboration network tier gated behind tenant policy flag

---

## Phase 8 — Production Hardening 🔲 PLANNED

- Error boundaries (RuntimeErrorBoundary exists, needs expansion)
- Schema validation (Zod — partial)
- Workflow versioning
- JSON export / import (JSON view exists, export button wired)
- M-Files XML export (`.mfwf` format) — planned
- AP template library (one-click: 2-way match, 3-way match, CFO chain) — planned

---

## Deliverables

| Deliverable | Status |
| :--- | :--- |
| Integrated workflow designer in main app | ✅ Done |
| Collaboration-ready designer surface | ✅ Done (local baseline) |
| Network collaboration (Liveblocks / Partykit) | 🔲 Planned |
| Backend wiring plan | ✅ Documented, activation deferred |
| M-Files XML export | 🔲 Planned |
| AI authoring modes (1, 2, 3) | 🔲 Planned |

---

## Immediate Priority Fixes (Before UX Sign-off Gate)

1. **Fix `laneGapX`** — increase from 180 to ≥ 300 to eliminate node overlap
2. **Fix `NodeToolbar` CSS** — replace Tailwind class names with inline styles
3. **Remove dead files** — `SmartWorkflowEdge.jsx`, simplify `BezierTransitionEdge.jsx`
4. **Snap-to-grid** — not yet implemented, listed as Official in feature catalog

---

## Key Principle

Integrate directly → validate UX quality fast → wire backend only after sign-off.

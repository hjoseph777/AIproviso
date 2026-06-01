# AI Proviso — Master Skills & Status Log

> **Session anchor:** `WF-DESIGNER-PDR-V2-2026-05-29`
> **Canonical strategy doc:** `PDR_IntegratorWorkspace.md` — full build reference
> **PRD source status:** Latest detected file is `Proviso_PRD_v10.md`; no `PRD v11` file is currently present in this workspace.
> **Stack:** React 18 · `@xyflow/react` **v12.10.2** (React Flow Pro) · ELKjs v0.11 · XState 5 · Zustand 5 · Vite 6 · Electron 42
> **Note:** Tailwind CSS is **not installed** — styling uses CSS-in-JS / CSS modules only. NodeToolbar currently uses Tailwind class strings that have no effect.
> **Pro usage:** `@xyflow/react` exports 135 items. We currently import 15. See Pro Feature Gap section below.

---

## React Flow Pro — Feature Gap Analysis (v12.10.2)

### Currently used (15 of 135 exports)

`ReactFlow` · `Background` · `BackgroundVariant` · `ConnectionLineType` · `Controls` · `MiniMap` · `MarkerType` · `Position` · `BaseEdge` · `EdgeLabelRenderer` · `getBezierPath` · `Handle` · `NodeResizer` · `NodeToolbar` · `applyEdgeChanges` · `applyNodeChanges`

### High-value unused features — should implement

| Export | What it does | What it replaces in our code |
|--------|-------------|------------------------------|
| `getViewportForBounds` | Calculates exact viewport to fit a bounding box | Entire `frameNodesInCanvas` function (~50 lines of manual math + CSS-transition guard bug) |
| `getNodesBounds` | Returns bounding rect of a node set | Manual `minX/maxX/minY/maxY` loops |
| `useNodesInitialized` | Returns `true` once all nodes have `measured` | The `measured: {width,height}` workaround in `toRFNode` |
| `useInternalNode` | Access `positionAbsolute`, `measured` inside a component | The `positionAbsolute` lag debugging session |
| `useViewport` | Reactive `{x, y, zoom}` | Manual `viewport` useState + `onMove` callback |
| `Panel` | Positioned viewport-aware panel | Raw `position: absolute` toolbar divs |
| `useHandleConnections` | Live connections per handle | Manual incoming/outgoing count Maps in `nodes` useMemo |
| `getIncomers` / `getOutgoers` | Connected node utilities | Manual adjacency logic for linter badges |
| `useConnection` | Real-time connection-in-progress state | No connection preview feedback currently |
| `reconnectEdge` | Safe edge reconnection utility | Manual `updateEdgeProperties` source/target patch |
| `addEdge` | Safe add-edge with duplicate prevention | Manual edge creation in store |
| `ProOptions` | `{ hideAttribution: true }` | React Flow watermark is currently visible |
| `useKeyPress` | RF-integrated keyboard handler | Our custom `window.addEventListener` useEffect |
| `ViewportPortal` | Renders inside viewport coordinate space | Context menus could use this |
| `useReactFlow` | Full RF API hook | `canvasApiRef.current` direct ref access (brittle) |

### Available but not needed now

`BezierEdge` · `SmoothStepEdge` · `StepEdge` · `StraightEdge` · `SimpleBezierEdge` (built-in edge types), `getSmoothStepPath` · `getStraightPath` · `getSimpleBezierPath` (path utils), `useEdgesState` · `useNodesState` (uncontrolled mode), `ReactFlowProvider` (used implicitly by `ReactFlow`)

### Implementation priority order

1. `ProOptions` — one line, removes watermark. Do immediately.
2. `getViewportForBounds` + `getNodesBounds` — replaces `frameNodesInCanvas` and fixes cramped-viewport bug.
3. `useNodesInitialized` — clean solution to the blank-canvas-on-first-load edge rendering gate.
4. `Panel` — cleaner toolbar, no raw `position:absolute`.
5. `useViewport` — removes manual viewport state tracking.
6. `getIncomers` / `getOutgoers` — cleaner linter badge logic.
7. `useConnection` — better connection preview UX.

---

## Latest Checkpoint (2026-05-29)

### React Flow Pro Upgrade — What's Live

| Pro Component | Status | Notes |
|---------------|--------|-------|
| `@xyflow/react` v12.9 | ✅ Active | Core canvas, edges, handles, minimap, controls |
| `NodeResizer` | ✅ Active | Resize handles on selected nodes, min 190×120 |
| `NodeToolbar` | ✅ Active (CSS broken) | Focus/Duplicate/Delete on selected nodes — Tailwind class names don't resolve, needs inline-style replacement |
| `getBezierPath` | ✅ Active | curvature 0.4, directional source/target |
| `EdgeLabelRenderer` | ✅ Active | Floating pill labels above edges |
| `InteractiveBezierEdge` | ✅ Active | Collaboration-aware: changes stroke to collaborator hue when remote user is focused |
| BroadcastChannel collaboration | ✅ Active | Cross-tab same-machine sync; session ID namespacing; presence avatars on nodes + edges |
| Network collaboration (Liveblocks) | 🔲 Planned | Scaffolding ready; swap BroadcastChannel for WS provider |

### Canvas Cramped — Root Cause Identified

`laneGapX = 180` is less than node width (220px). Manager branch (`laneX: -1`) lands at `x = 220 − 180 = 40`, spanning `[40–260]`. Spine nodes start at `x = 220`. **Nodes overlap by 40px.** Fix: `laneGapX ≥ 300`.

### Files Changed This Session

- `src/modules/workflow-designer/canvas/nodes/WorkflowStateNode.jsx` — added `NodeResizer`, `NodeToolbar`, remote-presence avatars
- `src/modules/workflow-designer/canvas/edges/InteractiveBezierEdge.jsx` — collaboration-aware stroke/opacity
- `src/modules/workflow-designer/canvas/CanvasSurface.jsx` — BroadcastChannel collaboration, presence state, session ID toolbar input
- `src/modules/workflow-designer/store/useWorkflowStore.js` — `applyCollaborativeSnapshot`, store shape updates
- `src/modules/workflow-designer/canvas/edges/BezierTransitionEdge.jsx` — reduced to one-line re-export shim
- `workflowDesignerFeature.md` — full rewrite with Pro upgrade status
- `workflow_implementation_plan.md` — full rewrite with actual implementation state

### React Flow Pro — Full Implementation Complete (2026-05-29)

All priority fixes and Pro features shipped in one pass:

| Item | Status | Detail |
|------|--------|--------|
| Tailwind CSS v3.4 | ✅ Confirmed active | `tailwind.config.js` + PostCSS + `src/index.css` directives all present |
| `laneGapX` overlap fix | ✅ Fixed | `180 → 310` — Manager/CFO no longer overlap spine column |
| Dead files removed | ✅ Done | `SmartWorkflowEdge.jsx` deleted; `BezierTransitionEdge.jsx` shim deleted |
| `getViewportForBounds` + `getNodesBounds` | ✅ Active | Replaced entire `frameNodesInCanvas` manual math (~50 lines → 10 lines) |
| `ProOptions { hideAttribution: true }` | ✅ Active | Watermark hidden |
| `snapToGrid` + `snapGrid={[12,12]}` | ✅ Active | Nodes snap to 12px grid |
| `selectionOnDrag` | ✅ Active | Drag on canvas to select multiple nodes |
| `Panel` import | ✅ Imported | Available for use in sub-components |
| `useNodesInitialized` + `useViewport` | ✅ Imported | Available; `zoom` state still manual for toolbar display |
| `NodeResizer` | ✅ Active | Proper Tailwind handle/line classes |
| `NodeToolbar` | ✅ Active | Proper Tailwind styling — Inspect/Duplicate/Delete |
| `WorkflowStateNode` | ✅ Redesigned | Full Tailwind glassmorphism: kind-border, badges, animated pulse, presence avatars, linter |
| `InteractiveBezierEdge` | ✅ Redesigned | Tailwind pill labels, semantic icon prefixes (✓✕↩↑🔍✔), better glow |
| Toolbar `UnifiedBuilderToolbar` | ✅ Redesigned | Full Tailwind with `TBtn`/`TDivider` helpers, collab live badge, presence avatars, stats |
| Background | ✅ Upgraded | Dual-layer: `BackgroundVariant.Dots` + `Lines` for depth |
| Controls + MiniMap | ✅ Styled | Tailwind `className` on RF components for dark glassmorphism |
| `addEdge`, `reconnectEdge`, `getIncomers`, `getOutgoers` | ✅ Imported | Available for use |

### Runtime stability verdict — CONFIRMED STABLE (2026-05-29)

Full Playwright validation across all 3 workspace switch paths:

| Metric | Result |
|--------|--------|
| Nodes rendering | 9/9 ✅ |
| Edges rendering | 10/10 ✅ |
| Blank canvas states | 0 ✅ |
| RF warnings | 0 ✅ (getNodesBounds warning eliminated) |
| Other errors | 0 ✅ |
| NaN in settled DOM | **0** ✅ (zero NaN attributes in final rendered DOM) |

**NaN console warnings (~147/session) — Root cause identified and documented:**

These are transient intermediate render artifacts from React Flow v12's internal rendering pipeline. RF emits intermediate SVG renders with NaN viewport values during workspace transition animations — React catches these as `Warning: Received NaN for the %s attribute` — but **the final painted DOM has zero NaN attributes**. The canvas looks and behaves correctly.

- Cannot be fully eliminated without modifying RF's source code
- No suppression hack implemented (would hide real errors)
- The `{canvasReady && <Background/MiniMap/Controls>}` gates and `useLayoutEffect` reset reduce the window but RF's own internal edge markers and viewport SVG fire before any external gate can block them
- These are console-only, invisible to end users, and cause zero visible or functional issues

**Conclusion: Ready to ship for the designer UI layer. Runtime stability quality gate is passed.**

---

## PDR Integration Order — React Flow Pro Examples

Reference: `PDR_IntegratorWorkspace.md` §17

| Phase | Pro Example | Feature | Status |
|-------|-------------|---------|--------|
| 1 | `shapes-pro-example` | WorkflowStateNode custom card | ✅ Done |
| 1 | `remove-attribution-pro-example` | Hide RF watermark | ✅ Done |
| 1 | `helper-lines-pro-example` | 12px snap grid | ✅ Done |
| 1 | `editable-edge-pro-example` | Double-click transition editor | ✅ Partial (inline label edit, no full 4-tab editor) |
| 2 | `auto-layout-pro-example` | ELKjs layout | ✅ Done |
| 2 | `dynamic-layouting-pro-example` | Optimised redraw | ✅ Done (getViewportForBounds) |
| 2 | `libavoid-edge-routing` | Arrows route around nodes | 🔲 Not started |
| 2 | `node-position-animation-pro-example` | Smooth simulation transitions | 🔲 Not started |
| 3 | `copy-paste-pro-example` | Duplicate on right-click | ✅ Done (context menu) |
| 3 | `undo-redo-pro-example` | 50-state history | ✅ Done |
| 3 | `selection-grouping-pro-example` | Group AP sub-processes | 🔲 Not started |
| 3 | `expand-collapse-pro-example` | Sub-workflow collapse | 🔲 Not started |
| 4 | `collaborative-pro-example` | Multi-user sync | ✅ Partial (BroadcastChannel, not Liveblocks) |
| 4 | `server-side-image-creation-pro-example` | PNG/SVG export | 🔲 Not started |
| 4 | `freehand-draw-pro-example` | Annotation layer | 🔲 Not started |
| 4 | `parent-child-relation-pro-example` | Nested workflows | 🔲 Not started |

## PDR Core Features — Status

| PDR Section | Feature | Status |
|-------------|---------|--------|
| §4 State Box | Custom node card with left accent stripe | ✅ |
| §4 State Box | 4 progressive tabs (Basic/Actions/Flags/XState) | 🔲 |
| §4 State Box | Kind pill ghost style | ✅ |
| §4 State Box | Inline name edit | ✅ |
| §5 Transition Arrow | Bézier curvature 0.4 | ✅ |
| §5 Transition Arrow | Pill label solid dark background | ✅ |
| §5 Transition Arrow | Visual guard builder | 🔲 |
| §5 Transition Arrow | Style picker (right-click) | 🔲 |
| §6 Bidirectional Arrows | ±7px perpendicular offset | ✅ Done (2026-05-29) |
| §6 Bidirectional Arrows | Two-tab editor (A→B / B→A) | 🔲 |
| §7 Bézier Bend | Drag midpoint handle to reshape | 🔲 Removed (to fix render loop) |
| §8 Creation Modes | Mode 1 — Dataset templates | ✅ |
| §8 Creation Modes | Mode 2 — Blank canvas | ✅ |
| §8 Creation Modes | Mode 3 — AI scenario parser | ✅ (keyword NLP, not LLM) |
| §8 Creation Modes | Mode 4 — Preset Default | ✅ |
| §9 Auto Layout | ELKjs + fitView | ✅ |
| §9 Auto Layout | Optimize Paths button | ✅ |
| §10 Simulation Mode | Animated state transitions | 🔲 |
| §11 Collaboration | BroadcastChannel (same-machine) | ✅ |
| §11 Collaboration | Yjs + WebSocket (network) | 🔲 |
| §14 XState | Compile WorkflowDefinition → XState | ✅ |
| §15 UI Layout | Three-panel design | ✅ |
| §15 UI Layout | Floating command bar (Workflow Studio) | ✅ |

## Next Priority — From PDR

Ordered by client demo impact:

1. **State editor 4-tab panel** (PDR §4) — double-click node opens right-panel with Basic/Actions/Flags/XState tabs; currently just highlights node in inspector. This is the Day 3–4 deliverable.
2. **Bézier bend handle restored** (PDR §7) — drag midpoint to reshape. Was removed to fix render loop; needs a store-free implementation.
3. **Guard builder** (PDR §5) — visual condition builder in transition editor. Currently only label edit.
4. **Simulation mode** (PDR §10) — animated dot travels along edge path on state transitions.
5. **Yjs network collaboration** (PDR §11) — upgrade BroadcastChannel to Yjs+WebSocket for real cross-machine sync.

---

## Complete RF Pro v12.10.2 Feature Map — As-Built

Every component, hook, and utility from `@xyflow/react` v12 and its usage status.

### Components — Active

| Component | Used | Where |
|-----------|------|-------|
| `ReactFlow` | ✅ | `CanvasSurface.jsx` root |
| `Background` (dots + lines) | ✅ | Dual-layer background |
| `Controls` | ✅ | Zoom +/- buttons |
| `MiniMap` | ✅ | Bottom-right bird's eye |
| `Handle` | ✅ | 4-direction per node |
| `NodeResizer` | ✅ | Resize any selected node |
| `NodeToolbar` | ✅ | Inspect/Duplicate/Delete above node |
| `Panel` | ✅ | Toolbar positioned `top-left` |
| `BaseEdge` | ✅ | Visual Bézier path |
| `EdgeLabelRenderer` | ✅ | Floating pill labels |
| `ReactFlowProvider` | ✅ | Implicit via `<ReactFlow>` |

### Hooks — Active (via `ProRuntimeBridge` child component)

| Hook | Used | Effect |
|------|------|--------|
| `useViewport` | ✅ | Live zoom/x/y bridged to toolbar |
| `useNodesInitialized` | ✅ | Gates Background/MiniMap until nodes measured |
| `useConnection` | ✅ | "Connecting…" state bar feedback |
| `useReactFlow` | ✅ | Canvas API (`fitView`, `getNodes`, `getEdges`) |

### Hooks — Available, NOT yet called (next iteration)

| Hook | Opportunity |
|------|------------|
| `useHandleConnections` | Show connection count on handles for linter |
| `useNodeConnections` | Replace manual `incomingCounts`/`outgoingCounts` in nodes useMemo |
| `useOnSelectionChange` | Replace Zustand selectedNodeId selector |
| `useKeyPress` | Replace custom `window.addEventListener('keydown')` useEffect |
| `useInternalNode` | Access `positionAbsolute` without lag for edge anchor |
| `useNodesData` | Efficient per-node data selector |
| `useStore` / `useStoreApi` | Direct RF internal store access |
| `useUpdateNodeInternals` | Trigger handle re-computation after programmatic changes |
| `ViewportPortal` | Context menu that moves with canvas |

### Utilities — Active

| Utility | Used | Where |
|---------|------|-------|
| `getBezierPath` | ✅ | `InteractiveBezierEdge` path calculation |
| `getViewportForBounds` | ✅ | `frameNodesInCanvas` + PNG export |
| `getIncomers` / `getOutgoers` | ✅ | Imported (linter badge calculations) |
| `addEdge` | ✅ | Imported as `rfAddEdge` |
| `reconnectEdge` | ✅ | Imported as `rfReconnectEdge` |
| `proOptions { hideAttribution }` | ✅ | Watermark hidden |

### Utilities — Available, NOT yet called

| Utility | Opportunity |
|---------|------------|
| `getSmoothStepPath` | Alternative edge style for orthogonal flows |
| `getStraightPath` | Simple linear connections |
| `getConnectedEdges` | Alternative to manual edge filtering |
| `isEdge` / `isNode` | Type guards for mixed selections |
| `getNodesBounds` | Was removed (manual bounds used instead); restore for accuracy |

### RF Pro nodeTypes registered

| Type key | Component | Feature |
|----------|-----------|---------|
| `workflowState` | `WorkflowStateNode` | AP state card — 6 kinds, handles, toolbar, resizer |
| `workflowGroup` | `WorkflowGroupNode` | RF Pro parent-node grouping frame |

### RF Pro edgeTypes registered

| Type key | Component | Feature |
|----------|-----------|---------|
| `bezierTransition` | `InteractiveBezierEdge` | Bézier ±7px bidir offset, bend handle, pill label |

---

### What was built in this session (P2a–P3d)

**P2a — Backend workflow persistence API**
- Flask: `GET/PUT/POST/DELETE /api/workflows`, `POST /api/workflows/:id/publish`
- In-memory fallback (dev mode, no DB required)
- PostgreSQL `workflow_definitions` table auto-created on first use
- `workflowPersistence.js` API client service
- Store: `saveActiveWorkflow`, `loadWorkflowById`, `listRemoteWorkflows`, `publishActiveWorkflowToBackend`
- Debounced auto-save in `WorkflowDesignerShell` (2s after `isDirty`)

**P2b — Yjs network collaboration**
- `yjs` + `y-websocket` installed
- `scripts/collab-server.mjs` — standalone Yjs WebSocket server (`node scripts/collab-server.mjs`)
- `useYjsCollaboration.js` — drop-in adapter replacing BroadcastChannel
- Feature-flagged via `VITE_COLLAB_NETWORK=true` — BroadcastChannel fallback unchanged
- Session IDs, presence pings, snapshot broadcast all preserved

**P3a — State editor 4-tab panel**
- `CanvasInspector` NodeInspector now has 4 tabs: `📋 Basic` / `⚡ Actions` / `🚦 Flags` / `⚙ XState`
- XState tab: live-compiled read-only JSON preview of the selected state's XState config, Copy button
- `isDirty` shown in header sub-label ("unsaved")
- `activeDefinition` + `rules` passed through for real-time compilation

**P3b — Guard builder**
- `GuardBuilder.jsx` — visual condition rows (field / operator / value), AND/OR/NOT combinators
- Saves to `guard_registry` (Zustand `rules` array) as a reusable named guard
- UUID reference assigned to `edge.guard_id` on save
- Expression preview shown in green monospace, updates live
- Replaces the plain text input in the edge Basic tab

**P3c — RF Pro selection grouping**
- `WorkflowGroupNode.jsx` — RF Pro `NodeResizer` + dashed parent frame, violet accent
- Registered as `workflowGroup` in `nodeTypes`
- `groupSelectedNodes()` in `CanvasSurface` — select 2+ nodes → **▣ Group** button wraps them in a parent node with `expandParent: true`

**P3d — PNG export via RF Pro viewport utilities**
- `exportCanvasToPng()` in `CanvasSurface`
- Uses `getViewportForBounds` (RF Pro) to frame all nodes at export resolution
- Renders the `.react-flow__viewport` DOM to `<canvas>` via SVG foreignObject
- Graceful fallback to SVG download if Canvas render fails
- **↓ PNG** button in toolbar

### RF Pro features still to wire (next iteration)

- `useNodesInitialized` — clean gate for edge rendering (currently solved via `measured` in `toRFNode`)
- `useViewport` — can replace manual `zoom` useState in toolbar (needs sub-component inside ReactFlow)
- `getIncomers` / `getOutgoers` — can simplify linter badge logic in `nodes` useMemo
- `useConnection` — live connection-in-progress feedback

### Files touched in this checkpoint

- `src/modules/workflow-designer/canvas/edges/InteractiveBezierEdge.jsx`
- `src/modules/workflow-designer/canvas/edges/BezierTransitionEdge.jsx`
- `src/modules/workflow-designer/canvas/CanvasSurface.jsx`
- `src/modules/workflow-designer/engine/useElkLayout.js`

### Resume plan for tomorrow

1. Re-open Integrator Workspace and run `Optimize Paths` on at least two workflow variants.
2. Validate no transition overlaps in dense branches (manager/cfo + exception/escalated).
3. If overlap remains, tune only two safe knobs in `useElkLayout.js`: `elk.spacing.edgeEdge` and `laneGapX`.
4. Keep AP lane behavior generic (no name-specific lane offsets).
5. Re-run `npm run build` after each spacing adjustment batch.

---

## Workflow Designer Consolidation (2026-05-29)

Execution anchor:

- Follow `workflow_implementation_plan.md` as the operational step sequence for standalone-to-integrated delivery.

### Strategic decision

AI Proviso standardizes on **React Flow Pro** as the implementation baseline for the workflow designer, instead of continuing custom canvas infrastructure expansion.

### Why this is the right move

- Faster delivery with lower engineering risk: Pro workflow builder already covers most required canvas behavior.
- Better UX quality ceiling: polished interactions, stable controls, and consistent editing patterns out of the box.
- Cleaner product focus: team effort shifts from canvas plumbing to AP domain intelligence.
- Strong Tailwind fit: visual language can be elevated quickly while preserving engineering stability.

### Consolidated feature baseline (from Pro)

- Drag-and-drop from a sidebar palette
- Custom node cards
- Animated edges
- Snap-to-grid + grid controls
- Properties panel interaction pattern
- Built-in node resizer and node toolbar
- Interactive minimap
- Optional collaboration path (Liveblocks example)

### Dependency plan

Install and standardize:

- `@xyflow/react`
- `elkjs`
- `@zustand/temporal` (correct package namespace)
- `xstate-migrate`

Keep existing:

- `zustand`
- `xstate`
- `tailwindcss`

### Canonical stack normalization

Use one consistent stack naming convention across PRD, README, and implementation notes:

- Canonical canvas engine label: `@xyflow/react` v12 (React Flow Pro baseline).
- Do not duplicate with a second `react-flow v12` package label in stack tables.
- Canonical history package label: `@zustand/temporal` (never `@zustend/temporal`).
- Canonical component map for designer surface: `WorkflowStateNode`, `WorkflowTransitionEdge`, `FloatingPill`, `CanvasInspector`.

### Flexible implementation gates (timeline-agnostic)

This plan is intentionally outcome-based. Complete it in one day or multiple days; quality gates are the control point.

1. Foundation Gate: Activate React Flow Pro and clone the workflow-builder Pro example as the baseline.
2. Visual Language Gate: Replace node cards with `WorkflowStateNode` and apply Tailwind styling (kind stripe, badge system, handle treatment).
3. Transition Semantics Gate: Replace edges with `WorkflowTransitionEdge` (Bezier curvature 0.4, semantic color inheritance, delayed-transition dash animation, pill labels).
4. Interaction Gate: Add left palette tabs (Dataset, Scratch, AI Gen), drag ghost preview, and inspector slide panels on double-click.
5. State Integrity Gate: Wire `useWorkflowStore` with `@zustand/temporal`, live mutation flow, and PostgreSQL `loadDefinition` hydration.
6. Layout Reliability Gate: Integrate ELK auto-layout with AP topological ordering and deterministic `fitView` behavior.

### One-day fast-track option

If you execute in one intensive day, do not skip gates. Merge each gate only after a quick stability check (drag-drop, connect, edit properties, undo/redo, layout pass).

### Non-negotiable product rules

- Business view remains the default authoring experience.
- Runtime and Target remain overlays, not separate authoring systems.
- No Save button for standard property edits; state mutates live with auditable history.

### Workflow 2 Consolidation — AI Authoring Modes

All workflow modes are AI-powered. The distinction is authoring start point.

- **Mode 1:** AI customizes from the closest validated dataset record.
- **Mode 2:** AI assists while integrator draws from scratch.
- **Mode 3:** AI generates from a plain-language scenario.

Mode 1 correction (locked):

- Not template lookup.
- AI performs requirement-to-base diff customization.
- AI must produce explainable `diff[]` entries for every add/modify/remove change.
- Integrator approval gate is mandatory before activation.

Recommended implementation order:

1. Shared AI backbone first (retrieval + prompt chain + schema validator + diff formatter + approval APIs).
2. Mode 1 second (safest and highest-value production path).
3. Mode 2 third (inline copilot on top of the same backbone).
4. Mode 3 fourth (full generation after guardrails and review UX hardening).

Rationale:

- Mode 1 compounds competitive advantage fastest because each approved deployment strengthens the dataset and improves future AI customization quality.

---

## Product Overview

**AI Proviso** is a full-stack AP automation shell for M-Files consultants. It eliminates triple-entry — SOW → diagram → vault configuration — by making the workflow design surface the single source of truth that generates everything else.

Three personas, three distinct workspaces:

| Workspace | Persona | Purpose |
|-----------|---------|---------|
| **Client Workspace** | AP Clerk / Client | Invoice processing queue, approvals, audit trail, status monitoring |
| **Integrator Workspace** | Solutions Architect | Active canvas — design AP workflows, drag nodes, wire transitions, export to M-Files |
| **Operation View** | AP Supervisor | Read-only live monitor — invoice routing queue, pipeline trace, n8n webhook feed |

---

## Architecture

### Application Shell (`src/App.jsx`)

```
surface-shell
├── surface-sidebar          Icon nav bar (client + integrator nav items)
├── surface-main
│   ├── surface-topbar       Logo · workspace mode tabs · Upload button
│   ├── surface-ctxbar       Context breadcrumb / designer status strip
│   ├── surface-metrics      KPI row (Client only)
│   ├── surface-filterbar    Search + filter chips (Client AP view only)
│   └── surface-content
│       ├── ap view          Invoice table + detail panel
│       ├── exc view         Exception queues
│       ├── audit view       Audit trail
│       ├── wf view          Integrator Workspace canvas  ──┐ same route,
│       │                    OR Operation View monitor    ──┘ different render
│       ├── erp view         ERP mapping
│       └── ai view          AI Cockpit / RAG candidates
└── surface-footer           Live execution ticker
```

### Workspace Rendering Logic

The `wf` view renders conditionally on `workspaceMode`:

```
workspaceMode === 'operation'
  → OperationViewMonitor (invoice queue + pipeline trace + n8n feed, NO canvas)

workspaceMode === 'integrator'
  → IntegratorShell
      integratorCanvasMode === 'full'  → full-width WorkflowDesignerShell
      integratorCanvasMode === 'split' → invoice queue sidebar + WorkflowDesignerShell
```

### Workflow Designer Module (`src/modules/workflow-designer/`)

```
WorkflowDesignerShell.jsx        3-column shell (palette · canvas · inspector)
canvas/
  CanvasSurface.jsx              ReactFlow, ELK bootstrap, toolbar, context menu
  CanvasContextMenu.jsx          Right-click actions: node / edge / pane
  CanvasInspector.jsx            Right-panel node + edge property editor
  nodes/
    WorkflowStateNode.jsx        6-kind node card, handles, linter badges, dim
  edges/
    BezierTransitionEdge.jsx     getBezierPath curvature:0.4, pill label, hit-area
    WorkflowTransitionEdge.jsx   Semantic color utilities (KIND_COLORS, resolveEdgeColor)
engine/
  useElkLayout.js                ELKjs layered layout (DOWN, SPLINES, onComplete cb)
  workflowCanvas.js              Definition ↔ RF node/edge conversion
  workflowIR.js                  Canonical IR → XState / n8n compilers
store/
  useWorkflowStore.js            Zustand 5: CRUD, undo/redo (50-deep), validation
palette/
  workflowPalette.js             Drag-drop MIME serialization
```

---

## Implemented Features

### Canvas & Interaction

| Feature | Detail |
|---------|--------|
| Drag node from palette | MIME drag-drop with snap-to-start-zone |
| Double-click empty canvas | Quick-adds `standard` node at cursor |
| Drag whole card to move | Full card body is drag target in Select mode |
| 4-direction connection handles | `src-t/r/b/l` + `tgt-t/r/b/l` — visible on hover with colour glow |
| Connect from any handle | Drag from any of 4 cardinal sides to any node |
| Select / Connect mode toggle | Select = move nodes; Connect = crosshair, right-click-drag pans |
| Canvas pan + scroll zoom | Left-drag pan in Select; right-drag pan in Connect |
| Node inline rename | Double-click name → inline `<input>`, Enter/Escape |
| Delete node / edge | `Delete` / `Backspace` key |
| Duplicate node | `Ctrl+D` with offset |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` — 50-level history stack |
| Fit to view | RF native `api.fitView` with dimension guard |
| Auto-layout (ELK) | Full layered re-layout + fit |
| Optimize Paths | Re-runs ELK + fit — re-routes Bézier curves from current positions |
| Bootstrap on load | Runs once per workflow switch; pre-loads ELK bundle on mount |
| Lock / Unlock canvas | Prevents accidental edits; disables Connect mode when locked |
| Right-click context menu | Node: open/duplicate/add-connected/delete; Edge: rename/reverse/delete; Pane: quick-add kind |
| Path highlighting | Hover node → unrelated nodes + edges fade to 18% opacity |
| Linter badges | ⚠ No exit / ⚠ Unreachable inline on node header |
| Bird's-eye minimap | Color-coded node shapes, pannable, z-index 30, 210×158 fixed size |

### Bézier Transition Arrows

| Feature | Detail |
|---------|--------|
| `getBezierPath` curvature 0.4 | Balanced arc — parallel paths naturally diverge; no crossing even without explicit routing |
| Directional source/target positions | Computed from relative node centers — bottom→top for vertical flow, right→left for horizontal; `sourcePosition` / `targetPosition` on each edge |
| Semantic color engine | approve=green, reject=red, escalate=orange, review=blue, complete=purple; fallback=node kind color |
| Pill label (solid background) | Dark solid background hides edge line behind it; colour-matched border; floats at curve midpoint |
| Inline label editing | Double-click pill → edit in place, Enter/blur commits |
| 16px transparent hit-area | Thin curves are easy to click anywhere along their path |
| Coloured arrowhead | `MarkerType.ArrowClosed` colour matches edge semantic colour |
| Animated dashes for delay edges | `strokeDasharray 6 3` when `delayPolicyId` is set |
| Bend-point drag | Grab midpoint dot on selected/hovered edge → reshape to custom quadratic curve |
| Connection preview | Live Bézier preview while dragging a new connection, dashed |

### Node Cards — 6 State Kinds

| Kind | Colour | Use |
|------|--------|-----|
| `initial` | Green `#00C870` | Entry point; pulsing dot animation |
| `approval` | Amber `#E5B04C` | Human decision gate |
| `technical` | Cyan `#43BFD0` | Automated step (OCR, matching) |
| `exception` | Red `#FF5B73` | Rejection or exception path |
| `terminal` | Purple `#A78CFF` | End state |
| `standard` | Blue `#7EA7D4` | Generic step |

Node card also shows: kind icon + coloured left accent bar, assignee/SLA/tags footer chips, `Parallel x N` badge, `New` flash badge, validation error `!` badge, linter badges.

### ELK Layout Engine

| Setting | Value | Reason |
|---------|-------|--------|
| Algorithm | `layered` | Sequential top-down AP flows |
| Direction | `DOWN` | Invoice approval reads top-to-bottom |
| Edge routing | `SPLINES` | Smooth curves between nodes |
| Node spacing | 90px | Prevents overcrowding |
| Layer spacing | 100px | Clear step separation |
| Thoroughness | 15 | Better crossing minimization |
| Port constraints | `FIXED_SIDE` | Consistent handle placement |
| `unnecessaryBendpoints` | true | Cleaner edge paths |
| onComplete callback | Sets `layoutReady`, triggers `fitView` | Signals canvas to fit after layout |

### Canvas Inspector (right panel)

- **Node**: kind picker (6-pill grid), Basic tab (name/description/assignee/SLA/tags), Actions tab, Flags tab
- **Edge**: label, event type, guard selector, delay policy, pre/post actions
- Powered by `propertyInspectorMachine` (XState) for tab/mode state

### Workflow Management

- Multiple workflow tabs — add, rename, delete, switch
- JSON export: Business / Runtime / Target view modes
- Import from M-Files format via `seedImportedWorkflow`
- Stats grid: States / Transitions / Users / Properties / Rules

---

## Workspace Design — Segregation Rules

### Client Workspace
- AP invoice processing queue with live data from `/api/invoices`
- Metrics bar: total, confidence avg, pending approval, volume
- Filter chips, search, bulk approve, export
- Right-panel: invoice detail, workflow runtime trace, approve/review actions
- Live execution ticker in footer

### Integrator Workspace (canvas always visible)
- **Full Canvas** (default) — full-screen `WorkflowDesignerShell`
- **Data + Canvas** — invoice queue sidebar + canvas side-by-side
- Toolbar: Select / Connect / Layout / Optimize Paths / Fit / Lock / Undo / Redo
- Left sidebar: AP component palette (drag sources for 7 template types)
- Right panel: Canvas Inspector
- `🛠 INTEGRATOR BUILD WORKSPACE` label distinguishes from monitor views

### Operation View (read-only live monitor, NO canvas)
- KPI strip: Queue Depth · Active Invoice · Workflow State · Confidence · n8n Webhooks · **READ ONLY** badge
- Left: full invoice queue table — click to trace
- Right: Pipeline Trace (execution steps with ACTIVE indicator) + n8n webhook event list (9 events with green live dots)
- Footer: live execution ticker
- Distinct visual identity from Integrator — no palette, no editing tools, no canvas

---

## Workspace Switching — Bugs Fixed & Verified (2026-05-28)

Playwright verification of all switch paths. All pass.

| Path | Result |
|------|--------|
| Client → Integrator | ✅ Canvas fitted at `scale(0.75)`, 9 nodes / 10 edges |
| Integrator → Operation | ✅ Monitor loads, canvas preserved in memory |
| Operation → Client | ✅ AP queue intact, state preserved |
| Rapid: Integrator → Operation → Integrator | ✅ Canvas at correct sub-view, no Blueprint state leak |

### Bug 1 — Blueprint View sticking after rapid Operation→Integrator

`integratorSubview` was set to `'blueprint'` when entering Operation View but never cleared when switching back to Integrator. The effect guard `if (workspaceMode !== 'integrator' || activeView !== 'wf')` only reset on *leaving* integrator, not re-entering it.

**Fix:** Added `setIntegratorSubview(prev => prev === 'blueprint' ? 'data' : prev)` when entering integrator-wf. Preserves chosen sub-tab; clears operation-inherited state.

### Bug 2 — Initial viewport 0.34× zoom (nodes bunched in corner)

`frameNodesInCanvas` calls `surface.getBoundingClientRect()` during the CSS grid transition animation (`.cc-body` has a 280ms column-width transition). During the animation, `rect.width` returns near-0px → `usableWidth ≈ 1px` → computed zoom underflows → clamped to 0.34 floor.

**Fix:** Added `if (rect.width < 80 || rect.height < 80) { defer 220ms; retry }` guard in `frameNodesInCanvas`. By 220ms the animation has completed. Also raised zoom range from `[0.34, 0.86]` to `[0.25, 1.0]`. ELK bootstrap now pre-loads the bundle on mount (no import delay), and `onComplete` triggers `frameNodesInCanvas(centeredNodes)` using explicit ELK positions — bypassing RF's `positionAbsolute` lag entirely.

### Bug 3 — NaN SVG pattern errors on every switch

RF Background `<pattern>` x/y come from viewport dimensions. Canvas container has 0px dimensions on first render frame during workspace transition.

**Fix:** `min-height: 300px; min-width: 100px` on `.canvas-surface` CSS. Container is never 0px. Error count dropped from 210/switch to ~90 (first frame only, cosmetic).

### Bug 4 — Operation View identical to Integrator (both showed canvas)

Operation View was rendering `CommandCenter` (canvas editor) — same as Integrator Workspace. Users had no visual distinction.

**Fix:** Replaced Operation View content with a dedicated live operations monitor (KPI header, invoice queue, pipeline trace, n8n webhook feed). No canvas, no editing tools.

### Bug 5 — "Blueprint View" sub-tab hid canvas in Integrator

Clicking "Blueprint View" replaced the canvas with a static info page. Canvas invisible. Confusing UX.

**Fix:** Removed Blueprint View tab. Integrator now only has "Full Canvas" and "Data + Canvas" — canvas always visible.

---

## Critical React Flow v12 Lessons

These are non-obvious. Must be respected in all future work.

**1. `measured` must be set on nodes or edges won't render.**
RF v12 gates all edge rendering on `nodesInitialized` (all nodes have `measured: {width,height}`). RF does NOT derive `measured` from `width`/`height` props in `parseNode`. Set `measured: { width: 220, height: 110 }` in `toRFNode`.

**2. `sourceHandle`/`targetHandle` on edges causes silent drops.**
If the specified handle ID can't be resolved from RF's internal handle registry at render time, RF silently discards the entire edge. Never set these programmatically. Use `sourcePosition`/`targetPosition` instead for directional routing.

**3. Zustand subscriptions inside edge components cause render loops.**
Edge components render per-edge on every RF cycle. Subscribing to a store slice that changes on measurement (`rfEdges` via `applyCanvasNodeChanges`) creates thousands of re-renders. Only call stable selectors from edge components.

**4. `applyCanvasNodeChanges` must skip `fromRFState→toRFState` for non-structural changes.**
Dimension/select changes should only update `measured` — not recreate `rfEdges`. Added `isStructural` guard: full round-trip only for `add`/`remove`/`position` changes.

**5. `.react-flow__edges` is a `<div>` in RF v12 (was `<svg>` in v11).**
The edges SVG is created lazily inside this div only when `nodesInitialized` is true. `api.getEdges()` can return 10 edges while `domEdges === 0` — this means nodes aren't initialized yet.

**6. `api.fitView()` uses RF internal `positionAbsolute` — not the `nodes` prop.**
After ELK calls `updateNodePosition`, RF's internal `positionAbsolute` may lag by 1-2 render cycles. Use `frameNodesInCanvas(centeredNodes)` with explicit ELK positions instead. This bypasses RF's internal state entirely and is always accurate.

**7. `getBoundingClientRect()` returns 0 during CSS transitions.**
Any code that reads the canvas container size for layout must guard against `rect.width < 80`. Defer and retry after the transition settles (~220ms).

---

## Known Remaining Issues

| Issue | Priority | Notes |
|-------|----------|-------|
| NaN SVG pattern (~90/switch) | Low | First render frame before CSS min-height applies; cosmetic only |
| `onPaneDoubleClick` RF v12 warning | Low | RF v12 doesn't support this prop; passes to DOM div |
| `edgesUpdatable` RF v12 warning | Low | Renamed in v12; passes to DOM div |
| `connectionLineClassName` RF v12 warning | Low | Not in v12 API; passes to DOM div |
| Bidirectional edge overlap | Medium | A→B and B→A share path — offset detection removed to stop render loop |
| Initial `fitView` not always immediate | Low | CSS transition timing; 700ms fallback handles it but delay is perceptible |

---

## Phase 2 Roadmap (Not Started)

| Feature | Priority | Description |
|---------|----------|-------------|
| Quick-connect (+) on node hover | High | Hover handle → click → auto-add connected state |
| Multi-select + alignment toolbar | High | Align L/C/R/T/B/distribute for selected nodes |
| Transition condition builder | High | Visual UI for M-Files conditions (confidence ≥ X, amount ≤ $Y, PO matched) |
| State action binding | High | Entry/exit: notify, require signature, update property, script |
| M-Files XML export | High | `.mfwf` format for direct Admin import |
| AP template library | Medium | One-click: 2-way match, 3-way match, CFO chain, exception queue |
| M-Files import parser | Medium | Parse existing `.mfwf` XML into the designer |
| Keyboard shortcuts overlay | Medium | `?` shows all shortcuts |
| Bidirectional edge offset fix | Medium | Detect A↔B pairs, nudge them apart |
| Workflow version diff view | Low | Side-by-side visual diff of two versions |
| SLA timeline strip | Low | Visual timeline showing SLA durations per state |

---

## Backend & Infrastructure Notes

### Flask API (backend/app.py)
- `GET /api/dashboard/summary` — metrics bar data
- `GET /api/invoices` — invoice table with status/confidence/SLA
- `POST /api/invoices/:id/approve` — approve action
- `POST /api/invoices/:id/review` — send to review action
- `psycopg2` and `redis` imports are optional — fallback to dev data if missing
- Docker not yet operational on this machine (Linux engine pipe missing)

### n8n Integration (Week 1 — PASSED)
9 webhook events registered and verified: `invoice-received · invoice-extracted · invoice-matched · invoice-exception · invoice-resolved · invoice-approved · invoice-posted · invoice-rejected · audit-event`. All return `{"ack":true}`.

### M-Files COM Bridge (Phase III — paused)
- Tool boundary rule: AI Proviso does NOT talk to M-Files COM API directly
- Provisio (separate tool) exports `workflow.json` → `POST /api/workflows/import` → AI Proviso
- COM API bridge in Electron is removed from AI Proviso scope

### M-Files COM Quick Reference (for Provisio side)
```powershell
# CORRECT pattern (v26.x)
$app  = New-Object -ComObject MFilesAPI.MFilesClientApplication
$conn = $app.GetVaultConnection('Acme')
$vault = $conn.LogInAsUser(2, 'username', 'password', $null, $null)  # MFAuthType 2 = M-Files creds
$vault = $conn.LogInAs(0, 0, $false)                                  # MFAuthType 0 = Windows SSO
```
Vault: `Acme` · GUID: `{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}` · Server: `DESKTOP-DKCS42P`

---

## Dev Environment

```bash
npm run dev                # Vite browser dev server (port 3000)
npm run electron:dev       # Vite + Electron window
npm run electron:build     # Build → dist-electron/Proviso Setup.exe
```

Playwright for verification:
```js
const { chromium } = require('C:/Users/Owner/AppData/Local/npm-cache/_npx/4c085717babbf4e0/node_modules/playwright');
```
Window `__workflowStore` is exposed globally — use `window.__workflowStore.getState()` in Playwright evaluate for store inspection.

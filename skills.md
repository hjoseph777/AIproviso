# AI Proviso — Master Skills & Status Log

> **Session anchor:** `AI-PROVISO-PRD-V12-2026-06-01`
> **Last verified green:** `15/15 smoke test PASS` · commit `1b4be64` → `f936c5f`
> **PRD source:** `Proviso_PRD_v12.md` — canonical reference
> **Architecture diagram:** `AIProviso_stack_architecture.html` — open in browser
> **Stack:** React 18 · `@xyflow/react` **v12** (RF Pro $169) · Flask 3.1 · PostgreSQL 16 · Redis 7 · BullMQ · ELKjs · XState v5 · Zustand 5 · Vite 6 · Electron 42 · Lucide React · Tailwind CSS v3

---

## Runtime Gate — 15/15 PASS

**Command:** `powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1`

**Startup sequence:**
```powershell
# Set credentials (once — persists across restarts)
[System.Environment]::SetEnvironmentVariable("DATABASE_URL","postgresql://proviso:change-me@localhost:5432/proviso","User")
[System.Environment]::SetEnvironmentVariable("REDIS_URL","redis://localhost:6379/0","User")
[System.Environment]::SetEnvironmentVariable("ALLOW_DEV_FALLBACK","1","User")

# Start Flask
C:\Users\Owner\AppData\Local\Programs\Python\Python311\python.exe backend\app.py
```

| Step | What it tests |
|---|---|
| 1 | GET /health returns status=ok |
| 2 | PostgreSQL + Redis connected |
| 3 | Invoice intake → invoice_id returned, status=received |
| 4 | OCR stub fires → invoice reaches extracted state |
| 4b | workflow_timers shows 1 open timer after extraction |
| 5 | POST /api/invoices/:id/review returns item |
| 5b | Review endpoint returns status=review |
| 5c | Runtime view reflects exception state |
| 5d | Runtime trace recorded exception transition |
| 5e | Runtime reports 1 open timer after review |
| 6 | BullMQ timer callback job enqueued |
| 6b | Signed timer webhook updates runtime view |
| 6c | Latest timer diagnostic shows cancelled status |

**Gate policy:** 15/15 required to merge into `main`. Any score below is a release blocker.

---

## What's Done — Complete Feature Inventory

### React Flow Pro — 17/17 Active

| Feature | Where |
|---|---|
| Auto Layout | LayoutDeck — ELK SPLINES + AP flow order |
| Collaborative | Yjs CRDT + BroadcastChannel, CloudDeck ● Live |
| Copy & Paste | HistoryDeck + Ctrl+C/V + buffer state |
| Dynamic Layouting | ELK re-routes on node add (removed from auto) |
| Editable Edge | Drag midpoint bend handle in InteractiveBezierEdge |
| Expand / Collapse | CreationDeck Group + Fold buttons, toggle mode |
| Force Layout | LayoutDeck — D3 force physics |
| Freehand Draw | CreationDeck Draw mode + SVG stroke overlay |
| Helper Lines | Auto alignment guides on node drag |
| Libavoid Edge Routing | LayoutDeck ⊸ Route button — obstacle-aware orthogonal |
| Node Position Animation | Smooth pan + zoom when selecting a node |
| Parent-Child Groups | GroupNode with NodeResizer in container |
| Remove Attribution | `proOptions={{ hideAttribution: true }}` |
| Selection Grouping | `selectionOnDrag` + Group button |
| Server-Side Image Creation | CloudDeck ☁ SVG button |
| Shapes | 6 semantic state kinds — circle/diamond/dashed per kind |
| Undo / Redo | 50-deep history stack in useWorkflowStore |

### Workflow Designer Studio

| Component | Status | File |
|---|---|---|
| Action Deck System | ✅ 5 glassmorphic panels | `canvas/ActionDeckSystem.jsx` |
| IngestionHub | ✅ Replaces blocking modal | `canvas/IngestionHub.jsx` |
| WorkflowStateNode | ✅ Professional card, 8 handles, z-index fix | `canvas/nodes/WorkflowStateNode.jsx` |
| WorkflowGroupNode | ✅ Resizable parent-node frame | `canvas/nodes/WorkflowGroupNode.jsx` |
| InteractiveBezierEdge | ✅ Bend handle, line styles, libavoid waypoints | `canvas/edges/InteractiveBezierEdge.jsx` |
| CanvasSurface | ✅ Full RF Pro integration | `canvas/CanvasSurface.jsx` |
| CanvasInspector | ✅ 4-tab editor + XState preview | `canvas/CanvasInspector.jsx` |
| GuardBuilder | ✅ Visual condition rows | `canvas/GuardBuilder.jsx` |
| CanvasContextMenu | ✅ Right-click node/edge menu | `canvas/CanvasContextMenu.jsx` |
| WorkflowModeSelector | ✅ Legacy — exports only (AP_TEMPLATES, parseScenario, DEFAULT_WORKFLOW) | `canvas/WorkflowModeSelector.jsx` |

### Action Deck System (5 Floating Panels)

| Deck | Position | Contents |
|---|---|---|
| CreationDeck | Left center | 6 kind node buttons, Connect/Draw modes, Group/Collapse |
| LayoutDeck | Top center | Layout/Force/Fit/Paths/Route + live status bar |
| HistoryDeck | Bottom left | Undo/Redo/Copy/Paste/Lock/★Pro toggle |
| ContextDeck | Top right (context) | Node: Dupe/Delete. Edge: Curve/Arrow/Delete |
| CloudDeck | Top right | ● Live collab dot + PNG/SVG export |

### Project Container Model (PRD v12 §2.3)

| Feature | Status |
|---|---|
| `projects` table in PostgreSQL | ✅ Applied (via _ensure_projects_table) |
| `project_id` FK on `workflow_definitions` | ✅ Applied |
| Flask routes: GET/POST/PUT/DELETE /api/projects | ✅ Live |
| GET /api/projects/:id/workflows | ✅ Live |
| `useProjectStore` (Zustand) | ✅ Live |
| `projectPersistence.js` API client | ✅ Live |
| Project Bar in shell header | ✅ Live (pill + dropdown + new form) |
| IngestionHub Step 1: inline project creation | ✅ Live |
| `+ Workflow` gate: requires activeProjectId | ✅ Live |
| All modes gated on activeProjectId | ✅ Live |
| Bootstrap latch (`bootstrapReady`) | ✅ Live |
| Project-switch isolation + save/discard dialog | ✅ Live |
| `pillNudgeAt` store signal (header pill shake) | ✅ Live |
| State regression guard (`_STATE_ORDER`) | ✅ Live — blocks n8n double-fire |

### Backend (Flask Phase I)

| Feature | Status | Location |
|---|---|---|
| `_resolve_database_url()` | ✅ Reads env → .env → dev default | `backend/app.py:48` |
| Migration 006 applied | ✅ `rule_id` on `workflow_state_history` | Applied 2026-06-02 |
| `_simulate_ocr_dev()` dev stub | ✅ Fires 1s after intake in thread | `backend/app.py:~1460` |
| `_sync_workflow_transition_dev()` | ✅ Inline engine when MOD-04 unreachable | `backend/app.py:~1062` |
| `sync_timer_lifecycle()` dev inline | ✅ Direct DB write when engine down | `backend/app.py:~1168` |
| BullMQ relay thread | ✅ Processes failed Docker worker jobs | `backend/app.py:~2303` |
| `load_dotenv()` at startup | ✅ Loads .env from project root | `backend/app.py:29` |
| `workflow_definitions` schema aligned | ✅ `workflow_json`/`active` not `definition`/`status` | Fixed 2026-06-01 |

### Schema — Applied Migrations

| Migration | Applied | What |
|---|---|---|
| 001_initial_schema.sql | 2026-05-26 | Core tables |
| 002_rls_policies.sql | 2026-05-26 | Row-Level Security |
| 003_triggers.sql | 2026-05-26 | Triggers + check_workflow_simulation_pass() |
| 004_seed_data.sql | 2026-05-26 | Dev seed data |
| 005_workflow_runtime.sql | 2026-05-26 | workflow_state, workflow_state_history, workflow_timers |
| 006_workflow_history_rule_id.sql | 2026-06-02 | rule_id VARCHAR(150) + index on workflow_state_history |

---

## What's Next — Immediate Priorities

### Priority 1 — AI Configuration (Most Anticipated)
The user is excited about this layer. Everything in place to wire it:

| Task | What to do |
|---|---|
| Wire Mode 3 AI Generated | Connect IngestionHub `parseScenario` stub to actual Flowise/Ollama endpoint |
| Flowise prompt chain | Wire `_simulate_ocr_dev` replacement to real PaddleOCR + phi4-mini path |
| OCR confidence scoring | Connect to phi4-mini recovery for ambiguous invoice fields |
| Dataset Intelligence (PRD v12 §7A) | Project JSON as unit of learning — every deployment improves next |

### Priority 2 — Phase I → Phase II Transition
| Task | What to do |
|---|---|
| Replace OCR stub with real MOD-02 | PaddleOCR PP-OCRv4 + PP-Structure + OpenCV pipeline |
| Replace inline engine with MOD-04 | Real XState v5 service at workflow-engine:5100 |
| Replace Flask with Fastify | Fastify 4 gateway (per PRD v8 §4.5) |
| ERP config endpoints | /api/erp-configs wiring (currently 404 — Phase II) |

### Priority 3 — PRD v11/12 Functional Gaps
| Feature | Status |
|---|---|
| S4 Workflow activation | Requires simulation_runs with passed=true — trigger in place, UI flow needs wiring |
| ERP mapping path | Phase II — /api/erp-configs not wired yet |
| First-Run Wizard (7-day) | Phase II — defined in PRD v12 §12 |
| Vendor profile training | Phase II — PaddleOCR + pydantic pipeline |
| Dataset flywheel | Phase III — PRD v12 §7A |

### Priority 4 — UX Polish Remaining
| Task | Status |
|---|---|
| `WorkflowModeSelector.jsx` cleanup | Still 576 lines — only AP_TEMPLATES, parseScenario, DEFAULT_WORKFLOW needed. Could extract to `workflowTemplates.js` and delete modal. |
| New Project form spring animation | Done — `project-panel-enter` keyframe |
| Handle z-index fix | Done — `style={{ zIndex: 20 }}` on all 8 handles |
| Passive IngestionHub hub | Done — `opacity: 0.42, saturate(0.35)` when no project |

---

## Architecture Decisions Locked

| Decision | What it means |
|---|---|
| Project-first | No workflow can be created/saved/imported without activeProjectId |
| Nodes never auto-move | `scheduleAutoOptimize()` removed from all triggers — manual Layout/Force/Paths only |
| Fallback never replaces migration | ALLOW_DEV_FALLBACK=1 enables stubs; missing migrations must be applied explicitly |
| Smoke gate mandatory | 15/15 to merge to main — no exceptions per DOCKER_STACK.md |
| State regression blocked | _STATE_ORDER list in _sync_workflow_transition_dev prevents backward transitions |
| workflow_definitions active=FALSE | New workflows created as draft; check_workflow_simulation_pass() trigger blocks activation until simulation passes |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `backend/app.py` | Flask backend — all API routes, dev stubs, relay thread |
| `core/migrations/` | 001–006 SQL migration files |
| `src/modules/workflow-designer/canvas/CanvasSurface.jsx` | Main canvas component — RF Pro integration |
| `src/modules/workflow-designer/canvas/ActionDeckSystem.jsx` | 5 glassmorphic floating panels |
| `src/modules/workflow-designer/canvas/IngestionHub.jsx` | Canvas entry hub — project creation + mode selection |
| `src/modules/workflow-designer/store/useWorkflowStore.js` | Workflow Zustand store — nodes, edges, history, bootstrap |
| `src/modules/workflow-designer/store/useProjectStore.js` | Project Zustand store — projects, active, panel state |
| `src/modules/workflow-designer/store/projectPersistence.js` | Project API client |
| `src/modules/workflow-designer/store/workflowPersistence.js` | Workflow API client |
| `src/modules/workflow-designer/WorkflowDesignerShell.jsx` | Shell — project bar, view tabs, simulation, inspector |
| `src/modules/workflow-designer/canvas/nodes/WorkflowStateNode.jsx` | State node card — professional redesign |
| `src/modules/workflow-designer/canvas/edges/InteractiveBezierEdge.jsx` | Custom bezier edge — bend handle, line styles |
| `src/App.jsx` | App shell — workspaces, CSS, project pill |
| `DOCKER_STACK.md` | Runbook + schema verification + regression gate policy |
| `AIProviso_stack_architecture.html` | Full platform diagram — open in browser |
| `scripts/smoke-test.ps1` | 15-step runtime gate |
| `timer-worker/worker.mjs` | BullMQ consumer — calls /api/webhooks/workflow/timers/mark |

---

## Known Technical Notes

### Circular Import Pattern
`useWorkflowStore` imports `useProjectStore` via direct import (correct).
`useProjectStore` must NEVER import `useWorkflowStore` — causes module crash.
Shell (`WorkflowDesignerShell`) is the coordinator that orchestrates both stores.

### BullMQ Relay vs Docker DNS
Timer worker container calls `http://backend-api:5000` — Docker internal DNS.
When Flask runs on host (not Docker), `backend-api` doesn't resolve.
BullMQ relay thread in Flask polls `bull:workflow-timer-events:failed` sorted set
and processes jobs that failed with network errors. Remove when full Docker stack runs.

### workflow_definitions Schema
Live DB uses: `id, tenant_id, workflow_json, name, version, active, created_by, created_at, project_id`
Backend code historically used: `definition, status, updated_at` — FIXED 2026-06-01.
`active=FALSE` on INSERT — check_workflow_simulation_pass() trigger blocks `active=TRUE`
until `workflow_simulation_runs` record with `passed=true` exists.

### n8n Double-Fire (Regression Guard)
When intake fires `invoice.received` to n8n, n8n processes it and calls back ~2s later,
which would regress `workflow_state.current_state` from `extracted` back to `received`.
Fix: `_STATE_ORDER` list in `_sync_workflow_transition_dev` — transitions to a lower
state index are SKIPPED with a WARNING log.

### Database Credentials
- User: `proviso` / Password: `change-me`
- Database: `proviso` / Host: `localhost:5432`
- Confirmed working: `psycopg2.connect('postgresql://proviso:change-me@localhost:5432/proviso')`
- `_resolve_database_url()` in `backend/app.py` reads env → `.env` → dev default

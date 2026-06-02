# AI Proviso — Master Skills & Status Log

> **Session anchor:** `AI-PROVISO-PRD-V12-2026-06-02`
> **Last verified green:** `15/15 smoke test PASS` · commit `38bf8a1` · full Docker stack including workflow-engine
> **Session 3 commit:** `6ccb86b` · pgvector engine + 10-record seed + migration 008 + run-migrations fix
> **PRD source:** `Proviso_PRD_v12.md` — canonical reference
> **Architecture diagram:** `AIProviso_stack_architecture.html` — open in browser
> **Stack:** React 18 · `@xyflow/react` **v12** (RF Pro $169) · Flask 3.1 · PostgreSQL 16 · Redis 7 · BullMQ · ELKjs · XState v5 · Zustand 5 · Vite 6 · Electron 42 · Lucide React · Tailwind CSS v3

---

## ✅ AI-FIRST BUILD SEQUENCE — ALL 3 SESSIONS COMPLETE (2026-06-02)

### Session 3 COMPLETE — pgvector seeding + four-dimensional similarity scoring

**What was built:**

| Deliverable | File | Status |
|---|---|---|
| Schema v12 (§7A.6) | `core/migrations/008_dataset_v12.sql` | ✅ vector(768) + new tables |
| Four-dimensional scoring engine | `backend/similarity.py` | ✅ semantic·structural·config·context |
| 10 seed records (Canadian SME AP) | `backend/seed_dataset.py` | ✅ two-pass: insert → embed |
| `/api/dataset/status` | `backend/app.py:2299` | ✅ |
| `/api/dataset/find-similar` | `backend/app.py:2329` | ✅ |
| `/api/dataset/save` (flywheel) | `backend/app.py:2375` | ✅ |
| Mode 3 dataset candidates panel | `IngestionHub.jsx:554` | ✅ colour-coded similarity |
| Migration DB target fix | `run-migrations.ps1:99` | ✅ was `-d postgres`, now `-d $Database` |
| Post-migration verification | `run-migrations.ps1:112` | ✅ checks all §7A.6 objects in proviso |

**Run sequence to activate:**

```powershell
# 1. Apply migration 008
.\scripts\run-migrations.ps1

# 2. Pull embedding model (if not already)
ollama pull nomic-embed-text

# 3. Seed 10 records (two-pass: insert then embed, ~1-2 min)
python backend/seed_dataset.py

# 4. Verify
python backend/seed_dataset.py --status
curl http://localhost:5000/api/dataset/status

# 5. Test similarity search
curl -X POST http://localhost:5000/api/dataset/find-similar `
  -H "Content-Type: application/json" `
  -d '{"scenario_text":"Ontario manufacturer SAP invoice approval"}'
```

**Scoring weights (PRD v12 §7A.3):**

- Semantic × 0.40 — cosine similarity of nomic-embed-text vectors via pgvector
- Structural × 0.30 — state count, approval tiers, optional states
- Config × 0.20 — threshold amount + SLA hours proximity
- Context × 0.10 — industry + province + ERP exact/family match

**Dataset schema additions (§7A.6):**

- `workflows_dataset`: `province`, `erp_type`, `touchless_rate`, `state_count`, `threshold_amount`, `sla_hours`, `approval_tiers`, `document_types`, `pain_points`, `metrics`, `compliance_tags`, `embedding vector(768)`
- New tables: `project_version_history`, `project_dataset_refs`, `integrator_ai_access_log`

---

## 🔴 SESSIONS 1–3 HISTORY

**CONFIRMED BUILD SEQUENCE (agreed 2026-06-01, completed 2026-06-02):**

### Session 1 — Wire Mode 3 to Flowise ✅ COMPLETE
Replace the `parseScenario()` NLP keyword stub in `IngestionHub.jsx` (Mode 3 AI Generated)
with a real call to the Flowise API (`localhost:3001`). Goal: integrator describes an AP process
in plain language → phi4-mini via Flowise generates a real workflow definition.
This is the session that makes the Michel LeBrun demo credible as an AI-first platform.

**File to touch first:** `src/modules/workflow-designer/canvas/IngestionHub.jsx` → `handleConfirm()` Mode 3 branch

#### Session 1 — Definition of Done (DoD)

| Check | Pass Criteria |
|---|---|
| Mode 3 API call is real | `handleConfirm()` Mode 3 branch performs HTTP call to Flowise endpoint (no `parseScenario()` fallback path for normal run) |
| Response is mapped to workflow shape | Flowise response is transformed into workflow definition accepted by current canvas/store persistence path |
| Failure path is safe | Timeout/network/invalid payload returns clear UI error and does not corrupt existing canvas state |
| Smoke compatibility preserved | Existing 15/15 smoke test remains green after integration |
| Demo path works end-to-end | Plain-language AP prompt produces a visible generated workflow in designer |

#### Session 1 — Out of Scope

- OCR pipeline replacement (`_simulate_ocr_dev()` to PaddleOCR + phi4-mini)
- pgvector dataset seeding/scoring
- Fastify migration and MOD-04 runtime engine replacement

#### Session 1 — Blockers / Dependencies

| Dependency | Expected | If missing |
|---|---|---|
| Flowise API | Reachable at `http://localhost:3001` | Stop and resolve service health first |
| Model route | phi4-mini chain configured in Flowise | Use test chain with fixed output schema before wiring UI |
| Response schema | Stable JSON contract for workflow generation | Add schema guard + user-facing error |
| Timeout policy | Predictable response within agreed limit | Fail fast with actionable error text |

#### Session 1 — Verification Commands

```powershell
# Verify backend baseline still healthy
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1

# Verify Flowise endpoint is reachable (adjust route if needed)
curl http://localhost:3001
```

### Session 2 — phi4-mini OCR recovery path
Replace `_simulate_ocr_dev()` with real PaddleOCR PP-OCRv4 + phi4-mini two-stage pipeline.
Rule: deterministic pdfplumber/PaddleOCR runs first; phi4-mini only for fields below confidence threshold.
Validates PRD v12 §0.3 automation-first within AI-first.

#### Session 2 — Implementation Checklist

| Step | What must happen |
|---|---|
| 1 | Identify current `_simulate_ocr_dev()` call path and exact state transition side effects |
| 2 | Insert deterministic extraction stage first (`pdfplumber`/PaddleOCR) with normalized field output |
| 3 | Define field-level confidence threshold for escalation to phi4-mini |
| 4 | Send only low-confidence or missing fields to phi4-mini recovery layer |
| 5 | Merge deterministic + recovered fields into one canonical extraction payload |
| 6 | Record provenance per field: deterministic vs AI-recovered |
| 7 | Preserve current downstream runtime/state transitions so smoke behavior does not regress |
| 8 | Fail safely: if phi4-mini is unavailable, deterministic OCR result still returns |

#### Session 2 — Definition of Done (DoD)

| Check | Pass Criteria |
|---|---|
| Deterministic-first path enforced | OCR pipeline never calls phi4-mini when all required fields are above threshold |
| Recovery path selective | Only low-confidence or missing fields are sent to phi4-mini |
| Output contract preserved | Final extracted payload matches current backend/runtime expectations |
| Provenance visible in logs/data | It is possible to tell which fields came from OCR vs phi4-mini |
| Failure path safe | If AI recovery fails, invoice still advances with deterministic output or flagged review path |
| Runtime gate preserved | Existing smoke flow still passes or has an explicitly updated replacement check |

#### Session 2 — Risks / Watch Items

| Risk | Why it matters | Guardrail |
|---|---|---|
| Scope drift into full OCR rewrite | Can stall progress and break Phase I baseline | Keep focus on replacing stub with staged recovery only |
| Confidence threshold too vague | Causes overuse or underuse of phi4-mini | Define threshold before wiring model fallback |
| Latency spike | AI recovery on every field will slow intake badly | Restrict model calls to ambiguous fields only |
| Payload shape drift | Downstream review/runtime may break | Preserve current extracted payload contract |
| Missing provenance | Review/debug becomes opaque | Store source and confidence per field |
| Hard dependency on model availability | Local demos become fragile | Deterministic OCR must remain valid without AI |

#### Session 2 — Out of Scope

- Vendor profile training
- Full document understanding redesign
- Dataset flywheel / similarity scoring
- Fastify migration
- MOD-04 engine replacement

#### Session 2 — Verification Focus

```powershell
# Baseline runtime gate
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1

# Targeted manual check for OCR recovery path
# Intake a document with at least one ambiguous field and confirm:
# 1. deterministic extraction runs first
# 2. only low-confidence fields hit phi4-mini
# 3. final review payload remains valid
```

#### Session 2 — Sample Test Case

| Item | Expected Behavior |
|---|---|
| Input document | 1 invoice PDF where vendor name and invoice number are clean, but total amount or invoice date is visually ambiguous |
| Deterministic OCR result | Vendor name + invoice number extracted directly with high confidence |
| Recovery trigger | Total amount and/or invoice date falls below threshold or is missing |
| phi4-mini scope | Model sees only ambiguous field context, not a full unnecessary rewrite of already-confident fields |
| Final payload | One merged extraction result preserving current review/runtime contract |
| Provenance expectation | Clear indication that vendor/invoice number came from deterministic OCR and amount/date came from AI recovery |
| Acceptable failure mode | If recovery fails, invoice still enters review with ambiguous fields flagged rather than blocking intake |

### Session 3 — pgvector seeding and similarity scoring
Seed `workflows_dataset` with 142 records + embeddings. Wire four-dimensional similarity scoring (PRD v12 §7A).
Full flywheel: scenario → candidates ranked → diff proposed → workflow activated.
Completes the end-to-end AI-first demo story.

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

## 🛑 Recurring Issue — SQL 42601 Workflow Engine (Read This Before Touching workflow-engine/)

### What happened (twice)

**Error:** `INSERT has more target columns than expressions` (Postgres error 42601)
**File:** `workflow-engine/server.mjs` — `workflow_state_history` INSERT
**Column list (16):** tenant_id, invoice_id, workflow_state_id, workflow_definition_id, event_type, from_state, to_state, guard_name, rule_id, guard_result, action_summary, snapshot_json, triggered_by, trigger_source, **correlation_id**, recorded_at
**Before fix:** `VALUES ($1,...,$14,now())` — `correlation_id` ($15) was missing
**After fix:** `VALUES ($1,...,$14,$15,now())` — now correct

### Why it recurred

The code was fixed in `server.mjs` but the Docker container was **not rebuilt**. The running container still had the old image with the broken SQL. The `worker.py` two-tier fallback masked it at the smoke test level — gateway passed, engine was still broken underneath.

### Prevention checklist — mandatory after any `workflow-engine/` change

```text
[ ] 1. Edit server.mjs
[ ] 2. Count INSERT columns vs VALUES manually for every changed INSERT
[ ] 3. docker compose build workflow-engine
[ ] 4. docker compose up -d workflow-engine
[ ] 5. Wait for: docker ps shows (healthy) for proviso-workflow-engine
[ ] 6. Run smoke test against full stack (not just Flask standalone)
[ ] 7. Confirm no "workflow-engine advance failed" in Flask logs
         — if fallback fires, the engine is still broken
```

### How to verify the engine is being used (not bypassed)

In Flask logs after intake, you should see:

```text
# GOOD — engine responded directly:
workflow-engine advance OK for invoice=... state=extracted

# BAD — engine failed, fallback fired:
workflow-engine advance failed (...) — using dev inline path
```

If you see the fallback firing, the engine container has the bug. Rebuild it.

### Audit command — check all INSERTs in server.mjs

```bash
# Count $N params in each INSERT VALUES clause and compare to column count
grep -n "INSERT INTO workflow_" workflow-engine/server.mjs
# Then manually count: columns in the ( ) list vs $N params + literal values in VALUES ( )
# now(),now() = 2 values | 'scheduled' = 1 value | $N = 1 value each
```

### Schema drift pattern
When a migration adds a column to `workflow_state_history` (e.g., migration 006 added `rule_id`), any INSERT for that table that was written before the migration needs a corresponding `$N` added to the VALUES clause AND a value added to the params array. These must be done together — missing either one causes 42601.

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

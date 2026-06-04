# AI Proviso — Master Skills & Status Log

> **Session anchor:** `AI-PROVISO-PRD-V12-2026-06-04`
> **Last verified green:** Sessions 1–5B complete · `verify_s6.py` gates 1–5 PASS · commit `d15272c`
> **Approach (updated 2026-06-04):** Complete full Phase I → internal pre-hardening validation (Harry) → Philippe + Harry hardening → Michel LeBrun demo
> **PRD source:** `Proviso_PRD_v12.md` · §0.12 updated with mandatory execution order and pre-hardening gate
> **Architecture diagram:** `AIProviso_stack_architecture.html` — open in browser
> **Stack:** React 18 · `@xyflow/react` **v12** (RF Pro $169) · Flask 3.1 · PostgreSQL 16 · Redis 7 · BullMQ · ELKjs · XState v5 · Zustand 5 · Vite 6 · Electron 42 · Lucide React · Tailwind CSS v3

---

## 🔴 NEXT — Session 6 (Phase I Feature Completion)

**Approach change locked (2026-06-04):** Do not demo until the full application is built, internal pre-hardening validation is green, and Philippe signs off on hardening. Sessions 4, 5A, 5B complete. Session 6+ builds remaining Phase I features. Internal validation comes first, hardening follows with Philippe, demo comes last.

### Build sequence to demo

| Phase | What | Owner | Status |
| --- | --- | --- | --- |
| Sessions 1–5B | AI backbone + dataset intelligence + flywheel | Harry | ✅ Complete |
| Session 6+ | Remaining Phase I features (AP Workbench polish, UI gaps, any missing states) | Harry | 🔴 Next |
| Internal pre-hardening validation | Programmatic + scenario validation in build environment (`verify_s4.py`, `verify_5b.py`, `verify_s6.py` gates 1–5, Gate 6 walkthrough) | Harry | ⬜ Blocked until Session 6+ scope complete |
| Hardening | Reliability testing — same walkthrough 3× on different days | Philippe + Harry | ⬜ Not started |
| Demo | Michel LeBrun walkthrough — Gate 6 script, no stubs | Harry presents | ⬜ After hardening |

### Hardening gate (Philippe sign-off required before demo)

- Precondition: Internal pre-hardening validation completed and recorded
- `verify_s4.py` PASS
- `verify_5b.py` 9/9 PASS
- `verify_s6.py` gates 1–5 PASS
- Gate 6 manual walkthrough: 5 steps, 8-minute budget, 3 clean runs on 3 different days
- Philippe confirms platform is demo-ready

**Demo is not scheduled until Philippe signs off.**

---

### Session 6 — scope (to be defined at session open)

Feature inventory audit at session start. Candidate items:

- AP Workbench UI completeness (invoice review, exception queue, timer display)
- Workflow state machine edge cases (missing transitions, guard validation)
- Any gaps identified by the verify_s6.py Gate 5 intake path under failure conditions
- UI polish: IngestionHub Mode 1 (AP Templates) wired to real workflow load path

**Rule:** Scope is fixed at session open. No scope expansion mid-session. Each change closes with a verifier run.

---

### Session 4 — Diff Approval UI (PRD §7A.4) ✅ COMPLETE

**Why this was the right move:** Sessions 1–3 closed the AI suggestion layer. Session 4 closes the integrator authority layer — turning "AI suggests" into "integrator controls and approves." This is the missing trust layer in the Michel LeBrun story.

#### Definition of Done

| # | Check | Pass Criteria |
| --- | --- | --- |
| 1 | Threshold is server-traceable | `SIMILARITY_DIFF_THRESHOLD` env var (default 0.60) read at startup. `find-similar` response includes `"threshold": 0.60`. `apply-diff` endpoint enforces the threshold server-side — rejects if candidate score < threshold regardless of what the UI sends |
| 2 | Diff Panel appears only above threshold | Panel renders only when top candidate `similarity_pct >= threshold`. Below threshold → AI generation proceeds without diff prompt |
| 3 | At least one action required | "Apply approved diffs" button is **disabled** until integrator has explicitly Accepted or Rejected at least one diff item |
| 4 | Single write path — replayable diff shape | On "Apply", one INSERT writes `diff_proposed` (all items), `diff_accepted` (accepted), `diff_rejected` (rejected). Each item stored as `{field, from_value, to_value, reason, field_type, apply_operation}` — shape that can be replayed for audit and regression without human intervention. No partial writes |
| 5 | Safe fallback | If diff application fails for any reason, workflow is created from the base candidate JSON unchanged. No error shown to user beyond a passive badge. Source record in `workflows_dataset` is never mutated |
| 6 | Glassmorphic panel matches existing design system | Diff Panel uses `GLASS` constant + `SPRING` easing from `IngestionHub.jsx`. No new design tokens |
| 7 | Smoke gate preserved | Existing 15/15 smoke test remains green after Session 4 changes |

**Replayable diff item shape** — every item in `diff_proposed`, `diff_accepted`, `diff_rejected` must carry:

```json
{
  "field":           "threshold_amount",
  "from_value":      25000,
  "to_value":        30000,
  "reason":          "higher threshold described in scenario",
  "field_type":      "numeric",
  "apply_operation": "replace"
}
```

`field_type` is one of: `numeric`, `duration`, `state_add`, `state_remove`. `apply_operation` is one of: `replace`, `add`, `remove`. This shape allows a future replay pass to re-apply or reverse any diff without re-running the LLM.

#### What to build

**Config — `backend/app.py` startup:**

```text
SIMILARITY_DIFF_THRESHOLD = float(os.environ.get("SIMILARITY_DIFF_THRESHOLD", "0.60"))
```

Exposed in `find-similar` response: `{"candidates": [...], "threshold": 0.60, "records_searched": 16}`

**Backend — `POST /api/dataset/apply-diff`** (~50 lines in `app.py`):

```text
Input:  { base_record_id, diff_accepted: [...], diff_rejected: [...], tenant_id }
Guards: reject if candidate similarity_score < SIMILARITY_DIFF_THRESHOLD
Action: 1. Load base workflow_json from workflows_dataset
        2. Apply accepted diffs to a copy (threshold, SLA, state additions)
        3. Build diff_proposed = diff_accepted + diff_rejected (full set)
        4. INSERT into project_dataset_refs — one write, replayable shape
        5. Return { workflow_json: <patched copy>, ref_id, threshold_used }
On error: return base workflow_json unchanged, ref_id null
```

**Frontend — `DiffPanel` component in `IngestionHub.jsx`:**

```text
Trigger:  top candidate similarity_pct >= (threshold * 100) from response
Shows:    - Candidate header: project_name · similarity % · province · ERP
          - Diff list: each item as a row
              field label | current value → proposed value | reason | [Accept] [Reject]
          - Footer: "Apply N accepted changes" button (disabled until >= 1 action taken)
          - "Skip — use base" link (bypass diff, use candidate as-is)
On Apply: POST /api/dataset/apply-diff → canvas loads patched workflow
On Skip:  canvas loads base workflow_json directly
```

#### Out of scope for Session 4

- Growing the dataset (Session 5B)
- "Save to Dataset" flywheel button (Session 5A)
- ERP connectors, MOD-03, MOD-05, MOD-06 (Phase II/III — frozen)
- Any changes to the similarity scoring weights or seed records

#### Files to touch

| File | Change |
| --- | --- |
| `backend/app.py` | Add `SIMILARITY_DIFF_THRESHOLD` config var + `POST /api/dataset/apply-diff` |
| `backend/similarity.py` | Expose `threshold` in `find_similar()` return dict |
| `src/modules/workflow-designer/canvas/IngestionHub.jsx` | Add `DiffPanel` component + `handleApplyDiff()` handler |
| `skills.md` | Mark Session 4 complete after all 7 DoD checks pass |

---

### Session 5A — Flywheel write-back UX (after Session 4)

Wire "Save to Dataset" button in the canvas shell after workflow activation. `POST /api/dataset/save` already exists. UI needs: trigger point (post-activation), confirm dialog, success badge. One session, one endpoint call, no new schema.

### Session 5B — Dataset controlled expansion (after 5A)

Add records in batches of +10. After each batch: run a `find-similar` regression check to confirm ranking doesn't drift. Repeat until ~50 records. Target 142 for Phase I demo per PRD §7A.

### Phase II / III — FROZEN

Do not touch: ERP connectors (SAP, Dynamics, QuickBooks), MOD-03 Matching Engine, MOD-05 ERP Adapter, MOD-06 Exception Management, MOD-08 UI hardening. These do not appear in Phase I demo scope (PRD §2.1).

---

## ✅ AI-FIRST BUILD SEQUENCE — ALL 3 SESSIONS COMPLETE (2026-06-02)

### Session 3 COMPLETE — pgvector seeding + four-dimensional similarity scoring

**Verified checkpoint (2026-06-03):**

- `GET /api/dataset/status` => `total_records=16`, `embedded_records=16`, `ready=true`
- `POST /api/dataset/find-similar` => top record `Manufacturing AP - SAP 3-Way Matching`, `similarity_pct=65`, `semantic_score=0.745`
- Gate 1 PASS: candidate ranking correctness for Ontario + SAP + manufacturing query
- Gate 2 PASS: `project_dataset_refs` row writes with valid dataset link (`base_record_id`)
- Gate 3 PASS: `integrator_ai_access_log` auto-logs one row per returned candidate
- Audit PASS: `project_version_history` snapshot row written with JSONB payload
- Dataset expansion complete: +4 Quebec records, province distribution now `QC=7`, others `=9`

**What was built:**

| Deliverable | File | Commit |
| --- | --- | --- |
| Schema v12 (§7A.6) | `core/migrations/008_dataset_v12.sql` | `6ccb86b` |
| Four-dimensional scoring engine | `backend/similarity.py` | `6ccb86b` |
| Seed pipeline — 16 records, 7 QC | `backend/seed_dataset.py` | `6ccb86b` + `90f9d54` |
| `/api/dataset/status` | `backend/app.py:2299` | `6ccb86b` |
| `/api/dataset/find-similar` | `backend/app.py:2329` | `6ccb86b` |
| `/api/dataset/save` (flywheel) | `backend/app.py:2375` | `6ccb86b` |
| Mode 3 dataset candidates panel | `IngestionHub.jsx:554` | `6ccb86b` |
| Migration DB target fix (`-d postgres` bug) | `run-migrations.ps1:99` | `6ccb86b` |
| Post-migration schema verification | `run-migrations.ps1:112` | `6ccb86b` |
| Ollama `host.docker.internal` fallback | `backend/similarity.py:49` | `f5cfd35` |
| Quebec market expansion (+6 records) | `backend/seed_dataset.py` | `90f9d54` |

**Dataset — 16 records, all embedded (2026-06-03):**

| Province | Records | Industries |
|---|---|---|
| QC | 7 | Retail, Aerospace Mfg, Consulting, Healthcare, Food Distribution, Tech, Infrastructure |
| ON | 4 | Retail, Manufacturing, Healthcare, Logistics |
| AB · BC · MB · SK · NS | 5+ | Construction × 2, Logistics, Manufacturing, Healthcare (SK = 3, not 2) |

**Known runtime behaviour:**

- First `find-similar` after Flask restart: ~15–35s (Ollama cold-start + `host.docker.internal` 15s timeout before localhost fallback)
- Subsequent calls: ~4–8s once model is warm
- **Fix for cold-start**: change `.env` line to `OLLAMA_BASE_URL=http://localhost:11434` when running Flask directly on the host (not in Docker). The Docker value `host.docker.internal` is correct for container-to-container calls only.

**Correct SQL column names** (the other AI invents wrong ones — use these):

| Table | Correct columns |
| --- | --- |
| `project_dataset_refs` | `base_record_id`, `similarity_score` (DECIMAL 0–1 not %), `diff_proposed`, `diff_accepted`, `diff_rejected` |
| `integrator_ai_access_log` | `integrator_id`, `project_id`, `access_reason` |
| `project_version_history` | `tenant_id`, `project_id`, `version`, `version_notes`, `snapshot_json`, `changed_by` |
| `workflows_dataset` (new cols) | `province`, `erp_type`, `state_count`, `threshold_amount`, `sla_hours`, `approval_tiers`, `touchless_rate`, `document_types`, `pain_points`, `metrics`, `compliance_tags` |

**DB credentials (dev):** `postgresql://proviso:change-me@localhost:5432/proviso` · NOT `proviso_dev_password`

---

### Session 3 — Errors Encountered and Fixed

| # | Error | Root Cause | Fix | File / Line |
| --- | --- | --- | --- | --- |
| 1 | Migration DDL ran against `postgres` DB instead of `proviso` | `run-migrations.ps1:99` had `-d postgres` hardcoded — DDL executed in wrong database while schema_migrations table was written to correct one | Changed to `-d $Database`; added post-migration verification block that queries `information_schema` directly | `run-migrations.ps1:99` → `6ccb86b` |
| 2 | `semantic_score: 0.0` on all similarity results | `OLLAMA_BASE_URL=http://host.docker.internal:11434` in `.env` — socket times out after 45s when Flask runs directly on host (not in Docker) | Added `localhost:11434` as automatic fallback when URL contains `host.docker.internal`; reduced per-attempt timeout 45s → 15s | `backend/similarity.py:49` → `f5cfd35` |
| 3 | Flask 404 on all `/api/dataset/*` routes | Flask process (PID 36636) had started at 11:02 AM before routes were added to `app.py`; no hot-reload in production mode | Kill stale process, restart Flask | `Stop-Process -Id 36636 -Force` |
| 4 | Flask connection forcibly closed mid-request | Previous 30s PowerShell timeout left a broken pipe on the socket; Flask worker crashed on the next request | Restarted Flask; subsequent requests clean | Transient — resolved by restart |
| 5 | Wrong DB password in conformance script | Other AI used `proviso_dev_password`; actual password is `change-me` from `.env` DATABASE_URL | Use `postgresql://proviso:change-me@localhost:5432/proviso` | `.env` → confirmed |
| 6 | Other AI's conformance script: wrong column names | Script invented `dataset_record_id`, `similarity_pct` (int), `approved_by`, `diff_notes`, `version_label`, `change_summary`, `action`, `FROM projects` — none exist in migration 008 | Rewrote script against actual schema: `base_record_id`, `similarity_score` (DECIMAL 0–1), `diff_proposed/accepted/rejected`, `access_reason` | Conformance script rewritten inline |
| 7 | `IngestionHub` Mode 3 candidates always showed `0%` similarity | `Math.round((c.similarity \|\| c.score \|\| 0) * 100)` — API returns `similarity_pct` (already 0–100 int), not a 0–1 float | Changed to `c.similarity_pct ?? 0` with green/amber/grey colour coding | `IngestionHub.jsx:604` → `6ccb86b` |
| 8 | `IngestionHub` dataset fetch always threw "similarity lookup failed" | `fetchDatasetCandidates` checked `!data.ok` but endpoint returns `{candidates:[...]}` with no `ok` field | Removed `!data.ok` check; only check `!res.ok` (HTTP status) | `IngestionHub.jsx:157` → `6ccb86b` |
| 9 | `.venv` missing `psycopg2` — seed script would have failed if venv was selected | VS Code created `.venv` with Python 3.14 but never installed `requirements.txt` | Used system Python 3.11 (`C:\...\Python311\python.exe`) which already had all packages; optionally: `".venv\bin\python.exe" -m pip install -r backend\requirements.txt` | `.venv\bin\python.exe` |
| 10 | Ollama first-call latency ~35s even after fix | Model must load from disk into RAM on first inference call after Ollama restart (cold start) | Not a bug — expected behaviour; warm calls are 4–8s. To eliminate: keep Ollama running between sessions or pre-warm with a dummy embed call | `similarity.py` timeout chain |

---

**Run sequence to activate:**

```powershell
# 1. Apply migration 008
.\scripts\run-migrations.ps1

# 2. Pull embedding model (if not already)
ollama pull nomic-embed-text

# 3. Seed dataset (two-pass: insert then embed, ~1-2 min)
python backend/seed_dataset.py

# 4. Verify
python backend/seed_dataset.py --status
curl http://localhost:5000/api/dataset/status

# 5. Test similarity search
curl -X POST http://localhost:5000/api/dataset/find-similar `
  -H "Content-Type: application/json" `
  -d '{"scenario_text":"Ontario manufacturer SAP invoice approval"}'

# 6. (Current verified state)
# total_records=16, embedded_records=16, ready=true
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

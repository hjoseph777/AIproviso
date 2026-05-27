# AI Proviso — Phase & Week Progress Tracker

> **Last Updated:** May 25, 2026
> **PRD Reference:** [Proviso_PRD_v9.md](Proviso_PRD_v9.md)
> **Current Position:** Phase I · Week 1 complete

---

## Legend

| Symbol | Meaning |
| :--- | :--- |
| ✅ | Complete — gate passed or deliverable confirmed |
| 🔄 | In progress — actively being worked |
| ⬜ | Not started |
| 🔒 | Locked architectural decision — must not regress |
| ❌ | Blocked or failed |

---

## Locked Architectural Decisions

| # | Decision | Status |
| :--- | :--- | :--- |
| 1 | `PAPERLESS_OCR_MODE=skip` — MOD-02 owns all OCR, Paperless is archive only | 🔒 |
| 2 | Flowise flows are Git-tracked JSON — seeded via REST API, never mutated manually | 🔒 |
| 3 | Phase I scope: MOD-01 + MOD-02 + MOD-04 live. MOD-03 + MOD-05 stubs only | 🔒 |
| 4 | AI Proviso has no M-Files COM dependency — ingests only via `POST /api/workflows/import` | 🔒 |

---

## Phase I — Vertical Slice (Weeks 1–8)

**Target:** Michel LeBrun 12-week demo
**Demo Gate:** Working vertical slice — intake → extraction → approval → audit

| Week | Focus Area | Key Deliverables | Status | Gate |
| :--- | :--- | :--- | :---: | :---: |
| **Week 1** | MOD-00 + Infrastructure | Core schemas + all migrations · Docker Compose stack running · n8n event spine live · 9 webhook topics responding | ✅ | ✅ PASS |
| **Week 2** | MOD-01 — Intake | Email + HTTP document intake · `invoice.received` event firing · Paperless-ngx archive confirmed | ⬜ | ⬜ |
| **Week 3–4** | MOD-02 — OCR & Extraction | PaddleOCR + DocTR pipeline · Flowise LLM extraction flow · Per-field confidence scoring live | ⬜ | ⬜ |
| **Week 5** | MOD-07 — Audit | Audit event consumer wired · INSERT-only DB role confirmed · Basic audit log UI in MOD-08 | ⬜ | ⬜ |
| **Week 6** | MOD-04 — Workflow Engine | State machine live · Approval routing by amount threshold · react-flow designer scaffold | ⬜ | ⬜ |
| **Week 7** | MOD-08 — AP Workbench | Invoice queue with confidence colour coding · Inline field correction · Approval buttons | ⬜ | ⬜ |
| **Week 8** | Demo Hardening | MOD-03 + MOD-05 stubs polished · Simulation mode working · First-Run Wizard scaffold · Demo script rehearsed | ⬜ | ⬜ |

### Phase I — Gate Checklist (Michel LeBrun Demo)

- [ ] Intake triggers `invoice.received` within **500ms** of document arrival
- [ ] OCR ensemble extracts fields in **< 8 seconds / page** at **≥ 95% accuracy** on 50-invoice test set
- [ ] State machine routes mock invoices by amount threshold dynamically
- [ ] react-flow canvas loads, edits, and saves workflow JSON
- [ ] Mock simulation runs and generates sign-off audit PDF
- [ ] All 9 n8n webhook topics returning `{"ack":true}`

### Week 1 — Detailed Completion Log

| Item | Detail | Status |
| :--- | :--- | :---: |
| Docker Compose stack | All containers start clean, no port conflicts | ✅ |
| PostgreSQL 16 | Running on port 5432, persistent volume | ✅ |
| Redis 7 | Running on port 6379 | ✅ |
| n8n 2.22.3 | Running on port 5678, `N8N_SECURE_COOKIE=false`, PostgreSQL backend | ✅ |
| n8n bootstrap script | `scripts/create-n8n-workflows.ps1` — 9/9 webhook workflows created via API | ✅ |
| n8n Week 1 gate | All 9 paths return `{"ack":true}` — **PASS 9 / FAIL 0** | ✅ |
| Core DB migrations | `core/migrations/001_initial_schema.sql` applied | ✅ |
| COM bridge removal | 4 vault scripts deleted · IPC handlers removed · preload cleaned · PRD → v9 | ✅ 🔒 |
| skills.md | n8n 2.x lessons + tool boundary section documented | ✅ |

---

## Phase II — GUI Interface Design (Weeks 9–16)

**Target:** Demo-grade unified application shell with role-based views and mock-backed interactivity

| Week | Focus Area | Key Deliverables | Status | Gate |
| :--- | :--- | :--- | :---: | :---: |
| **Week 9** | Unified App Shell | Single React app shell · role-based sidebar visibility · Electron consultant mode + web client mode defined | ⬜ | ⬜ |
| **Week 10** | AP Workbench UI | Invoice queue · confidence bars · detail panel · inline edit states running on static mock data | ⬜ | ⬜ |
| **Week 11** | Integrator Cockpit UI | Workflow Designer · ERP Mapping · AI Cockpit panels rendered with mocked contracts | ⬜ | ⬜ |
| **Week 12** | Exceptions + Audit UI | Named exception queues · SLA visuals · audit trail screens · approval inbox interactions | ⬜ | ⬜ |
| **Week 13** | Contract-First API Shapes | Canonical response schemas locked in `MOD-00` · mock payloads match real API contracts exactly | ⬜ | ⬜ |
| **Week 14** | React Component Hardening | Keyboard flows · optimistic UI states · error/empty/loading states · responsive behaviour | ⬜ | ⬜ |
| **Week 15** | Story-Driven Demo Build | Michel demo path polished end-to-end with realistic mock data and click-through scenarios | ⬜ | ⬜ |
| **Week 16** | Wiring Readiness Gate | Component boundaries frozen · API hookup backlog sequenced · swap plan from mock to real endpoints approved | ⬜ | ⬜ |

### Phase II — Gate Checklist (GUI Readiness)

- [ ] Single React application renders correctly in Electron and browser-hosted modes
- [ ] Sidebar visibility is enforced by role for `consultant`, `tenant-admin`, `ap-operator`, `approver`, `reviewer`, and `ap-manager`
- [ ] AP Workbench, Workflow Designer, Exceptions, ERP Mapping, Audit Trail, and AI Cockpit all run with static contract-matching mock data
- [ ] Canonical mock payloads are documented and match planned production API response shapes exactly
- [ ] Demo path can be run without Docker dependencies beyond the frontend dev server

---

## Phase III — Pipeline Wiring & Pilot Hardening (Weeks 17–24)

**Target:** First pilot client deployment with real service integrations

| Week | Focus Area | Key Deliverables | Status | Gate |
| :--- | :--- | :--- | :---: | :---: |
| **Week 17** | MOD-03 — Matching Engine | 2-way / 3-way PO + receipt matching · Configurable tolerance rules | ⬜ | ⬜ |
| **Week 18** | MOD-05 — ERP Adapter | First live ERP connector (SAP or Dynamics 365) · Idempotent posting | ⬜ | ⬜ |
| **Week 19** | MOD-06 — Exception Logic | Named exception queues live · SLA timers and escalation chains wired to backend | ⬜ | ⬜ |
| **Week 20** | First-Run Wizard | All 8 wizard steps functional · client environment seeded in < 1 hour | ⬜ | ⬜ |
| **Week 21** | Security Hardening | RBAC enforced server-side · SoD policies · SSO integration · column-level PII encryption | ⬜ | ⬜ |
| **Week 22** | Backend Migration | Flask → Fastify (Node.js) API gateway · all routes migrated to production contracts | ⬜ | ⬜ |
| **Week 23** | Integration Testing | End-to-end pipeline test · BullMQ DLQ verified · multi-tenant RLS confirmed | ⬜ | ⬜ |
| **Week 24** | Pilot Hardening | Performance tuning · monitoring · first client onboarding dry run | ⬜ | ⬜ |

---

## Overall Progress Summary

```
Phase I  — Vertical Slice  ████░░░░░░░░░░░░  Week 1/8  (12.5%)
Phase II — GUI Design      ░░░░░░░░░░░░░░░░  Week 0/8   (0%)
Phase III — Wiring/Pilot   ░░░░░░░░░░░░░░░░  Week 0/8   (0%)

Total: Week 1 / 24  (4.2%)
```

---

## Module Status

| Module | Name | Phase | Status | Notes |
| :--- | :--- | :--- | :---: | :--- |
| MOD-00 | Core / Contract Layer | Always | ✅ | Schemas applied, event topics defined |
| MOD-01 | Document Intake | Phase I | ⬜ | Week 2 |
| MOD-02 | OCR & AI Extraction | Phase I | ⬜ | Week 3–4 |
| MOD-03 | Matching Engine | Phase III | ⬜ | Stub active until pipeline wiring begins |
| MOD-04 | Workflow & Approval | Phase I | ⬜ | Week 6 |
| MOD-05 | ERP Adapter | Phase III | ⬜ | Wired after GUI contracts are frozen |
| MOD-06 | Exception Management | Phase III | ⬜ | UI in Phase II, live backend in Phase III |
| MOD-07 | Audit Trail | Phase I | ⬜ | Week 5 — wired from day one |
| MOD-08 | Unified UI Layer | Phase II | ⬜ | One React app · role-based views · mock-first components before API hookup |

---

## n8n Webhook Topic Registry

| Topic | Webhook Path | Status |
| :--- | :--- | :---: |
| `invoice.received` | `/webhook/invoice-received` | ✅ |
| `invoice.extracted` | `/webhook/invoice-extracted` | ✅ |
| `invoice.matched` | `/webhook/invoice-matched` | ✅ |
| `invoice.exception` | `/webhook/invoice-exception` | ✅ |
| `invoice.resolved` | `/webhook/invoice-resolved` | ✅ |
| `invoice.approved` | `/webhook/invoice-approved` | ✅ |
| `invoice.posted` | `/webhook/invoice-posted` | ✅ |
| `invoice.rejected` | `/webhook/invoice-rejected` | ✅ |
| `audit.event` | `/webhook/audit-event` | ✅ |

**Week 1 Gate:** `PASS 9 / FAIL 0` — all returning `{"ack":true}` ✅

---

*AI Proviso · Xerox Canada · 2026 — Update this file at the end of each week or gate milestone.*

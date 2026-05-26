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

## Phase II — Full Pipeline (Weeks 9–16)

**Target:** First pilot client deployment

| Week | Focus Area | Key Deliverables | Status | Gate |
| :--- | :--- | :--- | :---: | :---: |
| **Week 9** | MOD-03 — Matching Engine | 2-way / 3-way PO + receipt matching · Configurable tolerance rules | ⬜ | ⬜ |
| **Week 10** | MOD-05 — ERP Adapter | First live ERP connector (SAP or Dynamics 365) · Idempotent posting | ⬜ | ⬜ |
| **Week 11** | MOD-06 — Exception Mgmt | Named exception queues · SLA timers · Escalation chains | ⬜ | ⬜ |
| **Week 12** | First-Run Wizard | All 8 wizard steps functional · Client environment seeded in < 1 hour | ⬜ | ⬜ |
| **Week 13** | Security Hardening | RBAC enforced · SoD policies · SSO integration · Column-level PII encryption | ⬜ | ⬜ |
| **Week 14** | Backend Migration | Flask → Fastify (Node.js) API gateway · All routes migrated | ⬜ | ⬜ |
| **Week 15** | Integration Testing | End-to-end pipeline test · BullMQ DLQ verified · Multi-tenant RLS confirmed | ⬜ | ⬜ |
| **Week 16** | Pilot Hardening | Performance tuning · Monitoring · First client onboarding dry run | ⬜ | ⬜ |

### Phase II — Gate Checklist (Pilot Deployment)

- [ ] Matching engine executes 2-way/3-way checks under configured tolerance rules
- [ ] ERP posting connects, posts, and registers reconciliation tokens idempotently
- [ ] Exception routing escalates SLA breaches to AP Managers in **< 60 seconds**
- [ ] First-run wizard seeds a client environment from scratch in **< 1 hour**
- [ ] RLS policies block reads/writes when `app.current_tenant_id` session context is missing

---

## Phase III — Scale & Learn (Weeks 17–24)

**Target:** Production General Availability

| Week | Focus Area | Key Deliverables | Status | Gate |
| :--- | :--- | :--- | :---: | :---: |
| **Week 17** | Form Builder | Drag-and-drop form builder complete · Form definitions stored as JSON | ⬜ | ⬜ |
| **Week 18** | App/Menu Builder | Drag-and-drop menu and app builder live | ⬜ | ⬜ |
| **Week 19** | SLA Analytics | SLA dashboard · Month-end AP analytics views | ⬜ | ⬜ |
| **Week 20** | Vendor AI Tuning | Per-vendor extraction profile fine-tuning on accumulated invoice history | ⬜ | ⬜ |
| **Week 21** | Template Library | RAG-powered workflow + form template library for new client onboarding | ⬜ | ⬜ |
| **Week 22** | Broader DMS | Contract management · NDA workflows · Approval chains beyond AP | ⬜ | ⬜ |
| **Week 23** | Load & Scale Testing | Queue depth testing · Horizontal OCR worker scaling verified | ⬜ | ⬜ |
| **Week 24** | GA Hardening | Final security audit · DR runbook · Production go-live checklist | ⬜ | ⬜ |

---

## Overall Progress Summary

```
Phase I  — Vertical Slice  ████░░░░░░░░░░░░  Week 1/8  (12.5%)
Phase II — Full Pipeline   ░░░░░░░░░░░░░░░░  Week 0/8   (0%)
Phase III — Scale & Learn  ░░░░░░░░░░░░░░░░  Week 0/8   (0%)

Total: Week 1 / 24  (4.2%)
```

---

## Module Status

| Module | Name | Phase | Status | Notes |
| :--- | :--- | :--- | :---: | :--- |
| MOD-00 | Core / Contract Layer | Always | ✅ | Schemas applied, event topics defined |
| MOD-01 | Document Intake | Phase I | ⬜ | Week 2 |
| MOD-02 | OCR & AI Extraction | Phase I | ⬜ | Week 3–4 |
| MOD-03 | Matching Engine | Phase II | ⬜ | Stub active in Phase I |
| MOD-04 | Workflow & Approval | Phase I | ⬜ | Week 6 |
| MOD-05 | ERP Adapter | Phase II | ⬜ | Stub active in Phase I |
| MOD-06 | Exception Management | Phase II | ⬜ | Week 11 |
| MOD-07 | Audit Trail | Phase I | ⬜ | Week 5 — wired from day one |
| MOD-08 | UI & Builders | Phase I+ | ⬜ | Week 7 AP Workbench · Phase III full builders |

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

# AI Proviso

AP-first automation platform for document-heavy business operations.

AI Proviso is built to solve integration nightmares while hiding complexity from end users. The system gives non-engineering teams a unified role-based workspace, deterministic-first document extraction, AI-assisted workflow generation, and reliable orchestration across enterprise systems.

## Problem We Are Solving

Most AP and workflow programs fail because teams are forced to stitch together fragile tools manually:

- invoice OCR in one product
- approvals and queues in another
- ERP posting in scripts
- audit and traceability in spreadsheets

This creates slow onboarding, repeated configuration work, and operational risk.

## Solution

AI Proviso delivers a no-code, modular platform where:

- documents are ingested and extracted with AI
- workflow routes are policy-enforced
- exceptions are queued with SLA and escalation
- ERP posting is orchestrated with idempotent patterns
- audit events are captured from day one

The product is designed as one React application with role-based views. Consultants use the full Electron-hosted shell, while client teams use the same UI in a browser with consultant-only areas hidden by role.

## Why AI Proviso Is Unique

- Integration-first architecture designed to eliminate cross-system brittleness.
- No-code setup designed for average business users, not engineers.
- Unified AP Workbench and Integrator Cockpit in one role-filtered application shell.
- Drag-and-drop workflow, form, and app builder experience.
- AI used where it matters most: targeted field recovery, confidence escalation, and workflow acceleration.
- Contract-first modular architecture so services can evolve independently.
- Semantic view modes let the same workflow open in clean business language by default, with runtime and target-specific overlays available on demand.

## Product Principles

- Fast onboarding and time to value.
- Zero passive pending states.
- Clear ownership for exceptions.
- Platform-agnostic import via `POST /api/workflows/import`.
- Service-native boundary for data, orchestration, OCR, and AI runtime.

## Architecture Summary

### Host-Native Boundary

- Electron desktop client for consultant mode
- Shared visual builders and workbench UI

### Browser Client Boundary

- Same React application served for client-side web access
- Sidebar and route visibility filtered by authenticated role

### Docker Service Boundary

- backend API gateway
- workflow-engine runtime for XState transition evaluation
- PostgreSQL 16 as master platform data
- Redis 7 for queue and caching support
- n8n notification and integration hooks
- Paperless-ngx document archive and previews
- OCR worker runtime
- Flowise orchestration
- Ollama API endpoint (external by default, optional local profile)

## Stack Layers

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Client Shell | Electron + Browser | Consultant desktop mode and tenant web mode from one codebase |
| Frontend | React + Vite | Contract-first UI, role-based navigation, no-code builders and workbench |
| API Layer | Flask sandbox (Phase I), Fastify gateway (target) | Gateway for module contracts |
| Workflow Engine | XState in dedicated Docker service | Transition evaluation from persisted workflow snapshots |
| Data Layer | PostgreSQL 16 + pgvector | Master transactional and retrieval storage |
| Cache and Queue | Redis 7 + BullMQ | Retry queues, buffering, async processing |
| Notifications and Integrations | n8n | Post-commit notifications and external calls |
| OCR and Doc Processing | OCR worker + pdfplumber + PaddleOCR + PP-Structure + Tesseract fallback | Native PDF extraction, OCR, structure recovery, and confidence scoring |
| Document Archive | Paperless-ngx + Gotenberg + Tika | Storage, thumbnails, conversion |
| AI Orchestration | Flowise | Prompt chains and agent orchestration |
| LLM Runtime | Ollama | Model inference over HTTP |
| Audit | Immutable audit events model | Traceability and compliance from day one |

## No-Code User Experience

The system is designed so non-engineers can configure and run workflows from one application shell:

- drag-and-drop workflow designer
- drag-and-drop form builder
- drag-and-drop menu and app builder
- spreadsheet-style AP workbench
- first-run setup wizard for onboarding

The workflow designer now follows a dual-engine cockpit model:

- `Business` view is the default authoring lens for operational states, approvals, exceptions, and SLAs.
- `Runtime` view overlays persisted rule IDs, guard names, route history, and live execution facts.
- `Target` view exposes compiled XState and n8n identities without forcing users into raw engine primitives.

Consultant-only capabilities such as Workflow Designer, ERP Mapping, and AI Cockpit are hidden from client operators by role instead of being split into separate applications.

## Workflow Compilation Model

AI Proviso keeps one canonical workflow model in the product shell and projects it outward to execution targets.

- The Proviso-native designer is the source of truth.
- XState is the semantic execution target for transitions, guards, and timers.
- n8n is the orchestration target for webhooks, notifications, and connector side effects.
- Runtime identifiers such as `rule_id`, `guard_name`, route history, and execution ticker events round-trip back into the Integrator cockpit for deterministic debugging.

### Custom React Designer & Semantic Lenses

Proviso decouples workflow design from runtime scaffolding execution. The UI surface in `CommandCenter.jsx` supports semantic overlays so integration mechanics can be inspected cleanly without degrading the default operator experience.

- **Abstract View:** clean, operator-first business flows rendered in the native Proviso canvas.
- **Engine View (Shiny Stars):** exposes backend-owned `rule_id`, `guard_name`, route history, and target-runtime metadata directly on the same canvas coordinates.
- **Target View:** reveals compiled XState and n8n identities without forcing data-model mutations or brittle text matching.

This means the designer stays business-language first while still supporting deep runtime inspection on demand.

To validate the core UI and backend compilation surfaces locally:

```bash
npm run build
python -m py_compile backend/app.py
```

## Delivery Approach

AI Proviso follows a component-driven, contract-first delivery model:

- build the React GUI first with static or local mock data
- define canonical response shapes in `MOD-00` and mirror them exactly in frontend mocks
- harden user flows, loading states, and interactions before wiring backend logic
- replace mocked data incrementally with real API calls once contracts are stable

For extraction persistence, workflow integrity, audit traceability, and model-development work, the authoritative development path is the Docker/PostgreSQL stack.

This keeps the demo always showable, reduces coupling between frontend and backend work, and avoids building endpoints the UI does not need.

Users should be able to get productive quickly because complexity is hidden behind guided setup and policy-driven automation.

## Service Separation Rules

- PostgreSQL is infrastructure, not embedded app data.
- PostgreSQL is also the primary development truth path for AP transactions, extraction outputs, workflow state, vendor learning, and audit evidence.
- XState is a pure workflow evaluator, not persistent state.
- Redis is infrastructure, not application state.
- n8n is notification and integration runtime, not business logic storage.
- Paperless-ngx is archive and preview service, not OCR source of truth.
- OCR extraction ownership belongs to the OCR worker pipeline using native PDF fast path first, OCR only when needed, and targeted LLM recovery only for ambiguous fields.
- Ollama is an external service by default, optional local profile for development.
- Electron remains outside Docker.
- M-Files COM interaction belongs to the **Provisio** tool (separate). AI Proviso ingests via `POST /api/workflows/import` only.

## PRD Source of Truth

Active product blueprint:

- Proviso_PRD_v10.md

The v10 PRD is the current build direction and should be treated as the canonical implementation reference.

## Model Development Policy

AI Proviso uses deterministic-first extraction with operational learning.

- corrected AP fields are the primary supervised signal
- extraction evidence persists through `invoice_extractions`
- vendor learning persists through `vendor_extraction_profiles`
- auditability persists through `audit_events`
- the current Docker-backed slice validates invoice, extraction, and audit persistence; human correction persistence remains a required next gate
- model-development work should validate against persisted PostgreSQL data, tenant isolation, and workflow state transitions

## Quick Start

Desktop client:

- npm install
- npm run electron:dev

Docker services:

- copy .env.docker.example to .env
- set required secrets and service endpoints
- docker compose up -d

Canonical development data path:

- for a clean rebuild: `docker compose down -v && docker compose up -d`
- run `pwsh -File ./scripts/run-migrations.ps1`
- use the ordered migration set in `core/migrations/001_initial_schema.sql` through `006_workflow_history_rule_id.sql` as the canonical dev baseline
- run `pwsh -File ./scripts/smoke-test.ps1`
- validate extraction and model-development outputs against persisted PostgreSQL records

Optional local Ollama profile:

- docker compose --profile local-ai up -d

## Repository References

- docker-compose.yml
- .env.docker.example
- backend/Dockerfile
- backend/requirements.txt
- backend/app.py
- workflow-engine/Dockerfile
- workflow-engine/package.json
- workflow-engine/server.mjs
- docker/postgres-init/01-create-databases.sh
- Proviso_PRD_v10.md
- Proviso_Change_Blueprint.md

## M-Files Integration Note

M-Files COM interaction is the responsibility of the **Provisio** tool (separate from AI Proviso).
AI Proviso receives pre-normalized workflow JSON via `POST /api/workflows/import` — it has no COM dependency, no M-Files vault credentials, and no Windows-only deployment requirement.

---

AI Proviso · Xerox · 2026

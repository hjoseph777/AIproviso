# AI Proviso

AP-first automation platform for document-heavy business operations.

AI Proviso is built to solve integration nightmares while hiding complexity from end users. The system gives non-engineering teams an intuitive drag-and-drop workspace, AI-assisted OCR and workflow generation, and reliable orchestration across enterprise systems.

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

The desktop experience is simple and visual for business users, while platform complexity is isolated in service modules.

## Why AI Proviso Is Unique

- Integration-first architecture designed to eliminate cross-system brittleness.
- No-code setup designed for average business users, not engineers.
- Drag-and-drop workflow, form, and app builder experience.
- AI used where it matters most: OCR extraction confidence and workflow acceleration.
- Contract-first modular architecture so services can evolve independently.

## Product Principles

- Fast onboarding and time to value.
- Zero passive pending states.
- Clear ownership for exceptions.
- Host-native boundary for Windows COM integration.
- Service-native boundary for data, orchestration, OCR, and AI runtime.

## Architecture Summary

### Host-Native Boundary
- Electron desktop client
- Visual builders and workbench UI
- Windows COM bridge utilities for M-Files integration

### Docker Service Boundary
- backend API gateway
- PostgreSQL 16 as master platform data
- Redis 7 for queue and caching support
- n8n orchestration hooks
- Paperless-ngx document archive and previews
- OCR worker runtime
- Flowise orchestration
- Ollama API endpoint (external by default, optional local profile)

## Stack Layers

| Layer | Technology | Purpose |
|:---|:---|:---|
| Client Shell | Electron | Desktop experience and local host integration |
| Frontend | React + Vite + react-flow | No-code UI builders and workbench |
| API Layer | Flask (current), Fastify (target) | Gateway for module contracts |
| Data Layer | PostgreSQL 16 + pgvector | Master transactional and retrieval storage |
| Cache and Queue | Redis 7 + BullMQ | Retry queues, buffering, async processing |
| Orchestration | n8n | Workflow hooks and integrations |
| OCR and Doc Processing | OCR worker + PaddleOCR + DocTR + Tesseract fallback | Extraction and confidence scoring |
| Document Archive | Paperless-ngx + Gotenberg + Tika | Storage, thumbnails, conversion |
| AI Orchestration | Flowise | Prompt chains and agent orchestration |
| LLM Runtime | Ollama | Model inference over HTTP |
| Audit | Immutable audit events model | Traceability and compliance from day one |

## No-Code User Experience

The system is designed so non-engineers can configure and run workflows:
- drag-and-drop workflow designer
- drag-and-drop form builder
- drag-and-drop menu and app builder
- spreadsheet-style AP workbench
- first-run setup wizard for onboarding

Users should be able to get productive quickly because complexity is hidden behind guided setup and policy-driven automation.

## Service Separation Rules

- PostgreSQL is infrastructure, not embedded app data.
- Redis is infrastructure, not application state.
- n8n is orchestration runtime, not business logic storage.
- Paperless-ngx is archive and preview service, not OCR source of truth.
- OCR extraction ownership belongs to OCR worker pipeline.
- Ollama is an external service by default, optional local profile for development.
- Electron remains outside Docker.
- Windows COM integration remains host-native.

## PRD Source of Truth

Active product blueprint:
- Proviso_PRD_v8.md

The v8 PRD is the current build direction and should be treated as the canonical implementation reference.

## Quick Start

Desktop client:
- npm install
- npm run electron:dev

Docker services:
- copy .env.docker.example to .env
- set required secrets and service endpoints
- docker compose up -d

Optional local Ollama profile:
- docker compose --profile local-ai up -d

## Repository References

- docker-compose.yml
- .env.docker.example
- backend/Dockerfile
- backend/requirements.txt
- backend/app.py
- docker/postgres-init/01-create-databases.sh
- Proviso_PRD_v8.md
- Proviso_Change_Blueprint.md

## M-Files Integration Note

M-Files COM integration is host-side and Windows-specific.
It is intentionally not containerized.

---

AI Proviso · Xerox · 2026

# AI Proviso PRD V2

> Legacy PRD snapshot.
> Superseded by `Proviso_PRD_v4.md`.
> Keep for design history only; do not use as the active implementation reference.

(Download alternative copy)

## Vision
AI Proviso is a simplified, AI-native workflow platform designed for non-technical users, replacing complex systems like M-Files with a Windows-like experience.

## Core Principles
- Simplicity first
- No coding required
- Config over development
- AI-assisted setup

## Architecture
- Frontend: React
- Backend: Fastify
- Database: PostgreSQL
- Workflow: n8n
- OCR: Paperless
- AI: Flowise + Ollama

## Metadata Model
- Class (Invoice, Contract)
- Properties (fields)
- Value Lists (vendors, etc.)

## Workflow
- State machine
- Transitions
- Approval + return

## UI
- Drag & Drop builder
- Forms builder
- Menu builder

## ERP Sync
- API polling every 10–15 min

## Outcome
- Onboarding in days, not months


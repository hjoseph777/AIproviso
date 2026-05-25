# AI Proviso

**AP-First Automation Platform · Electron Client + Docker Service Stack**

> Current state: workflow-builder desktop foundation preserved while the platform evolves toward AP automation, exception routing, and service-based orchestration.

## Overview

AI Proviso is evolving from a workflow-ingestion desktop tool into an AP-first automation platform.

The current application already provides:
- a native Electron desktop client,
- a spreadsheet-style workflow editor,
- live workflow diagrams,
- validation via Zustand + Zod,
- import/export flows,
- M-Files connectivity through Windows COM.

The current direction adds a Docker-first service layer around that client:
- PostgreSQL for platform data,
- n8n for orchestration,
- Paperless-ngx for document and OCR workflows,
- Flowise for AI workflow composition,
- Ollama as an external or optional local AI service,
- a backend API service for platform integration.

## Architecture Direction

### What stays in the app
- Electron desktop shell
- React workflow designer
- local editing experience
- Windows-specific M-Files integration

### What moves to services
- AP platform backend API
- orchestration runtime
- document ingestion and OCR
- persistent data storage
- AI workflow services

### Separation Principles
- PostgreSQL is infrastructure, not embedded app state.
- Redis is infrastructure, not bundled into the backend service.
- n8n is a separate orchestration service, not baked into the app.
- Paperless-ngx is a separate document service.
- Flowise is a separate AI workflow service.
- Ollama is treated as an external AI service by default.
- The Electron client remains outside Docker.

## Current Stack

| Layer | Technology |
|:---|:---|
| Desktop client | Electron 42 |
| Frontend | React 18 + Vite 6 |
| State and validation | Zustand 5 + Zod 4 |
| Diagram rendering | Mermaid.js |
| Windows integration | PowerShell + MFilesAPI |
| Backend API | Flask (current bridge service) |
| Database | PostgreSQL 16 |
| Cache and broker | Redis 7 |
| Orchestration | n8n |
| OCR and document service | Paperless-ngx |
| AI flow tooling | Flowise |
| LLM runtime | Ollama |

## Run The Desktop Client

```bash
npm install
npm run electron:dev
```

## Build The Desktop Installer

```bash
npm run electron:build
```

The installer output is written to `dist-electron/`.

## Run The Docker Service Stack

1. Copy the Docker environment template.

```bash
cp .env.docker.example .env
```

2. Set real secrets in `.env`.

Important values:
- `POSTGRES_PASSWORD`
- `PAPERLESS_SECRET_KEY`
- `FLOWISE_SECRETKEY`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

3. Start the core platform services.

```bash
docker compose up -d
```

This starts:
- PostgreSQL
- Redis
- backend-api
- n8n
- Gotenberg
- Tika
- Paperless-ngx
- Flowise

## Optional Local Ollama Profile

By default, AI Proviso expects Ollama to run as an external service, for example on the host machine via Docker Desktop or a separate AI host.

Default configuration:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

If you want Docker Compose to run Ollama locally for development, use the `local-ai` profile:

```bash
docker compose --profile local-ai up -d
```

That starts:
- `ollama`
- `ollama-pull`

`ollama-pull` is a one-shot helper that pulls the model named by `OLLAMA_MODEL` after Ollama becomes healthy.

## Current Ports

| Service | Port |
|:---|:---|
| backend-api | `5000` |
| n8n | `5678` |
| Paperless-ngx | `8000` |
| Flowise | `3001` |
| PostgreSQL | `5432` |
| Ollama | `11434` when `local-ai` is enabled |

## Repository Files Added For The Service Stack

| File | Purpose |
|:---|:---|
| `docker-compose.yml` | Core local platform stack |
| `.env.docker.example` | Environment template for the stack |
| `DOCKER_STACK.md` | Docker usage and separation guidance |
| `backend/Dockerfile` | Backend API image |
| `backend/requirements.txt` | Backend container dependencies |
| `docker/postgres-init/01-create-databases.sh` | Bootstraps local databases |

## Planning Documents

| File | Purpose |
|:---|:---|
| `Proviso_PRD_v4.md` | Current PRD direction |
| `Proviso_Change_Blueprint.md` | Modification-first implementation plan |

## Existing Windows and M-Files Scripts

| Script | Purpose |
|:---|:---|
| `scripts/push-to-vault.ps1` | Push workflow JSON to M-Files via COM |
| `scripts/pull-from-vault.ps1` | Pull workflow data from M-Files |
| `scripts/test-connection.ps1` | Test M-Files vault connectivity |
| `scripts/verify-vault.ps1` | Diagnostic listing for workflows |

## M-Files Notes

M-Files integration remains host-side and Windows-specific.
It is not containerized.

Requirements:
- Windows machine with M-Files Server or Desktop installed
- `MFilesAPI.MFilesServerApplication` COM class registered
- compatible vault access and credentials

## Near-Term Direction

- Preserve and refactor the current workflow-builder foundation.
- Add AP domain entities, queue routing, and workflow integrity rules.
- Use Docker for platform services, not for the Electron UI.
- Keep PostgreSQL and Ollama separated from the application image.
- Treat Ollama as external by default and local-via-profile only when needed.

---

*AI Proviso · Xerox · 2026*

# Docker Stack Guide

## Intent

This stack follows a service-oriented pattern.
AI Proviso is not expected to bake Ollama into the application.
By default, the Docker stack assumes Ollama is an external service that AI Proviso and Flowise call over HTTP.

## Default Behavior

The default `docker compose up` stack starts:
- PostgreSQL
- Redis
- backend-api
- workflow-engine
- n8n
- Paperless-ngx
- Gotenberg
- Tika
- Flowise

It does not start Ollama unless you explicitly enable the `local-ai` profile.

## External Ollama Best Practice

Recommended default on Docker Desktop:
- Run Ollama separately on the host machine or another dedicated service host.
- Point containers to it with `OLLAMA_BASE_URL=http://host.docker.internal:11434`.
- Keep model lifecycle separate from the app stack.

This keeps AI Proviso loosely coupled and avoids turning model hosting into an application packaging concern.

## Optional Local Ollama Profile

If you want Docker to run Ollama locally for development:

```bash
docker compose --profile local-ai up -d
```

This starts:
- `ollama`
- `ollama-pull`

The `ollama-pull` helper pulls the model named by `OLLAMA_MODEL` after Ollama becomes healthy.

## Suggested Startup Modes

### Core platform only
```bash
docker compose up -d
```

### Core platform plus local Ollama
```bash
docker compose --profile local-ai up -d
```

## Canonical Dev Bootstrap

For a clean developer rebuild, use this sequence from the repository root:

```powershell
docker compose down -v
docker compose up -d
pwsh -File ./scripts/run-migrations.ps1
pwsh -File ./scripts/smoke-test.ps1
```

Notes:
- `docker/postgres-init/` creates databases, roles, and extensions only.
- The canonical schema and seed path lives in `core/migrations/001_initial_schema.sql` through `004_seed_data.sql`.
- `run-migrations.ps1` is intended for clean bootstrap; if the base schema already exists, rebuild the volumes before rerunning it.

## Environment Setup

Copy the template and set real secrets:

```bash
cp .env.docker.example .env
```

Important values:
- `POSTGRES_PASSWORD`
- `PAPERLESS_SECRET_KEY`
- `FLOWISE_SECRETKEY`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

## Current Service Ports

- backend-api: `5000`
- workflow-engine: `5100`
- n8n: `5678`
- Paperless-ngx: `8000`
- Ollama: `11434` when `local-ai` is enabled
- Flowise: `3001`
- PostgreSQL: `5432`

## Notes

- The Electron client remains outside Docker.
- Docker is used for the backend platform services.
- `workflow-engine` hosts the XState runtime and persists no authoritative state locally.
- M-Files Windows COM integration remains host-side and is not containerized.

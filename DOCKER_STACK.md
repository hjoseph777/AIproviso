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

---

## Local Dev Runbook — Proven Green State (15/15 Smoke Pass)

This section documents the exact startup sequence that produced a verified
**15/15 smoke test pass** on 2026-06-01. Follow this sequence precisely for
a reproducible green run.

### Prerequisites

| Requirement | Value |
| --- | --- |
| Python | `C:\Users\Owner\AppData\Local\Programs\Python\Python311\python.exe` (3.11.x) |
| PostgreSQL | `localhost:5432` — database `proviso`, user `proviso` |
| Redis | `localhost:6379` |
| Docker | Timer-worker container `proviso-timer-worker` running |

### Required environment variables

These must be set before starting Flask. The backend reads them via
`_resolve_database_url()` which checks env → `.env` file → dev default.

```powershell
$env:DATABASE_URL       = "postgresql://proviso:change-me@localhost:5432/proviso"
$env:REDIS_URL          = "redis://localhost:6379/0"
$env:ALLOW_DEV_FALLBACK = "1"
$env:FLASK_DEBUG        = "0"
```

Alternatively, set them persistently as Windows User environment variables:

```powershell
[System.Environment]::SetEnvironmentVariable("DATABASE_URL",
    "postgresql://proviso:change-me@localhost:5432/proviso", "User")
[System.Environment]::SetEnvironmentVariable("REDIS_URL",
    "redis://localhost:6379/0", "User")
[System.Environment]::SetEnvironmentVariable("ALLOW_DEV_FALLBACK", "1", "User")
```

### Backend startup

```powershell
# From repository root
C:\Users\Owner\AppData\Local\Programs\Python\Python311\python.exe backend\app.py
```

Expected output within 3 seconds:

```text
BullMQ dev relay thread started (polls every 3s)
* Running on http://127.0.0.1:5000
```

### Smoke test

```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

Expected final output:

```text
PASS: 15
FAIL: 0
Runtime gate: PASS
```

---

## Schema Verification (Migration 006)

Migration `006_workflow_history_rule_id.sql` adds `rule_id VARCHAR(150)` to
`workflow_state_history`. This column is required for runtime view correctness.

### Verification steps

Connect to the database and run:

```sql
-- 1. Confirm migration is recorded
SELECT filename, applied_at
FROM schema_migrations
WHERE filename = '006_workflow_history_rule_id.sql';

-- Expected: one row with applied_at timestamp

-- 2. Confirm column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'workflow_state_history'
  AND column_name = 'rule_id';

-- Expected: rule_id | character varying

-- 3. Confirm index exists
SELECT indexname
FROM pg_indexes
WHERE tablename = 'workflow_state_history'
  AND indexname = 'idx_workflow_state_history_rule_id';

-- Expected: idx_workflow_state_history_rule_id
```

If any query returns zero rows, apply the migration manually:

```powershell
C:\Users\Owner\AppData\Local\Programs\Python\Python311\python.exe -c "
import psycopg2
conn = psycopg2.connect('postgresql://proviso:change-me@localhost:5432/proviso')
cur = conn.cursor()
cur.execute('''ALTER TABLE workflow_state_history
               ADD COLUMN IF NOT EXISTS rule_id VARCHAR(150)''')
cur.execute('''CREATE INDEX IF NOT EXISTS idx_workflow_state_history_rule_id
               ON workflow_state_history (rule_id, recorded_at DESC)''')
cur.execute(\"INSERT INTO schema_migrations (filename) VALUES ('006_workflow_history_rule_id.sql') ON CONFLICT DO NOTHING\")
conn.commit(); conn.close(); print('Migration 006 applied')
"
```

The system must not rely on fallback behaviour as a substitute for migration
correctness. If migration 006 is missing, `runtime-view` will serve incomplete
rule binding data regardless of fallback configuration.

---

## Regression Gate Policy

### Smoke test is a mandatory pre-merge gate for `main`

| Rule | Value |
| --- | --- |
| Required score | **15 / 15** |
| Gate command | `powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1` |
| Passing condition | `Runtime gate: PASS` printed, exit code `0` |
| Failing condition | Any `[FAIL]` line or exit code non-zero |

**15/15 is required to merge into `main`.**
**Any score below 15/15 is a release blocker.**

No exceptions. PRs that degrade the smoke score must be fixed before merge,
not merged with a note to fix later. The smoke test covers:

- Backend liveness and deep health (DB + Redis)
- Invoice intake → OCR extraction → workflow state persistence
- AP review routing → exception state transition
- BullMQ timer lifecycle → cancellation → runtime view reflection

### Applying the gate in CI

When CI is wired, add this step after the build:

```yaml
- name: Runtime smoke gate
  run: powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1
  # Exit code 1 on any FAIL — blocks merge automatically
```

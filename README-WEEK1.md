# AI Proviso — Week 1 Start Guide
**Phase I · MOD-00 + Infrastructure**

Everything you need to go from zero to a running stack with `invoice.received` firing end-to-end.

---

## What Was Built

| File | Purpose |
|:---|:---|
| `docker-compose.yml` | Full 10-service stack (postgres, redis, backend-api, ocr-worker, n8n, gotenberg, tika, paperless, flowise) |
| `.env.docker.example` | All environment variables — copy to `.env` and fill in |
| `docker/postgres-init/02-create-roles.sql` | `audit_writer` + `app_worker` database roles |
| `docker/postgres-init/03-extensions.sql` | `pgvector`, `pg_trgm`, `uuid-ossp` |
| `core/migrations/001_initial_schema.sql` | All CREATE TABLE statements from PRD v8 Section 6.1 |
| `core/migrations/002_rls_policies.sql` | Row-Level Security on all 15 tenant-scoped tables |
| `core/migrations/003_triggers.sql` | Simulation gate, updated_at, posting guard triggers |
| `core/migrations/004_seed_data.sql` | Dev tenant + admin user + vendor + approval matrix |
| `core/events.ts` | All 9 canonical event topics (PRD v8 Section 3.4) |
| `core/types.ts` | All TypeScript interfaces for domain entities |
| `config/n8n/workflows/proviso-event-router.json` | All 9 n8n webhook endpoints, ready to import |
| `ocr-worker/Dockerfile` + `worker.py` | Redis BullMQ poller — Phase I stub, real OCR in Week 3-4 |
| `backend/app.py` | Flask API with intake + health/db + event endpoints |
| `scripts/run-migrations.ps1` | Runs migrations 001–004 in sequence |
| `scripts/smoke-test.ps1` | 5-step automated Week 1 acceptance test |

---

## Step 1 — Copy the Environment File

```powershell
cd c:\Users\Owner\Xerox\AIproviso
Copy-Item .env.docker.example .env
```

Open `.env` and change every line marked `[CHANGE ME]`. Minimum required:
- `POSTGRES_PASSWORD`
- `PAPERLESS_SECRET_KEY`
- `JWT_SECRET`
- `FLOWISE_SECRETKEY`

---

## Step 2 — Start the Stack

```powershell
# Core stack (no local Ollama)
docker compose up -d

# With local Ollama (Mac M2 or local GPU)
docker compose --profile local-ai up -d
```

Wait ~60 seconds for all services to be healthy:

```powershell
docker compose ps
```

All services should show `(healthy)` or `running`.

---

## Step 3 — Run Database Migrations

```powershell
.\scripts\run-migrations.ps1
```

This runs migrations 001–004 in sequence. Output:
```
=== AI Proviso — MOD-00 Migrations ===
  Running 001_initial_schema.sql... OK
  Running 002_rls_policies.sql... OK
  Running 003_triggers.sql... OK
  Running 004_seed_data.sql... OK
=== All migrations applied successfully ===
Dev tenant UUID : 00000000-0000-0000-0000-000000000001
Dev admin email : admin@proviso.dev
```

---

## Step 4 — Import the n8n Event Router

1. Open n8n: http://localhost:5678 (login: `proviso` / password from `.env`)
2. Go to **Workflows → Import from File**
3. Import: `config/n8n/workflows/proviso-event-router.json`
4. The workflow activates automatically (it has `"active": true`)
5. Verify all 9 webhook URLs appear under **Webhooks**

> **Webhook URL pattern:** `http://localhost:5678/webhook/invoice/received`

---

## Step 5 — Run the Smoke Test

```powershell
.\scripts\smoke-test.ps1
```

Expected output:
```
=== AI Proviso — Week 1 Smoke Test ===

[ 1 ] Backend liveness check...
  [PASS] GET /health returns status=ok
[ 2 ] Deep health check (DB + Redis)...
  [PASS] PostgreSQL connected
  [PASS] Redis connected
[ 3 ] Firing invoice.received via POST /api/intake/upload...
  [PASS] Response contains invoice_id
  [PASS] Response contains correlation_id
  [PASS] Response status = received
  [PASS] n8n ACK received
    invoice_id     = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[ 4 ] Checking OCR queue depth...
  [PASS] OCR queue depth >= 1
[ 5 ] Confirming n8n invoice.received webhook endpoint...
  [PASS] n8n webhook /invoice/received responds
  [PASS] n8n ACK contains ack=true

=== Results ===
  PASS: 9
  FAIL: 0

  Week 1 gate: PASS — invoice.received fires end-to-end.
  Ready to begin Week 2: MOD-01 Intake implementation.
```

---

## Service URLs

| Service | URL | Credentials |
|:---|:---|:---|
| Backend API | http://localhost:5000 | — |
| n8n | http://localhost:5678 | `proviso` / (from .env) |
| Paperless-NGX | http://localhost:8000 | admin / (first-run setup) |
| Flowise | http://localhost:3001 | — |
| PostgreSQL | localhost:5432 | `proviso` / (from .env) |
| Redis | localhost:6379 | — |

---

## Key Architecture Facts (Week 1)

- **`PAPERLESS_OCR_MODE=skip`** is locked in `docker-compose.yml`. Paperless never runs OCR.
- **OCR Worker** is in `stub` mode (`OCR_MODE=stub` in `.env`). It logs receipt and returns mock fields.
- **RLS is active** — every API call must `SET LOCAL app.current_tenant_id = 'uuid'` before any query.
- **Dev Tenant ID**: `00000000-0000-0000-0000-000000000001`
- **Workflows cannot go active** without a passing simulation run (database trigger enforces this).

---

## Week 2 Starting Point

Once smoke test passes:

1. Build MOD-01 intake controller (real IMAP watcher + HTTP upload with file storage)
2. Wire Paperless REST API call — upload file, store `paperless_id` in `invoices`
3. Confirm `invoice.received` event fires with real Paperless document ID in payload

---

## Troubleshooting

| Problem | Fix |
|:---|:---|
| `pg_isready` fails | `docker compose logs postgres` — check POSTGRES_PASSWORD |
| Migrations fail with extension error | Run `03-extensions.sql` is in `docker/postgres-init/` and runs on first boot |
| n8n webhook 404 | Import `proviso-event-router.json` and ensure workflow is **Active** |
| OCR worker crashes | `docker compose logs ocr-worker` — usually a Redis URL or DB URL issue |
| Smoke test Step 5 fails | Confirm n8n workflow is imported and active before running test |

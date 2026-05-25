-- =============================================================================
-- 02-create-roles.sql
-- Creates application-scoped database roles with minimal required privileges.
-- Runs inside the 'proviso' database on first container boot.
-- PRD v8 Section 6.1: audit_writer has INSERT-only on audit_events.
-- =============================================================================

\c proviso;

-- ── audit_writer ─────────────────────────────────────────────────────────────
-- INSERT-only role consumed by MOD-07. Cannot UPDATE, DELETE, or TRUNCATE.
-- This enforces the append-only audit trail at the database level.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_writer') THEN
    CREATE ROLE audit_writer LOGIN PASSWORD 'audit_writer_change_me';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE proviso TO audit_writer;
GRANT USAGE ON SCHEMA public TO audit_writer;
-- Table-level grants applied after table creation in migration 001.
-- See: core/migrations/001_initial_schema.sql (bottom of file)

-- ── app_worker ───────────────────────────────────────────────────────────────
-- Runtime application role. All backend-api and ocr-worker DB operations
-- execute as this role. No SUPERUSER, no DDL privileges.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_worker') THEN
    CREATE ROLE app_worker LOGIN PASSWORD 'app_worker_change_me';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE proviso TO app_worker;
GRANT USAGE ON SCHEMA public TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_worker;
-- Ensure future tables are also covered
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_worker;

-- =============================================================================
-- 005_workflow_runtime.sql
-- Workflow runtime persistence tables for XState/PostgreSQL authority.
-- Adds workflow_state, workflow_state_history, and workflow_timers with
-- tenant isolation, update/version triggers, and a bootstrap backfill.
-- =============================================================================

\c proviso;

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKFLOW STATE
-- One authoritative runtime snapshot per invoice.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_state (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  invoice_id             UUID NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  workflow_definition_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,
  workflow_version       VARCHAR(50) NOT NULL DEFAULT 'v1',
  machine_id             VARCHAR(100) NOT NULL DEFAULT 'invoice-approval',
  current_state          VARCHAR(100) NOT NULL,
  context_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_event             VARCHAR(100),
  entered_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  lock_version           INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_workflow_state_tenant_id
  ON workflow_state (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_definition
  ON workflow_state (workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_current_state
  ON workflow_state (tenant_id, current_state);

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKFLOW STATE HISTORY
-- Append-only transition history for audit/debug/runtime replay.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_state_history (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  invoice_id             UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  workflow_state_id      UUID NOT NULL REFERENCES workflow_state(id) ON DELETE CASCADE,
  workflow_definition_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,
  event_type             VARCHAR(100) NOT NULL,
  from_state             VARCHAR(100),
  to_state               VARCHAR(100) NOT NULL,
  guard_name             VARCHAR(100),
  guard_result           BOOLEAN,
  action_summary         JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_json          JSONB,
  context_patch          JSONB,
  triggered_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  trigger_source         VARCHAR(50) NOT NULL DEFAULT 'system'
                           CHECK (trigger_source IN ('system', 'user', 'timer', 'api', 'webhook', 'ai')),
  correlation_id         UUID,
  recorded_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_state_history_invoice_recorded
  ON workflow_state_history (invoice_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_state_history_state_id
  ON workflow_state_history (workflow_state_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_state_history_tenant_id
  ON workflow_state_history (tenant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_state_history_correlation
  ON workflow_state_history (correlation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKFLOW TIMERS
-- SLA, delay, escalation, and reminder timer registry.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_timers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  workflow_state_id UUID NOT NULL REFERENCES workflow_state(id) ON DELETE CASCADE,
  timer_key         VARCHAR(100) NOT NULL,
  timer_type        VARCHAR(50) NOT NULL
                      CHECK (timer_type IN ('sla', 'delay', 'escalation', 'reminder')),
  target_state      VARCHAR(100),
  status            VARCHAR(30) NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'fired', 'cancelled', 'expired')),
  due_at            TIMESTAMPTZ NOT NULL,
  fired_at          TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  job_reference     VARCHAR(255),
  payload_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_timers_invoice_due_at
  ON workflow_timers (invoice_id, due_at);
CREATE INDEX IF NOT EXISTS idx_workflow_timers_tenant_status
  ON workflow_timers (tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_workflow_timers_state_id
  ON workflow_timers (workflow_state_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_timers_open_key
  ON workflow_timers (invoice_id, timer_key)
  WHERE status = 'scheduled';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS ENABLEMENT AND POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE workflow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_timers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workflow_state' AND policyname = 'tenant_isolation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY tenant_isolation ON workflow_state
      FOR ALL USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workflow_state_history' AND policyname = 'tenant_isolation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY tenant_isolation ON workflow_state_history
      FOR ALL USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workflow_timers' AND policyname = 'tenant_isolation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY tenant_isolation ON workflow_timers
      FOR ALL USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      )
    $policy$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE / VERSION TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_workflow_state_lock_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.lock_version = OLD.lock_version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflow_state_updated_at') THEN
    CREATE TRIGGER trg_workflow_state_updated_at
      BEFORE UPDATE ON workflow_state
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflow_timers_updated_at') THEN
    CREATE TRIGGER trg_workflow_timers_updated_at
      BEFORE UPDATE ON workflow_timers
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflow_state_lock_version') THEN
    CREATE TRIGGER trg_workflow_state_lock_version
      BEFORE UPDATE ON workflow_state
      FOR EACH ROW
      EXECUTE FUNCTION increment_workflow_state_lock_version();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BOOTSTRAP BACKFILL
-- Creates runtime snapshots for existing invoices so the Runtime View can read
-- real rows immediately after the migration lands.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO workflow_state (
  tenant_id,
  invoice_id,
  workflow_definition_id,
  workflow_version,
  machine_id,
  current_state,
  context_json,
  snapshot_json,
  last_event,
  entered_at,
  updated_at
)
SELECT
  i.tenant_id,
  i.id,
  wd.id,
  COALESCE(wd.version, 'v1'),
  'invoice-approval',
  i.status,
  jsonb_build_object(
    'invoice_id', i.id,
    'invoice_status', i.status,
    'correlation_id', i.correlation_id,
    'vendor_name', COALESCE(v.display_name, v.name, latest.extracted_json->>'vendor_name', 'Unknown vendor'),
    'invoice_number', COALESCE(latest.extracted_json->>'invoice_number', 'unknown')
  ),
  jsonb_build_object(
    'value', i.status,
    'context', jsonb_build_object(
      'invoice_id', i.id,
      'status', i.status,
      'tenant_id', i.tenant_id
    )
  ),
  CASE i.status
    WHEN 'received' THEN 'invoice.received'
    WHEN 'extracted' THEN 'invoice.extracted'
    WHEN 'matched' THEN 'invoice.matched'
    WHEN 'pending_approval' THEN 'invoice.pending_approval'
    WHEN 'approved' THEN 'invoice.approved'
    WHEN 'exception' THEN 'invoice.exception'
    WHEN 'posted' THEN 'invoice.posted'
    WHEN 'reconciled' THEN 'invoice.reconciled'
    WHEN 'rejected' THEN 'invoice.rejected'
    ELSE 'workflow.backfill'
  END,
  COALESCE(i.updated_at, i.received_at, now()),
  COALESCE(i.updated_at, i.received_at, now())
FROM invoices i
LEFT JOIN vendors v ON v.id = i.vendor_id
LEFT JOIN LATERAL (
  SELECT extracted_json
  FROM invoice_extractions ie
  WHERE ie.invoice_id = i.id
  ORDER BY ie.version DESC
  LIMIT 1
) latest ON TRUE
LEFT JOIN LATERAL (
  SELECT id, version
  FROM workflow_definitions wd
  WHERE wd.tenant_id = i.tenant_id
  ORDER BY wd.active DESC, wd.created_at DESC
  LIMIT 1
) wd ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_state ws WHERE ws.invoice_id = i.id
);

INSERT INTO workflow_state_history (
  tenant_id,
  invoice_id,
  workflow_state_id,
  workflow_definition_id,
  event_type,
  from_state,
  to_state,
  guard_result,
  action_summary,
  snapshot_json,
  trigger_source,
  correlation_id,
  recorded_at
)
SELECT
  ws.tenant_id,
  ws.invoice_id,
  ws.id,
  ws.workflow_definition_id,
  COALESCE(ws.last_event, 'workflow.backfill'),
  NULL,
  ws.current_state,
  TRUE,
  jsonb_build_array('bootstrap runtime state'),
  ws.snapshot_json,
  'system',
  i.correlation_id,
  COALESCE(ws.entered_at, now())
FROM workflow_state ws
JOIN invoices i ON i.id = ws.invoice_id
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_state_history wsh WHERE wsh.workflow_state_id = ws.id
);

INSERT INTO workflow_timers (
  tenant_id,
  invoice_id,
  workflow_state_id,
  timer_key,
  timer_type,
  target_state,
  status,
  due_at,
  payload_json,
  created_at,
  updated_at
)
SELECT
  ws.tenant_id,
  ws.invoice_id,
  ws.id,
  'sla.current',
  'sla',
  ws.current_state,
  'scheduled',
  COALESCE(ws.updated_at, now()) + CASE
    WHEN ws.current_state = 'pending_approval' THEN interval '4 hours'
    WHEN ws.current_state = 'exception' THEN interval '1 hour'
    WHEN ws.current_state = 'matched' THEN interval '2 hours'
    WHEN ws.current_state = 'extracted' THEN interval '1 hour'
    ELSE interval '2 hours'
  END,
  jsonb_build_object(
    'derived_from', '005_workflow_runtime.sql',
    'current_state', ws.current_state
  ),
  now(),
  now()
FROM workflow_state ws
WHERE ws.current_state IN ('pending_approval', 'exception', 'matched', 'extracted')
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_timers wt
    WHERE wt.invoice_id = ws.invoice_id
      AND wt.timer_key = 'sla.current'
      AND wt.status = 'scheduled'
  );

DO $$ BEGIN
  RAISE NOTICE 'MOD-00 migration 005 complete: workflow runtime persistence installed.';
END $$;
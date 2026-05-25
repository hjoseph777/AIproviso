-- =============================================================================
-- 003_triggers.sql
-- Database triggers for workflow integrity.
-- PRD v8 Section 11.1: Simulation gate — a workflow cannot be activated
-- unless a simulation run with passed = true exists for it.
-- =============================================================================

\c proviso;

-- ─────────────────────────────────────────────────────────────────────────────
-- SIMULATION GATE — Prevents activating a workflow without a passing sim run
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_workflow_simulation_pass()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when someone is trying to set active = TRUE
  IF NEW.active = TRUE AND (OLD IS NULL OR OLD.active = FALSE) THEN
    IF NOT EXISTS (
      SELECT 1 FROM workflow_simulation_runs
      WHERE workflow_id = NEW.id
        AND passed = TRUE
    ) THEN
      RAISE EXCEPTION
        'SIMULATION_REQUIRED: Workflow "%" (id: %) cannot be activated '
        'without a simulation run with passed = true. '
        'Run simulation mode first.',
        COALESCE(NEW.name, 'unnamed'), NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- DEFERRABLE INITIALLY DEFERRED: allows the INSERT of the workflow and
-- the simulation run to happen in the same transaction before the check fires.
CREATE CONSTRAINT TRIGGER trg_enforce_simulation_gate
  AFTER INSERT OR UPDATE OF active ON workflow_definitions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_workflow_simulation_pass();

-- ─────────────────────────────────────────────────────────────────────────────
-- INVOICES.UPDATED_AT — Auto-maintain updated_at on every row change
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_erp_configs_updated_at
  BEFORE UPDATE ON erp_configs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- POSTING GUARD — Posting to ERP is blocked unless status = 'approved'
-- Applied at the DB level as a belt-and-suspenders guard on top of
-- the application-layer CHECK constraint.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guard_invoice_posting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'posted' AND OLD.status != 'approved' THEN
    RAISE EXCEPTION
      'POSTING_BLOCKED: Invoice % cannot transition to posted from status "%". '
      'Invoice must be in approved state first.',
      NEW.id, OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_invoice_posting
  BEFORE UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION guard_invoice_posting();

DO $$ BEGIN
  RAISE NOTICE 'MOD-00 migration 003 complete: triggers installed.';
END $$;

-- =============================================================================
-- 002_rls_policies.sql
-- Row-Level Security — Multi-Tenant Isolation
-- PRD v8 Section 6.1: Every tenant-scoped table gets a policy.
-- Context set per request: SET LOCAL app.current_tenant_id = 'uuid'
-- =============================================================================

\c proviso;

-- ── Helper: safe UUID cast from session variable ──────────────────────────────
-- Returns NULL (not an error) if the session variable is unset or empty.
-- This prevents 500 errors during migrations and health checks.

-- ── Enable RLS on all tenant-scoped tables ────────────────────────────────────
ALTER TABLE tenant_configurations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_extractions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_extraction_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_matrix              ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_simulation_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows_dataset            ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_configs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE exception_cases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_purchase_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_definitions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events                 ENABLE ROW LEVEL SECURITY;

-- ── Shorthand macro for the tenant UUID extraction ────────────────────────────
-- All policies use this expression:
--   NULLIF(current_setting('app.current_tenant_id', true), '')::uuid

-- ── Direct tenant_id policies ─────────────────────────────────────────────────
CREATE POLICY tenant_isolation ON tenant_configurations
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON users
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON vendors
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON invoices
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON approval_matrix
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON workflow_definitions
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON workflow_simulation_runs
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON workflows_dataset
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON erp_configs
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON vendor_extraction_profiles
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON mock_purchase_orders
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON form_definitions
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON audit_events
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- ── Indirect tenant policies (no tenant_id column — joins to parent) ──────────

-- invoice_extractions: visible if the parent invoice is visible to this tenant
CREATE POLICY tenant_isolation ON invoice_extractions
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
  );

-- exception_cases: visible if the parent invoice is visible to this tenant
CREATE POLICY tenant_isolation ON exception_cases
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
  );

-- ── Phase III Note ────────────────────────────────────────────────────────────
-- For high-volume tenants (>100k invoices), add a direct tenant_id column to
-- invoice_extractions and exception_cases to avoid the nested subquery cost.
-- Migration 010 will handle this with a backfill + policy swap.

DO $$ BEGIN
  RAISE NOTICE 'MOD-00 migration 002 complete: RLS policies applied to all tenant tables.';
END $$;

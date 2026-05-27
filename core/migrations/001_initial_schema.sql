-- =============================================================================
-- 001_initial_schema.sql
-- MOD-00 — Canonical Schema Migration (PRD v8 Section 6.1)
-- Run order: after extensions are enabled (03-extensions.sql)
-- All tables, constraints, foreign keys, and indexes in dependency order.
-- =============================================================================

\c proviso;

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- TENANT CONFIGURATIONS
-- Single source of truth for all per-tenant AP policy settings.
-- Every other table references tenant_configurations(tenant_id).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_configurations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL UNIQUE,
  config_json JSONB NOT NULL DEFAULT '{}',
  -- config_json shape:
  -- {
  --   "po_required":           true,
  --   "match_type":            "3-way",         -- "2-way" | "3-way"
  --   "default_currency":      "CAD",
  --   "approval_thresholds":   [{"amount": 5000, "approver_role": "manager"}],
  --   "sla_overrides":         {"VENDOR_UNKNOWN": 2, "PO_REQUIRED": 6},
  --   "ocr_confidence_floor":  0.70,
  --   "duplicate_window_days": 30,
  --   "alias_prefix":          "XERX"           -- vault alias namespace prefix
  -- }
  version     INT NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_configurations_tenant_id
  ON tenant_configurations (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS REGISTRY
-- Core user identity, system roles, and multi-tenant isolation keys.
-- Canonical source for all user_id, run_by, created_by, assignee_id refs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  email        VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  role         VARCHAR(50)  NOT NULL
                 CHECK (role IN ('admin', 'consultant', 'ap_operator', 'approver', 'viewer')),
  sso_subject  VARCHAR(255),          -- OIDC sub claim for SSO linkage
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Phase I: email is unique per tenant (same person can be in two tenants)
  -- Phase I note: if global uniqueness needed, remove tenant_id from the constraint
  UNIQUE (email, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- VENDORS REGISTRY
-- Canonical vendor master — fuzzy matched per Section 9.1
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  name              VARCHAR(255) NOT NULL,     -- used for fuzzy name matching (Section 9.1)
  display_name      VARCHAR(255),             -- human-readable alias
  erp_vendor_number VARCHAR(100) NOT NULL,
  account_number    VARCHAR(100),
  tax_id            VARCHAR(100),
  email_domain      VARCHAR(100),
  risk_score        DECIMAL(3,2) NOT NULL DEFAULT 0.00
                      CHECK (risk_score >= 0.00 AND risk_score <= 1.00),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors (tenant_id);
-- Trigram index for fuzzy name matching (pg_trgm must be enabled)
CREATE INDEX IF NOT EXISTS idx_vendors_name_trgm
  ON vendors USING gin (name gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- CORE INVOICES
-- One row per invoice. Status enforced via CHECK + state machine.
-- Posting is blocked unless status = 'approved' (enforced in MOD-05).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  status         VARCHAR(50) NOT NULL DEFAULT 'received'
                   CHECK (status IN (
                     'received', 'extracted', 'matched', 'pending_approval',
                     'approved', 'exception', 'posted', 'reconciled', 'rejected'
                   )),
  correlation_id UUID NOT NULL,           -- event correlation across modules
  paperless_id   VARCHAR(100),            -- Paperless-ngx document ID
  vendor_id      UUID REFERENCES vendors(id) ON DELETE SET NULL,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id      ON invoices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status         ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_correlation_id ON invoices (correlation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- OCR EXTRACTION METADATA
-- Versioned — extraction re-runs do not overwrite, they add a new version.
-- UNIQUE (invoice_id, version) prevents duplicate re-run records.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_extractions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  version         INT NOT NULL DEFAULT 1,
  extracted_json  JSONB NOT NULL,           -- structured invoice fields
  confidence_json JSONB NOT NULL,           -- per-field 0.0–1.0 confidence scores
  ocr_engine      VARCHAR(50) NOT NULL,     -- 'paddle' | 'doctr' | 'tesseract' | 'stub'
  raw_ocr_text    TEXT,                     -- raw pre-LLM OCR output (kept for debugging)
  page_count      INT,                      -- pages processed
  processing_ms   INT,                      -- total pipeline duration in ms
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, version)              -- enforces version monotonicity
);

CREATE INDEX IF NOT EXISTS idx_invoice_extractions_invoice_id
  ON invoice_extractions (invoice_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- VENDOR EXTRACTION PROFILES
-- Learns field layout coordinates and OCR anchor positions per vendor.
-- Used by MOD-02 to pre-position extraction for known vendors.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_extraction_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  vendor_id      UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  profile_json   JSONB NOT NULL,        -- field positions, known formats, OCR anchors
  sample_count   INT NOT NULL DEFAULT 0,
  accuracy_score DECIMAL(4,3)
                   CHECK (accuracy_score IS NULL OR
                          (accuracy_score >= 0.000 AND accuracy_score <= 1.000)),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, vendor_id)         -- one profile per vendor per tenant
);

-- ─────────────────────────────────────────────────────────────────────────────
-- APPROVAL ROUTING MATRIX
-- JSON rules evaluated by MOD-04 state machine.
-- Only one active matrix per tenant at a time (enforced by application).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_matrix (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  rules_json  JSONB NOT NULL,
  version     VARCHAR(50) NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_matrix_tenant_id ON approval_matrix (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKFLOW SIMULATION RUNS
-- Must be created BEFORE workflow_definitions (referenced in trigger).
-- A workflow cannot be activated without a passing simulation run.
-- PRD v8 Section 11.1: simulation gate is enforced at DB level.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_simulation_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  workflow_id  UUID NOT NULL,              -- FK set after workflow_definitions exists
  passed       BOOLEAN NOT NULL DEFAULT FALSE,
  run_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  report_json  JSONB,                      -- routing decisions, unreachable states
  report_pdf   TEXT,                       -- base64 or storage ref to PDF sign-off
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_workflow_id
  ON workflow_simulation_runs (workflow_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIVE WORKFLOW DEFINITIONS
-- Active=TRUE requires a passing simulation run (enforced by trigger below).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  workflow_json JSONB NOT NULL,
  name          VARCHAR(255),
  version       VARCHAR(50) NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT FALSE,    -- FALSE until simulation passes
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant_id
  ON workflow_definitions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active
  ON workflow_definitions (tenant_id, active);

-- Now that workflow_definitions exists, add the FK to simulation_runs
ALTER TABLE workflow_simulation_runs
  ADD CONSTRAINT fk_simulation_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKFLOW RAG DATASET
-- Every saved workflow enters this dataset for future RAG retrieval.
-- parent_id enables lineage tracing (PRD v8: which template → which derivation).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows_dataset (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  workflow_json   JSONB NOT NULL,
  scenario_text   TEXT NOT NULL,             -- natural language description (embedded)
  embedding       vector(1536),              -- pgvector RAG embedding
  type            VARCHAR(50),               -- 'approval', 'exception', 'matching', etc.
  industry        VARCHAR(100),
  complexity      VARCHAR(20)
                    CHECK (complexity IN ('simple', 'medium', 'complex')),
  source          VARCHAR(30) NOT NULL
                    CHECK (source IN ('manual', 'ai_generated', 'ai_customized', 'imported')),
  parent_id       UUID REFERENCES workflows_dataset(id) ON DELETE SET NULL,  -- lineage
  usage_count     INT NOT NULL DEFAULT 0,
  is_sanitized    BOOLEAN NOT NULL DEFAULT FALSE,   -- PII removed before dataset entry
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_dataset_tenant_id ON workflows_dataset (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_dataset_parent_id ON workflows_dataset (parent_id);
-- Vector similarity index for RAG candidate retrieval
CREATE INDEX IF NOT EXISTS idx_workflows_dataset_embedding
  ON workflows_dataset USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────────────────────
-- ERP CONFIGURATIONS (Phase II active — created now, used in Phase II)
-- Stores learned field mappings per ERP type per tenant.
-- forked_from enables client-specific variants while keeping source traceable.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS erp_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  erp_type         VARCHAR(100) NOT NULL,    -- 'sap', 'dynamics365', 'quickbooks', etc.
  erp_version      VARCHAR(50),
  field_map_json   JSONB NOT NULL,
  confidence_score DECIMAL(4,3) NOT NULL DEFAULT 0.75
                     CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
  usage_count      INT NOT NULL DEFAULT 0,
  is_trusted_standard BOOLEAN NOT NULL DEFAULT FALSE,
  forked_from      UUID REFERENCES erp_configs(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_configs_tenant_id ON erp_configs (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- EXCEPTION CASES (Phase II active — created now, used in Phase II)
-- Named exception queues per PRD v8 MOD-06 specification.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exception_cases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  reason_code  VARCHAR(50) NOT NULL
                 CHECK (reason_code IN (
                   'VENDOR_UNKNOWN', 'PO_REQUIRED', 'VENDOR_AND_PO',
                   'LOW_CONFIDENCE', 'DUPLICATE_RISK', 'POLICY_BREACH',
                   'ERP_POST_FAIL', 'MATCH_VARIANCE'
                 )),
  queue_name   VARCHAR(100) NOT NULL,
  assigned_to  UUID REFERENCES users(id) ON DELETE SET NULL,
  sla_deadline TIMESTAMPTZ,
  resolved_at  TIMESTAMPTZ,
  resolution   TEXT,
  status       VARCHAR(30) NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'escalated', 'resolved', 'closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exception_cases_invoice_id ON exception_cases (invoice_id);
CREATE INDEX IF NOT EXISTS idx_exception_cases_status     ON exception_cases (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- MOCK PURCHASE ORDERS (Phase I stub for MOD-03 demo)
-- Replaced by real ERP PO queries in Phase II.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mock_purchase_orders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  vendor_id  UUID REFERENCES vendors(id) ON DELETE SET NULL,
  po_number  VARCHAR(100) NOT NULL,
  total      DECIMAL(12,2) NOT NULL,
  currency   VARCHAR(10) NOT NULL DEFAULT 'CAD',
  status     VARCHAR(50) NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'partial', 'closed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_mock_po_tenant_id ON mock_purchase_orders (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- FORM DEFINITIONS (MOD-08 Builder 2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_definitions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenant_configurations(tenant_id) ON DELETE RESTRICT,
  name       VARCHAR(255) NOT NULL,
  form_json  JSONB NOT NULL,
  version    VARCHAR(50) NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_definitions_tenant_id ON form_definitions (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT EVENTS — Immutable append-only event store
-- MOD-07: INSERT-only at database level. No UPDATE. No DELETE. No TRUNCATE.
-- recorded_at is ALWAYS set by the database — never accepted from client payload.
-- 7-year retention enforced (no delete grants on runtime roles).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    VARCHAR(100) NOT NULL,       -- e.g. 'invoice.approved', 'field.corrected'
  invoice_id    UUID,                        -- NULL for non-invoice system events
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  old_value     JSONB,
  new_value     JSONB,
  reason        TEXT,                        -- mandatory on human overrides
  source_module VARCHAR(30) NOT NULL,        -- 'MOD-01' through 'MOD-08'
  tenant_id     UUID NOT NULL,               -- denormalized for fast partitioned queries
  correlation_id UUID,                       -- links related events across modules
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()  -- server-set ONLY
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id     ON audit_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_invoice_id    ON audit_events (invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_recorded_at   ON audit_events (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type    ON audit_events (event_type);

-- Enforce INSERT-only on audit_writer role
GRANT INSERT ON audit_events TO audit_writer;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM audit_writer;
-- app_worker can SELECT audit_events (for UI display) but cannot mutate
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM app_worker;

DO $$ BEGIN
  RAISE NOTICE 'MOD-00 migration 001 complete: all tables created.';
END $$;

-- Migration 008 — Dataset v12 schema additions
-- PRD v12 §7A.6
-- Run after 007

-- Fix vector dimension to match nomic-embed-text (768)
DROP INDEX IF EXISTS workflows_dataset_embedding_idx;
DROP INDEX IF EXISTS idx_workflows_dataset_embedding;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflows_dataset'
      AND column_name = 'embedding'
  ) THEN
    BEGIN
      ALTER TABLE workflows_dataset
        ALTER COLUMN embedding TYPE vector(768);
    EXCEPTION WHEN others THEN
      -- If existing values cannot be coerced (e.g., wrong dim), recreate column.
      ALTER TABLE workflows_dataset DROP COLUMN embedding;
      ALTER TABLE workflows_dataset ADD COLUMN embedding vector(768);
    END;
  ELSE
    ALTER TABLE workflows_dataset
      ADD COLUMN embedding vector(768);
  END IF;
END $$;

-- Recreate vector index for current dimension.
CREATE INDEX IF NOT EXISTS workflows_dataset_embedding_idx
  ON workflows_dataset
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- §7A.6 table extensions
ALTER TABLE workflows_dataset
  ADD COLUMN IF NOT EXISTS project_name    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS province        VARCHAR(10),
  ADD COLUMN IF NOT EXISTS erp_type        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS touchless_rate  DECIMAL(4,3),
  ADD COLUMN IF NOT EXISTS version         VARCHAR(20) DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS version_notes   TEXT,
  ADD COLUMN IF NOT EXISTS tags            TEXT[],
  ADD COLUMN IF NOT EXISTS state_count     INTEGER,
  ADD COLUMN IF NOT EXISTS usage_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id       UUID REFERENCES workflows_dataset(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transition_count INTEGER,
  ADD COLUMN IF NOT EXISTS approval_tiers   INTEGER,
  ADD COLUMN IF NOT EXISTS threshold_amount DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS sla_hours        DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS document_types   TEXT[],
  ADD COLUMN IF NOT EXISTS pain_points      TEXT[],
  ADD COLUMN IF NOT EXISTS metrics          JSONB,
  ADD COLUMN IF NOT EXISTS compliance_tags  TEXT[];

-- Version history table
CREATE TABLE IF NOT EXISTS project_version_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenant_configurations(tenant_id),
  project_id      UUID NOT NULL REFERENCES workflows_dataset(id) ON DELETE CASCADE,
  version         VARCHAR(20) NOT NULL,
  version_notes   TEXT NOT NULL,
  snapshot_json   JSONB NOT NULL,
  changed_by      UUID REFERENCES users(id),
  changed_at      TIMESTAMPTZ DEFAULT now()
);

-- Dataset reference table
CREATE TABLE IF NOT EXISTS project_dataset_refs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenant_configurations(tenant_id),
  project_id        UUID NOT NULL REFERENCES workflows_dataset(id) ON DELETE CASCADE,
  base_record_id    UUID REFERENCES workflows_dataset(id) ON DELETE SET NULL,
  similarity_score  DECIMAL(4,3) NOT NULL,
  diff_proposed     JSONB NOT NULL DEFAULT '[]',
  diff_accepted     JSONB NOT NULL DEFAULT '[]',
  diff_rejected     JSONB NOT NULL DEFAULT '[]',
  selected_at       TIMESTAMPTZ DEFAULT now()
);

-- Integrator AI access log
CREATE TABLE IF NOT EXISTS integrator_ai_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integrator_id   UUID REFERENCES users(id),
  project_id      UUID REFERENCES workflows_dataset(id) ON DELETE SET NULL,
  access_reason   VARCHAR(255),
  accessed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvh_project_id ON project_version_history (project_id);
CREATE INDEX IF NOT EXISTS idx_pdr_project_id ON project_dataset_refs (project_id);
CREATE INDEX IF NOT EXISTS idx_iaal_project_id ON integrator_ai_access_log (project_id);

DO $$
BEGIN
  RAISE NOTICE 'Migration 008 complete (v12 dataset schema)';
END $$;

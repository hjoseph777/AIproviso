-- =============================================================================
-- 006_workflow_history_rule_id.sql
-- Adds native rule_id persistence to workflow_state_history so the UI can bind
-- directly to engine-authored rule records without inference.
-- =============================================================================

ALTER TABLE workflow_state_history
  ADD COLUMN IF NOT EXISTS rule_id VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_workflow_state_history_rule_id
  ON workflow_state_history (rule_id, recorded_at DESC);
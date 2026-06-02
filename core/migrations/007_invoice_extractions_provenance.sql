-- =============================================================================
-- 007_invoice_extractions_provenance.sql
-- Adds provenance_json to invoice_extractions so the OCR recovery layer can
-- record which fields came from deterministic PaddleOCR and which were
-- repaired by phi4-mini — with original confidence and recovered value.
--
-- Provenance schema per field:
--   paddle:    { "value": <val>, "source": "paddle",   "confidence": 0.97 }
--   phi4-mini: { "value": <val>, "source": "phi4-mini", "confidence": 0.70,
--                "original_value": <old>, "original_confidence": 0.42 }
--   missing:   { "value": <val>, "source": "phi4-mini", "confidence": 0.60,
--                "was_missing": true }
-- =============================================================================

ALTER TABLE invoice_extractions
  ADD COLUMN IF NOT EXISTS provenance_json JSONB;

COMMENT ON COLUMN invoice_extractions.provenance_json IS
  'Per-field provenance: source (paddle|phi4-mini), confidence, and recovery metadata.
   Null when no provenance is recorded (pre-007 rows or pure deterministic extraction).';

CREATE INDEX IF NOT EXISTS idx_invoice_extractions_provenance_notnull
  ON invoice_extractions (invoice_id)
  WHERE provenance_json IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE 'Migration 007 complete: provenance_json added to invoice_extractions.';
END $$;

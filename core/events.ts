/**
 * core/events.ts
 * MOD-00 — Canonical Event Topic Registry
 *
 * PRD v8 Section 3.4: All 9 event topics defined here.
 * RULE: No module hardcodes an event string. Every module imports from here.
 * Adding a new event = add it here first, then update n8n webhook config.
 */

export const ProvisoEvents = {
  // ── MOD-01 → MOD-02 ───────────────────────────────────────────────────────
  /** Fired by MOD-01 when a document is received and archived to Paperless. */
  INVOICE_RECEIVED: 'invoice.received',

  // ── MOD-02 → MOD-03 (Phase II) / MOD-04 (Phase I) ────────────────────────
  /** Fired by MOD-02 when OCR + LLM extraction is complete with confidence scores. */
  INVOICE_EXTRACTED: 'invoice.extracted',

  // ── MOD-03 → MOD-04 ───────────────────────────────────────────────────────
  /** Fired by MOD-03 when 2-way/3-way match succeeds within tolerance. */
  INVOICE_MATCHED: 'invoice.matched',

  // ── MOD-03 / MOD-02 → MOD-06 ──────────────────────────────────────────────
  /** Fired when any module encounters a routing exception (low confidence, missing PO, etc.). */
  INVOICE_EXCEPTION: 'invoice.exception',

  // ── MOD-06 → MOD-04 ───────────────────────────────────────────────────────
  /** Fired by MOD-06 when an exception case is resolved. Re-enters approval flow. */
  INVOICE_RESOLVED: 'invoice.resolved',

  // ── MOD-04 → MOD-05 ───────────────────────────────────────────────────────
  /** Fired by MOD-04 when all required approvals are completed. */
  INVOICE_APPROVED: 'invoice.approved',

  // ── MOD-04 → MOD-06 / MOD-07 ──────────────────────────────────────────────
  /** Fired by MOD-04 when an approver explicitly rejects an invoice. Terminal state. */
  INVOICE_REJECTED: 'invoice.rejected',

  // ── MOD-05 → MOD-07 ───────────────────────────────────────────────────────
  /** Fired by MOD-05 when the ERP posting is confirmed with a reference number. */
  INVOICE_POSTED: 'invoice.posted',

  // ── ALL modules → MOD-07 ──────────────────────────────────────────────────
  /** Fired by every module for every state-change action. Consumed by MOD-07 audit trail. */
  AUDIT_EVENT: 'audit.event',
} as const;

export type ProvisoEventType = (typeof ProvisoEvents)[keyof typeof ProvisoEvents];

/**
 * Canonical event envelope — PRD v8 Section 3.3
 * Every event crossing module boundaries MUST conform to this shape.
 */
export interface ProvisoEventEnvelope {
  event: ProvisoEventType;
  schema_version: string;        // SemVer e.g. "1.0.0" — additive changes only within major
  invoice_id: string;            // UUID v4
  tenant_id: string;             // UUID v4
  payload: Record<string, unknown>;
  confidence?: Record<string, number>;  // per-field 0.0–1.0 (present on invoice.extracted)
  source_module: string;         // 'MOD-01' | 'MOD-02' | ... | 'MOD-08'
  correlation_id: string;        // UUID v4 — ties all events for one invoice lifecycle
  timestamp: string;             // ISO 8601
}

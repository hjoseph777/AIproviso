/**
 * core/types.ts
 * MOD-00 — Canonical TypeScript Interfaces
 *
 * PRD v8 Section 5: All shared data shapes defined here.
 * RULE: No module defines its own version of a shared type.
 * Every module imports from here — never duplicates.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

export type UUID = string;
export type ISOTimestamp = string;
export type ConfidenceScore = number;   // 0.0 – 1.0

export type UserRole = 'admin' | 'consultant' | 'ap_operator' | 'approver' | 'viewer';

export type InvoiceStatus =
  | 'received'
  | 'extracted'
  | 'matched'
  | 'pending_approval'
  | 'approved'
  | 'exception'
  | 'posted'
  | 'reconciled'
  | 'rejected';

export type ExceptionReasonCode =
  | 'VENDOR_UNKNOWN'
  | 'PO_REQUIRED'
  | 'VENDOR_AND_PO'
  | 'LOW_CONFIDENCE'
  | 'DUPLICATE_RISK'
  | 'POLICY_BREACH'
  | 'ERP_POST_FAIL'
  | 'MATCH_VARIANCE';

export type WorkflowSource = 'manual' | 'ai_generated' | 'ai_customized' | 'imported';
export type WorkflowComplexity = 'simple' | 'medium' | 'complex';
export type OCREngine = 'paddle' | 'doctr' | 'tesseract' | 'stub';

// ─────────────────────────────────────────────────────────────────────────────
// TENANT
// ─────────────────────────────────────────────────────────────────────────────

export interface TenantConfig {
  id: UUID;
  tenant_id: UUID;
  config_json: TenantPolicyConfig;
  version: number;
  updated_at: ISOTimestamp;
}

export interface TenantPolicyConfig {
  po_required: boolean;
  match_type: '2-way' | '3-way';
  default_currency: string;
  approval_thresholds: ApprovalThreshold[];
  sla_overrides: Partial<Record<ExceptionReasonCode, number>>;  // hours
  ocr_confidence_floor: ConfidenceScore;
  duplicate_window_days: number;
  alias_prefix: string;        // vault alias namespace prefix e.g. "XERX"
}

export interface ApprovalThreshold {
  amount: number;
  approver_role: UserRole;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: UUID;
  tenant_id: UUID;
  email: string;
  display_name?: string;
  role: UserRole;
  sso_subject?: string;    // OIDC sub claim
  active: boolean;
  created_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR
// ─────────────────────────────────────────────────────────────────────────────

export interface Vendor {
  id: UUID;
  tenant_id: UUID;
  name: string;
  display_name?: string;
  erp_vendor_number: string;
  account_number?: string;
  tax_id?: string;
  email_domain?: string;
  risk_score: ConfidenceScore;
  created_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE
// ─────────────────────────────────────────────────────────────────────────────

export interface Invoice {
  id: UUID;
  tenant_id: UUID;
  status: InvoiceStatus;
  correlation_id: UUID;
  paperless_id?: string;
  vendor_id?: UUID;
  received_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceExtraction {
  id: UUID;
  invoice_id: UUID;
  version: number;
  extracted_json: ExtractedInvoiceFields;
  confidence_json: FieldConfidenceMap;
  ocr_engine: OCREngine;
  raw_ocr_text?: string;
  page_count?: number;
  processing_ms?: number;
  created_at: ISOTimestamp;
}

export interface ExtractedInvoiceFields {
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  tax_amount?: number;
  currency?: string;
  po_number?: string;
  line_items?: InvoiceLineItem[];
  [key: string]: unknown;    // ERP-specific custom fields
}

export interface InvoiceLineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total: number;
}

export type FieldConfidenceMap = {
  [fieldName: string]: ConfidenceScore;
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowDefinition {
  id: UUID;
  tenant_id: UUID;
  workflow_json: WorkflowGraph;
  name?: string;
  version: string;
  active: boolean;
  created_by?: UUID;
  created_at: ISOTimestamp;
}

export interface WorkflowGraph {
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

export interface WorkflowState {
  id: string;
  label: string;
  type: 'ap_state' | 'approval_state' | 'exception_state' | 'terminal';
  approvers?: UUID[];
  sla_hours?: number;
  notification_targets?: string[];
}

export interface WorkflowTransition {
  from_state: string;
  to_state: string;
  condition?: string;      // expression evaluated by state machine
  label?: string;
}

export interface WorkflowSimulationRun {
  id: UUID;
  tenant_id: UUID;
  workflow_id: UUID;
  passed: boolean;
  run_by?: UUID;
  report_json?: SimulationReport;
  report_pdf?: string;
  created_at: ISOTimestamp;
}

export interface SimulationReport {
  steps: SimulationStep[];
  unreachable_states: string[];
  orphan_transitions: string[];
  passed: boolean;
}

export interface SimulationStep {
  from_state: string;
  to_state: string;
  rule_fired: string;
  timestamp: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: UUID;
  event_type: string;
  invoice_id?: UUID;
  user_id?: UUID;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  reason?: string;
  source_module: string;
  tenant_id: UUID;
  correlation_id?: UUID;
  recorded_at: ISOTimestamp;   // server-set only — never client-supplied
}

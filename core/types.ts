/**
 * core/types.ts
 * Canonical shared types for AI Proviso.
 *
 * Rules:
 * - Shared workflow concepts are defined here once.
 * - IDs are UUIDs, never labels.
 * - Definition types and runtime types are separate sections.
 * - UI, compiler, API, and runtime import from this file instead of redefining shapes locally.
 */

// -----------------------------------------------------------------------------
// PRIMITIVES
// -----------------------------------------------------------------------------

export type UUID = string;
export type ISOTimestamp = string;
export type CurrencyCode = string;
export type DurationMs = number;
export type ConfidenceScore = number;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

// -----------------------------------------------------------------------------
// ENUMS / DISCRIMINATORS
// -----------------------------------------------------------------------------

export type UserRole = 'admin' | 'consultant' | 'ap_operator' | 'approver' | 'viewer';
export type WorkflowDefinitionStatus = 'draft' | 'published' | 'retired';
export type WorkflowStateKind = 'initial' | 'standard' | 'approval' | 'exception' | 'technical' | 'terminal';
export type WorkflowSource = 'manual' | 'ai_generated' | 'ai_customized' | 'imported';
export type WorkflowComplexity = 'simple' | 'medium' | 'complex';
export type WorkItemPriority = 'low' | 'normal' | 'high' | 'critical';
export type EscalationAction = 'notify' | 'hold' | 'reassign' | 'escalate_board' | null;
export type NotificationChannel = 'email' | 'slack' | 'teams' | 'webhook' | 'vendor_portal';
export type IntegrationBindingType = 'n8n_webhook' | 'erp_sync' | 'notification' | 'document_intake' | 'custom';
export type WorkflowPropertyType = 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'json' | 'uuid';
export type WorkflowActionKind = 'entry' | 'exit' | 'pre_transition' | 'post_commit';
export type ServiceRefType = 'workflow_service' | 'ocr_worker' | 'erp_adapter' | 'notification_adapter' | 'custom';
export type DelayPolicyKind = 'none' | 'fixed_delay' | 'sla_timer' | 'escalation_timer';
export type OCREngine = 'pdfplumber' | 'paddle' | 'tesseract' | 'stub';
export type InvoiceStatus =
  | 'received'
  | 'extracted'
  | 'matched'
  | 'under_review'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'exception'
  | 'posted'
  | 'reconciled'
  | 'paid';
export type ExceptionReasonCode =
  | 'VENDOR_UNKNOWN'
  | 'PO_REQUIRED'
  | 'VENDOR_AND_PO'
  | 'LOW_CONFIDENCE'
  | 'DUPLICATE_RISK'
  | 'POLICY_BREACH'
  | 'ERP_POST_FAIL'
  | 'MATCH_VARIANCE';

// -----------------------------------------------------------------------------
// IDENTITY / TENANT
// -----------------------------------------------------------------------------

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
  default_currency: CurrencyCode;
  approval_thresholds: ApprovalThreshold[];
  sla_overrides: Partial<Record<ExceptionReasonCode, number>>;
  ocr_confidence_floor: ConfidenceScore;
  duplicate_window_days: number;
  alias_prefix: string;
}

export interface ApprovalThreshold {
  amount: number;
  approver_role: UserRole;
}

export interface User {
  id: UUID;
  tenant_id: UUID;
  email: string;
  display_name?: string;
  role: UserRole;
  sso_subject?: string;
  active: boolean;
  created_at: ISOTimestamp;
}

export interface Role {
  id: UUID;
  tenant_id: UUID;
  name: string;
  description?: string;
  capabilities: string[];
  active: boolean;
}

export interface Assignee {
  id: UUID;
  role_id: UUID;
  user_id: UUID;
  display_name: string;
  email: string;
  delegation_active: boolean;
}

// -----------------------------------------------------------------------------
// AP DOMAIN
// -----------------------------------------------------------------------------

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

export interface VendorProfile {
  id: UUID;
  tenant_id: UUID;
  vendor_id: UUID;
  canonical_name: string;
  known_aliases: string[];
  default_currency?: CurrencyCode;
  default_gl_codes: string[];
  average_confidence: ConfidenceScore;
  last_seen_at?: ISOTimestamp;
}

export interface GLCodingProfile {
  id: UUID;
  tenant_id: UUID;
  vendor_id: UUID;
  gl_code: string;
  cost_center?: string;
  confidence: ConfidenceScore;
  usage_count: number;
  last_used_at?: ISOTimestamp;
}

export interface AnomalyRule {
  id: UUID;
  tenant_id: UUID;
  name: string;
  description?: string;
  expression_dsl: string;
  severity: WorkItemPriority;
  active: boolean;
}

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

export interface InvoiceLineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total: number;
}

export interface ExtractedInvoiceFields {
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  tax_amount?: number;
  currency?: CurrencyCode;
  po_number?: string;
  line_items?: InvoiceLineItem[];
  [key: string]: unknown;
}

export interface FieldConfidence {
  field_name: string;
  confidence: ConfidenceScore;
  source?: string;
}

export type FieldConfidenceMap = Record<string, ConfidenceScore>;

export interface ExtractionResult {
  invoice_id: UUID;
  version: number;
  extracted_json: ExtractedInvoiceFields;
  confidence_json: FieldConfidenceMap;
  ocr_engine: OCREngine;
  raw_ocr_text?: string;
  page_count?: number;
  processing_ms?: number;
}

export interface InvoiceExtraction extends ExtractionResult {
  id: UUID;
  created_at: ISOTimestamp;
}

export interface ApprovalToken {
  id: UUID;
  tenant_id: UUID;
  invoice_id: UUID;
  workflow_instance_id: UUID;
  assignee_id: UUID;
  expires_at: ISOTimestamp;
  consumed_at?: ISOTimestamp;
}

export interface VendorPortalToken {
  id: UUID;
  tenant_id: UUID;
  invoice_id: UUID;
  workflow_instance_id: UUID;
  vendor_id: UUID;
  expires_at: ISOTimestamp;
  consumed_at?: ISOTimestamp;
}

// -----------------------------------------------------------------------------
// WORKFLOW DEFINITION TYPES
// -----------------------------------------------------------------------------

export interface WorkflowVersion {
  id: UUID;
  workflow_definition_id: UUID;
  version: number;
  status: WorkflowDefinitionStatus;
  published_at?: ISOTimestamp;
  retired_at?: ISOTimestamp;
}

export interface WorkflowDefinition {
  id: UUID;
  tenant_id: UUID;
  version: number;
  status: WorkflowDefinitionStatus;
  source?: WorkflowSource;
  complexity?: WorkflowComplexity;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  roles: RoleDefinition[];
  approval_matrix: ApprovalMatrixEntry[];
  sla_policies: SLAPolicy[];
  escalation_policies: EscalationPolicy[];
  delay_policies: DelayPolicy[];
  integration_bindings: IntegrationBinding[];
  document_requirements: DocumentRequirement[];
  workflow_properties: WorkflowProperty[];
  guard_registry: GuardDefinition[];
  action_registry: ActionDefinition[];
  service_registry: ServiceRef[];
  notification_registry: NotificationRef[];
  task_policies: TaskPolicy[];
  created_by?: UUID;
  created_at?: ISOTimestamp;
  updated_at?: ISOTimestamp;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: UUID;
  state_kind: WorkflowStateKind;
  name: string;
  description?: string;
  assignee_role_id?: UUID | null;
  fallback_role_id?: UUID | null;
  sla_policy_id?: UUID | null;
  escalation_policy_id?: UUID | null;
  entry_action_ids: UUID[];
  exit_action_ids: UUID[];
  invoked_service_id?: UUID | null;
  behaviour_flags: BehaviourFlags;
  tags: string[];
  canvas_position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: UUID;
  from_node_id: UUID;
  to_node_id: UUID;
  event_type: string;
  label?: string;
  guard_id?: UUID | null;
  pre_action_ids: UUID[];
  post_notification_ids: UUID[];
  integration_binding_ids: UUID[];
  delay_policy_id?: UUID | null;
  reentry: boolean;
  internal: boolean;
}

export interface GuardParam {
  name: string;
  type: WorkflowPropertyType;
  required: boolean;
  description?: string;
}

export interface GuardDefinition {
  id: UUID;
  name: string;
  expression_dsl: string;
  parameters: GuardParam[];
  description?: string;
}

export interface ApprovalMatrixEntry {
  id: UUID;
  node_id: UUID;
  role_id: UUID;
  amount_floor?: number | null;
  amount_ceiling?: number | null;
  currency: CurrencyCode;
  condition_guard_ids: UUID[];
}

export interface SLAPolicy {
  id: UUID;
  name: string;
  duration_ms: DurationMs;
  escalation_policy_id?: UUID | null;
}

export interface DelayPolicy {
  id: UUID;
  kind: DelayPolicyKind;
  duration_ms: DurationMs;
  target_node_id?: UUID | null;
}

export interface EscalationLevel {
  level: number;
  after_ms: DurationMs;
  notify_role_id?: UUID | null;
  action: EscalationAction;
}

export interface EscalationPolicy {
  id: UUID;
  name: string;
  levels: EscalationLevel[];
}

export interface IntegrationBinding {
  id: UUID;
  name: string;
  type: IntegrationBindingType;
  target_ref: string;
  config: JsonObject;
}

export interface DocumentRequirement {
  id: UUID;
  node_id: UUID;
  code: string;
  label: string;
  required: boolean;
  accepted_mime_types: string[];
}

export interface WorkflowProperty {
  id: UUID;
  key: string;
  label: string;
  type: WorkflowPropertyType;
  required: boolean;
  default_value?: JsonValue;
  description?: string;
}

export interface BehaviourFlags {
  comments_enabled: boolean;
  email_approval_enabled: boolean;
  vendor_reply_enabled: boolean;
  lock_fields_on_entry: boolean;
  on_missing_po: 'continue' | 'route_exception' | 'semantic_code';
  token_expiry_hours?: number;
  gl_suggestion_enabled: boolean;
  anomaly_check_enabled: boolean;
  duplicate_check_enabled?: boolean;
}

export interface ActionRef {
  id: UUID;
  kind: WorkflowActionKind;
  name: string;
  description?: string;
}

export interface ActionDefinition extends ActionRef {
  config?: JsonObject;
}

export interface ServiceRef {
  id: UUID;
  type: ServiceRefType;
  name: string;
  description?: string;
  config?: JsonObject;
}

export interface NotificationRef {
  id: UUID;
  channel: NotificationChannel;
  name: string;
  binding_id?: UUID | null;
  template_id?: UUID | null;
  config?: JsonObject;
}

export interface RoleDefinition {
  id: UUID;
  name: string;
  description?: string;
  capability_keys: string[];
}

export interface TaskPolicy {
  id: UUID;
  node_id: UUID;
  assignment_role_id?: UUID | null;
  fallback_role_id?: UUID | null;
  priority: WorkItemPriority;
  allow_reassignment: boolean;
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
  unreachable_states: UUID[];
  orphan_transitions: UUID[];
  passed: boolean;
}

export interface SimulationStep {
  from_state_id: UUID;
  to_state_id: UUID;
  rule_fired: UUID | string;
  timestamp: ISOTimestamp;
}

// -----------------------------------------------------------------------------
// WORKFLOW RUNTIME TYPES
// -----------------------------------------------------------------------------

export interface WorkflowInstance {
  id: UUID;
  tenant_id: UUID;
  workflow_definition_id: UUID;
  workflow_version: number;
  invoice_id: UUID;
  current_node_id: UUID;
  is_terminal: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface WorkflowSnapshot {
  version: number;
  value: string | JsonObject;
  context: JsonObject;
  status?: 'active' | 'done' | 'error' | 'stopped';
}

export interface WorkflowStateRecord {
  id: UUID;
  tenant_id: UUID;
  invoice_id: UUID;
  workflow_definition_id: UUID;
  workflow_version: number;
  machine_id: string;
  current_state: string;
  snapshot_json: WorkflowSnapshot;
  context_json: JsonObject;
  last_event?: string;
  optimistic_lock_version: number;
  entered_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface WorkflowTransitionRecord {
  id: UUID;
  tenant_id: UUID;
  invoice_id: UUID;
  workflow_definition_id: UUID;
  workflow_version: number;
  previous_state: string;
  next_state: string;
  event_type: string;
  guard_id?: UUID | null;
  guard_result?: boolean | null;
  guard_parameters?: JsonObject;
  actor_id?: UUID | null;
  actor_role?: string | null;
  duration_in_prev_ms?: number | null;
  changed_properties?: JsonObject;
  snapshot_after: WorkflowSnapshot;
  correlation_id: UUID;
  recorded_at: ISOTimestamp;
}

export interface TimerRecord {
  id: UUID;
  tenant_id: UUID;
  invoice_id: UUID;
  workflow_instance_id: UUID;
  policy_id?: UUID | null;
  queue_name: string;
  job_id: string;
  due_at: ISOTimestamp;
  cancelled_at?: ISOTimestamp;
  fired_at?: ISOTimestamp;
}

export interface AuditRecord {
  id: UUID;
  tenant_id: UUID;
  invoice_id?: UUID;
  workflow_instance_id?: UUID;
  event_type: string;
  actor_id?: UUID;
  actor_role?: string;
  guard_id?: UUID | null;
  guard_result?: boolean | null;
  old_value?: JsonObject;
  new_value?: JsonObject;
  changed_properties?: JsonObject;
  correlation_id?: UUID;
  source_module: string;
  reason?: string;
  recorded_at: ISOTimestamp;
}

export interface TaskAssignment {
  id: UUID;
  tenant_id: UUID;
  invoice_id: UUID;
  workflow_instance_id: UUID;
  node_id: UUID;
  assignee_id?: UUID | null;
  role_id?: UUID | null;
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  priority: WorkItemPriority;
  due_at?: ISOTimestamp;
  created_at: ISOTimestamp;
  completed_at?: ISOTimestamp;
}

// -----------------------------------------------------------------------------
// WORKFLOW EVENTS
// -----------------------------------------------------------------------------

export interface WorkflowEventBase {
  type: string;
  invoice_id: UUID;
  tenant_id: UUID;
  correlation_id: UUID;
  actor_id?: UUID;
  actor_role?: string;
  payload?: JsonObject;
}

export interface OCRCompleteEvent extends WorkflowEventBase {
  type: 'workflow.ocr_complete';
  extraction_id: UUID;
}

export interface ExtractionCompleteEvent extends WorkflowEventBase {
  type: 'workflow.extraction_complete';
  confidence: ConfidenceScore;
}

export interface MatchCompleteEvent extends WorkflowEventBase {
  type: 'workflow.match_complete';
  matched: boolean;
}

export interface ApproveEvent extends WorkflowEventBase {
  type: 'workflow.approve';
  approval_token_id?: UUID;
}

export interface RejectEvent extends WorkflowEventBase {
  type: 'workflow.reject';
  reason_code?: ExceptionReasonCode;
}

export interface SLABreachEvent extends WorkflowEventBase {
  type: 'workflow.sla_breach';
  timer_id: UUID;
}

export interface ExceptionEvent extends WorkflowEventBase {
  type: 'workflow.exception';
  reason_code: ExceptionReasonCode;
}

export interface TokenApprovalEvent extends WorkflowEventBase {
  type: 'workflow.token_approval';
  approval_token_id: UUID;
}

export type WorkflowEvent =
  | OCRCompleteEvent
  | ExtractionCompleteEvent
  | MatchCompleteEvent
  | ApproveEvent
  | RejectEvent
  | SLABreachEvent
  | ExceptionEvent
  | TokenApprovalEvent;

// -----------------------------------------------------------------------------
// LEGACY COMPATIBILITY ALIASES
// -----------------------------------------------------------------------------

export type WorkflowState = WorkflowNode;
export type WorkflowTransition = WorkflowEdge;
export interface AuditEvent extends AuditRecord {}

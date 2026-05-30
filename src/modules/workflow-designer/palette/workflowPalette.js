export const WORKFLOW_PALETTE_MIME = 'application/x-proviso-workflow-state';

export const WORKFLOW_PALETTE_ITEMS = [
  { stateKind: 'standard', label: 'Standard', icon: '◎', color: '#4A9FFF', description: 'General routing state' },
  { stateKind: 'approval', label: 'Approval', icon: '✦', color: '#F0A500', description: 'Decision and approval gate' },
  { stateKind: 'exception', label: 'Exception', icon: '⚑', color: '#FF3D5A', description: 'Escalation and exception path' },
  { stateKind: 'technical', label: 'Technical', icon: '⚙', color: '#20C3D8', description: 'System task or service step' },
  { stateKind: 'terminal', label: 'Terminal', icon: '⏹', color: '#9B7EFF', description: 'Completion or closed outcome' },
];

export const AP_WORKFLOW_TEMPLATES = [
  { id: 'ap-ingest', stateKind: 'technical', name: 'Ingest Invoice', label: 'Ingest Invoice', icon: '⭳', color: '#20C3D8', description: 'Capture invoice payload from intake channel' },
  { id: 'ap-ocr', stateKind: 'technical', name: 'OCR Extraction', label: 'OCR Extraction', icon: '⌁', color: '#20C3D8', description: 'Extract header and line-item data' },
  { id: 'ap-3way', stateKind: 'approval', name: '3-Way Match', label: '3-Way Match', icon: '≡', color: '#F0A500', description: 'Compare invoice, PO, and goods receipt' },
  { id: 'ap-line-validation', stateKind: 'standard', name: 'Line Item Validation', label: 'Line Item Validation', icon: '☰', color: '#4A9FFF', description: 'Validate totals, taxes, and coding rules' },
  { id: 'ap-manager-approval', stateKind: 'approval', name: 'Manager Approval', label: 'Manager Approval', icon: '✓', color: '#F0A500', description: 'Route for manager decision based on threshold' },
  { id: 'ap-post-erp', stateKind: 'terminal', name: 'Post to ERP', label: 'Post to ERP', icon: '⇢', color: '#9B7EFF', description: 'Finalize posting to ERP and archive' },
  { id: 'ap-exception', stateKind: 'exception', name: 'Exception Queue', label: 'Exception Queue', icon: '⚑', color: '#FF3D5A', description: 'Hold and triage failed matches or policy breaks' },
];

export function serializeWorkflowPaletteItem(item) {
  return JSON.stringify({
    id: item?.id || null,
    stateKind: item?.stateKind || 'standard',
    name: item?.name || null,
    label: item?.label || null,
  });
}

const GLOBAL_DRAG_KEY = '__provisoPaletteDragItem';

export function setGlobalWorkflowPaletteDragItem(item) {
  if (typeof window === 'undefined') return;
  const serialized = item ? serializeWorkflowPaletteItem(item) : '';
  if (!serialized) {
    delete window[GLOBAL_DRAG_KEY];
    return;
  }
  window[GLOBAL_DRAG_KEY] = serialized;
}

export function getGlobalWorkflowPaletteDragItem() {
  if (typeof window === 'undefined') return null;
  return parseWorkflowPaletteItem(window[GLOBAL_DRAG_KEY] || '');
}

export function parseWorkflowPaletteItem(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    const stateKind = String(parsed?.stateKind || '').trim().toLowerCase();
    const base = WORKFLOW_PALETTE_ITEMS.find((item) => item.stateKind === stateKind);
    if (!base) return null;

    return {
      ...base,
      id: parsed?.id || null,
      name: parsed?.name || null,
      label: parsed?.label || base.label,
    };
  } catch {
    return null;
  }
}

export function parseWorkflowPaletteDataTransfer(dataTransfer) {
  if (!dataTransfer) return null;

  // 1) Preferred custom payload
  const raw = dataTransfer.getData(WORKFLOW_PALETTE_MIME);
  const parsed = parseWorkflowPaletteItem(raw);
  if (parsed) return parsed;

  // 2) Compatibility with standard React Flow tutorials
  const nodeType = String(dataTransfer.getData('application/reactflow') || '').trim().toLowerCase();
  const nodeLabel = String(dataTransfer.getData('application/nodeLabel') || '').trim();
  if (!nodeType) return null;

  const base = WORKFLOW_PALETTE_ITEMS.find((item) => item.stateKind === nodeType);
  if (!base) return null;

  return {
    ...base,
    name: nodeLabel || base.label,
    label: nodeLabel || base.label,
  };
}
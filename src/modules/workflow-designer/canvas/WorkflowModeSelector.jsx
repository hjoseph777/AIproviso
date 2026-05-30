import { useState } from 'react';

// ── AP Workflow Templates for Mode 1 ─────────────────────────────────────────
export const AP_TEMPLATES = [
  {
    id: 'tpl-invoice-3way',
    name: 'Invoice Approval — 3-Way Match',
    description: 'Full AP flow: OCR → 3-way match → approval routing → exception queue',
    icon: '📋',
    tags: ['3-way match', 'dual approval', 'exception'],
    states: [
      { id: 'ap01', name: 'Received',         state_kind: 'initial',   canvas_position: { x: 220, y: 80 } },
      { id: 'ap02', name: 'OCR Extracted',    state_kind: 'technical', canvas_position: { x: 220, y: 255 } },
      { id: 'ap03', name: 'Matched',          state_kind: 'technical', canvas_position: { x: 220, y: 430 } },
      { id: 'ap04', name: 'Pending Approval', state_kind: 'approval',  canvas_position: { x: 220, y: 605 } },
      { id: 'ap05', name: 'Manager Approval', state_kind: 'approval',  canvas_position: { x: -40, y: 780 } },
      { id: 'ap06', name: 'CFO Approval',     state_kind: 'approval',  canvas_position: { x: 480, y: 780 } },
      { id: 'ap07', name: 'Approved',         state_kind: 'terminal',  canvas_position: { x: 220, y: 955 } },
      { id: 'ap08', name: 'Exception',        state_kind: 'exception', canvas_position: { x: 720, y: 340 } },
      { id: 'ap09', name: 'Escalated',        state_kind: 'exception', canvas_position: { x: 720, y: 700 } },
    ],
    transitions: [
      { id: 'at01', from_node_id: 'ap01', to_node_id: 'ap02', label: 'OCR extract' },
      { id: 'at02', from_node_id: 'ap02', to_node_id: 'ap03', label: 'conf ≥ 0.70' },
      { id: 'at03', from_node_id: 'ap02', to_node_id: 'ap08', label: 'conf < 0.70' },
      { id: 'at04', from_node_id: 'ap03', to_node_id: 'ap04', label: 'PO match' },
      { id: 'at05', from_node_id: 'ap03', to_node_id: 'ap08', label: 'no PO' },
      { id: 'at06', from_node_id: 'ap04', to_node_id: 'ap05', label: '≤ $25k' },
      { id: 'at07', from_node_id: 'ap04', to_node_id: 'ap06', label: '> $25k' },
      { id: 'at08', from_node_id: 'ap05', to_node_id: 'ap07', label: 'APPROVE' },
      { id: 'at09', from_node_id: 'ap06', to_node_id: 'ap07', label: 'APPROVE' },
      { id: 'at10', from_node_id: 'ap06', to_node_id: 'ap09', label: 'after 4h' },
    ],
  },
  {
    id: 'tpl-invoice-simple',
    name: 'Invoice Approval — Simple',
    description: 'Lightweight: single approval gate, no dual routing',
    icon: '✅',
    tags: ['single approval', 'simple'],
    states: [
      { id: 'si01', name: 'Received',        state_kind: 'initial',   canvas_position: { x: 220, y: 80 } },
      { id: 'si02', name: 'Under Review',    state_kind: 'technical', canvas_position: { x: 220, y: 255 } },
      { id: 'si03', name: 'Approval Gate',   state_kind: 'approval',  canvas_position: { x: 220, y: 430 } },
      { id: 'si04', name: 'Approved',        state_kind: 'terminal',  canvas_position: { x: 220, y: 605 } },
      { id: 'si05', name: 'Rejected',        state_kind: 'exception', canvas_position: { x: 600, y: 430 } },
    ],
    transitions: [
      { id: 'st01', from_node_id: 'si01', to_node_id: 'si02', label: 'submit' },
      { id: 'st02', from_node_id: 'si02', to_node_id: 'si03', label: 'review complete' },
      { id: 'st03', from_node_id: 'si03', to_node_id: 'si04', label: 'approve' },
      { id: 'st04', from_node_id: 'si03', to_node_id: 'si05', label: 'reject' },
    ],
  },
  {
    id: 'tpl-po-match',
    name: 'PO Matching — Exception Routing',
    description: 'Focus on PO validation with exception handling and resolution loop',
    icon: '🔍',
    tags: ['PO match', 'exception', 'resolution'],
    states: [
      { id: 'po01', name: 'Received',       state_kind: 'initial',   canvas_position: { x: 220, y: 80 } },
      { id: 'po02', name: 'PO Lookup',      state_kind: 'technical', canvas_position: { x: 220, y: 255 } },
      { id: 'po03', name: 'PO Matched',     state_kind: 'technical', canvas_position: { x: 220, y: 430 } },
      { id: 'po04', name: 'Approval',       state_kind: 'approval',  canvas_position: { x: 220, y: 605 } },
      { id: 'po05', name: 'Posted',         state_kind: 'terminal',  canvas_position: { x: 220, y: 780 } },
      { id: 'po06', name: 'PO Exception',   state_kind: 'exception', canvas_position: { x: 600, y: 255 } },
      { id: 'po07', name: 'Vendor Contact', state_kind: 'exception', canvas_position: { x: 600, y: 430 } },
    ],
    transitions: [
      { id: 'pt01', from_node_id: 'po01', to_node_id: 'po02', label: 'intake' },
      { id: 'pt02', from_node_id: 'po02', to_node_id: 'po03', label: 'PO found' },
      { id: 'pt03', from_node_id: 'po02', to_node_id: 'po06', label: 'no PO' },
      { id: 'pt04', from_node_id: 'po03', to_node_id: 'po04', label: 'matched' },
      { id: 'pt05', from_node_id: 'po04', to_node_id: 'po05', label: 'approve' },
      { id: 'pt06', from_node_id: 'po06', to_node_id: 'po07', label: 'escalate' },
      { id: 'pt07', from_node_id: 'po07', to_node_id: 'po02', label: 'PO provided' },
    ],
  },
];

// ── Mode 3 — AI scenario parser (no backend needed) ───────────────────────────
export function parseScenario(text) {
  const t = text.toLowerCase();
  const makeId = () => Math.random().toString(36).slice(2, 7);
  const states = [];
  const transitions = [];

  const addState = (name, kind) => {
    const id = makeId();
    states.push({ id, name, state_kind: kind, canvas_position: { x: 220, y: 80 + states.length * 175 } });
    return id;
  };

  const addTrans = (from, to, label) => transitions.push({ id: makeId(), from_node_id: from, to_node_id: to, label });

  // Always: initial intake
  const rcv = addState('Received', 'initial');

  // OCR / extraction
  if (/ocr|extract|scan|digitiz|header|line.item/.test(t)) {
    const ext = addState('OCR Extracted', 'technical');
    addTrans(rcv, ext, 'auto-extract');
  }

  // PO / 3-way match
  if (/3.way|three.way|po match|purchase.order|match|verify/.test(t)) {
    const matched = addState('3-Way Match', 'technical');
    const prev = states[states.length - 2]?.id || rcv;
    addTrans(prev, matched, 'PO match');
  }

  // Pending approval gate
  const pend = addState('Pending Approval', 'approval');
  const prevPend = states[states.length - 2]?.id || rcv;
  addTrans(prevPend, pend, 'submit');

  // Manager
  if (/manager|supervisor|team.lead/.test(t)) {
    const mgr = addState('Manager Approval', 'approval');
    addTrans(pend, mgr, '≤ threshold');
  }

  // CFO / exec
  if (/cfo|exec|c.suite|director|vp/.test(t)) {
    const cfo = addState('CFO Approval', 'approval');
    const prevCFO = states.length > 3 ? pend.id : states[states.length - 2]?.id;
    addTrans(pend, cfo, '> threshold');
  }

  // Exception / escalation
  if (/exception|escalat|hold|queue|reject|error/.test(t)) {
    const exc = addState('Exception Queue', 'exception');
    const src = states.find(s => s.state_kind === 'technical')?.id || pend;
    addTrans(src, exc, 'exception');
  }

  // Terminal
  const approved = addState('Approved', 'terminal');
  const approvalStates = states.filter(s => s.state_kind === 'approval');
  approvalStates.forEach(s => addTrans(s.id, approved, 'approve'));

  return { states, transitions };
}

// ── DEFAULT_WORKFLOW — ships with AI Proviso, always available ────────────────
// Complete production-ready AP workflow. Opening it creates a named COPY.
// The original preset is never modified.
export const DEFAULT_WORKFLOW = {
  id: 'preset-default-ap',
  name: 'Invoice Approval Flow',
  isPreset: true,
  version: '2.1',
  states: [
    { id: 'ap01', name: 'Received',         state_kind: 'initial',   canvas_position: { x: 220, y: 80 } },
    { id: 'ap02', name: 'Extracted',        state_kind: 'technical', canvas_position: { x: 220, y: 255 } },
    { id: 'ap03', name: 'Matched',          state_kind: 'technical', canvas_position: { x: 220, y: 430 } },
    { id: 'ap04', name: 'Pending Approval', state_kind: 'approval',  canvas_position: { x: 220, y: 605 } },
    { id: 'ap05', name: 'Manager Approval', state_kind: 'approval',  canvas_position: { x: -40, y: 780 } },
    { id: 'ap06', name: 'CFO Approval',     state_kind: 'approval',  canvas_position: { x: 480, y: 780 } },
    { id: 'ap07', name: 'Approved',         state_kind: 'terminal',  canvas_position: { x: 220, y: 955 } },
    { id: 'ap08', name: 'Exception',        state_kind: 'exception', canvas_position: { x: 720, y: 340 } },
    { id: 'ap09', name: 'Escalated',        state_kind: 'exception', canvas_position: { x: 720, y: 700 } },
  ],
  transitions: [
    { id: 'at01', from_node_id: 'ap01', to_node_id: 'ap02', label: 'OCR extract' },
    { id: 'at02', from_node_id: 'ap02', to_node_id: 'ap03', label: 'conf ≥ 0.70' },
    { id: 'at03', from_node_id: 'ap02', to_node_id: 'ap08', label: 'conf < 0.70' },
    { id: 'at04', from_node_id: 'ap03', to_node_id: 'ap04', label: 'PO match' },
    { id: 'at05', from_node_id: 'ap03', to_node_id: 'ap08', label: 'no PO' },
    { id: 'at06', from_node_id: 'ap04', to_node_id: 'ap05', label: '≤ $25k' },
    { id: 'at07', from_node_id: 'ap04', to_node_id: 'ap06', label: '> $25k' },
    { id: 'at08', from_node_id: 'ap04', to_node_id: 'ap09', label: 'after 4h' },
    { id: 'at09', from_node_id: 'ap05', to_node_id: 'ap07', label: 'APPROVE' },
    { id: 'at10', from_node_id: 'ap05', to_node_id: 'ap04', label: 'REJECT' },
    { id: 'at11', from_node_id: 'ap06', to_node_id: 'ap07', label: 'APPROVE' },
    { id: 'at12', from_node_id: 'ap06', to_node_id: 'ap04', label: 'REJECT' },
  ],
  // Pre-loaded test invoices that route through every path of the workflow
  sampleInvoices: [
    { id: 'INV-001', amount: 12400,  vendor: 'Acme Corp',    confidence: 0.94, route: '→ Manager' },
    { id: 'INV-002', amount: 74200,  vendor: 'TechSupply',   confidence: 0.91, route: '→ CFO' },
    { id: 'INV-003', amount: 8900,   vendor: 'OfficeMax',    confidence: 0.88, route: '→ Manager' },
    { id: 'INV-004', amount: 0,      vendor: 'Unknown',      confidence: 0.00, route: '→ Exception' },
    { id: 'INV-005', amount: 142000, vendor: 'SAP Services', confidence: 0.96, route: '→ CFO' },
    { id: 'INV-006', amount: 5200,   vendor: 'Staples',      confidence: 0.58, route: '→ Exception' },
  ],
  // The 4 most common adjustments across 142 deployments
  commonAdjustments: [
    { id: 'threshold', label: 'Change approval threshold', current: 'Currently $25k',      action: 'Edit guard' },
    { id: 'tier',      label: 'Add approval tier',         current: 'Director / VP level', action: 'Add state' },
    { id: 'sla',       label: 'Update SLA duration',       current: 'Currently 4h',        action: 'Edit policy' },
    { id: 'erp',       label: 'Change ERP target',         current: 'SAP S/4HANA',         action: 'Change' },
  ],
};

const KIND_COLORS_PRESET = { initial: '#00C870', approval: '#E5B04C', exception: '#FF5B73', technical: '#43BFD0', terminal: '#9B7EFF' };

// ── Mode card component ───────────────────────────────────────────────────────
function ModeCard({ mode, icon, title, tag, description, selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200',
        selected
          ? 'border-sky-400/60 bg-sky-500/10 ring-2 ring-sky-400/30 shadow-[0_0_24px_rgba(56,189,248,.18)]'
          : 'border-white/[0.08] bg-slate-900/60 hover:border-white/[0.2] hover:bg-slate-800/70 hover:shadow-lg',
      ].join(' ')}
    >
      {/* Mode badge */}
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selected ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.05] text-slate-500'}`}>
        {mode}
      </span>

      {/* Icon + title */}
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">{icon}</span>
        <div>
          <div className={`text-[15px] font-bold leading-snug ${selected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
            {title}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-sky-400/70">{tag}</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[11px] leading-relaxed text-slate-400 group-hover:text-slate-300 transition-colors">
        {description}
      </p>

      {/* Mode-specific child content */}
      {children}

      {/* Selected indicator */}
      {selected && (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white shadow-lg">
          ✓
        </div>
      )}
    </button>
  );
}

// ── Main WorkflowModeSelector ─────────────────────────────────────────────────
export default function WorkflowModeSelector({ onSelect, onDismiss, existingWorkflows = [] }) {
  const [mode, setMode]               = useState(null);
  const [template, setTemplate]       = useState(AP_TEMPLATES[0].id);
  const [scenario, setScenario]       = useState('');
  const [generating, setGenerating]   = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [checkedAdj, setCheckedAdj]   = useState({});

  const toggleAdj = (id) => setCheckedAdj(prev => ({ ...prev, [id]: !prev[id] }));

  const handleCreate = () => {
    if (!mode) return;

    if (mode === 1) {
      const tpl = AP_TEMPLATES.find(t => t.id === template);
      onSelect({ mode: 1, template: tpl, name: workflowName || tpl?.name });
    } else if (mode === 2) {
      onSelect({ mode: 2, name: workflowName || 'New Workflow' });
    } else if (mode === 3) {
      setGenerating(true);
      setTimeout(() => {
        const parsed = parseScenario(scenario);
        setGenerating(false);
        onSelect({ mode: 3, parsed, name: workflowName || 'AI Generated Workflow' });
      }, 800);
    } else if (mode === 4) {
      // Creates a COPY of the preset with a new UUID — original never modified
      onSelect({
        mode: 4,
        preset: DEFAULT_WORKFLOW,
        name: workflowName || `${DEFAULT_WORKFLOW.name} — ${new Date().toLocaleDateString('en-CA')}`,
        checkedAdjustments: Object.keys(checkedAdj).filter(k => checkedAdj[k]),
      });
    }
  };

  const canCreate = (
    mode === 1 ||
    mode === 2 ||
    (mode === 3 && scenario.trim().length > 10) ||
    mode === 4
  );

  const footerLabel =
    mode === 4 ? '🚀 Open Preset Copy'
    : mode === 3 ? '✨ Generate'
    : mode === 2 ? '✏️ Start Empty'
    : mode === 1 ? '⚡ Use Template'
    : 'Choose a Mode';

  const footerPlaceholder =
    mode === 4 ? `${DEFAULT_WORKFLOW.name} — ${new Date().toLocaleDateString('en-CA')}`
    : mode === 1 ? (AP_TEMPLATES.find(t => t.id === template)?.name || 'New Workflow')
    : mode === 2 ? 'My New Workflow'
    : 'AI Generated Workflow';

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,14,.85)', backdropFilter: 'blur(14px)' }}
    >
      <div className="w-full max-w-[1080px] rounded-2xl border border-white/[0.08] bg-slate-950/97 shadow-2xl shadow-black/70 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div>
            <h2 className="text-[17px] font-bold text-white">Workflow Studio</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Four entry paths into the designer — pick the one that fits your session
            </p>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-white/[0.08] bg-slate-800/50 p-1.5 text-slate-400 hover:border-white/[0.2] hover:text-white transition-colors"
              title="Cancel"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* ── 2 × 2 mode grid ── */}
        <div className="grid grid-cols-2 gap-3 p-5">

          {/* Row 1 left — Mode 1: Rapid Fire from Dataset */}
          <ModeCard
            mode="Mode 1"
            icon="⚡"
            title="Rapid Fire from Dataset"
            tag="Templates · Ready in seconds"
            description="Pick a pre-built AP workflow template. States, transitions, and routing logic are already wired — customise the details."
            selected={mode === 1}
            onClick={() => setMode(1)}
          >
            {mode === 1 && (
              <div className="mt-1 w-full space-y-1.5" onClick={e => e.stopPropagation()}>
                {AP_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplate(tpl.id)}
                    className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${template === tpl.id ? 'border-sky-400/50 bg-sky-500/15 text-sky-200' : 'border-white/[0.07] bg-slate-800/50 text-slate-300 hover:border-white/[0.15]'}`}
                  >
                    <span className="text-base leading-none flex-shrink-0">{tpl.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold leading-snug">{tpl.name}</span>
                      <span className="block text-[8.5px] text-slate-500 mt-0.5 truncate">{tpl.description}</span>
                    </span>
                    {template === tpl.id && <span className="ml-auto text-sky-400 flex-shrink-0">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </ModeCard>

          {/* Row 1 right — Mode 2: Draw from Scratch */}
          <ModeCard
            mode="Mode 2"
            icon="✏️"
            title="Draw from Scratch"
            tag="Empty canvas · Full control"
            description="Start with a blank canvas. Drag AP state types from the palette, connect handles to wire transitions, and define your logic from the ground up."
            selected={mode === 2}
            onClick={() => setMode(2)}
          >
            {mode === 2 && (
              <div className="mt-1 w-full rounded-xl border border-white/[0.07] bg-slate-800/40 p-3" onClick={e => e.stopPropagation()}>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Full AP Component Palette on the left — drag states onto the canvas and connect their handles.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {['initial', 'approval', 'technical', 'exception', 'terminal'].map(kind => (
                    <span key={kind} className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[8.5px] text-slate-400 capitalize">
                      {kind}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </ModeCard>

          {/* Row 2 left — Mode 3: AI Generated */}
          <ModeCard
            mode="Mode 3"
            icon="✨"
            title="AI Generated"
            tag="Scenario prompt · Instant draft"
            description="Describe your AP process in plain language. The engine parses your scenario and generates a workflow draft — states, transitions, and routing logic included."
            selected={mode === 3}
            onClick={() => setMode(3)}
          >
            {mode === 3 && (
              <div className="mt-1 w-full space-y-2" onClick={e => e.stopPropagation()}>
                <textarea
                  className="w-full resize-none rounded-xl border border-white/[0.1] bg-slate-800/60 px-3 py-2.5 text-[10.5px] text-slate-200 placeholder-slate-600 outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/20 leading-relaxed"
                  rows={4}
                  placeholder="e.g. 3-way match invoice approval with manager for amounts under $25k, CFO for over $25k, exception queue for unmatched POs, escalation after 4 hours…"
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  autoFocus
                />
                {scenario.trim().length > 5 && (
                  <p className="text-[9px] text-emerald-400/80">
                    ✓ Ready to generate — {scenario.trim().split(/\s+/).length} words
                  </p>
                )}
              </div>
            )}
          </ModeCard>

          {/* Row 2 right — Mode 4: Preset Default */}
          <ModeCard
            mode="Mode 4"
            icon="🚀"
            title="Preset Default"
            tag="Everything pre-loaded · Fastest path"
            description="Start from a complete, production-ready AP workflow. 9 states, 12 transitions, guards, SLA policies, and 6 sample invoices are already configured — just adjust for your client."
            selected={mode === 4}
            onClick={() => setMode(4)}
          >
            {mode === 4 && (
              <div className="mt-2 w-full space-y-3" onClick={e => e.stopPropagation()}>

                {/* What's included — KPI strip */}
                <div className="rounded-xl border border-violet-400/22 bg-violet-500/8 p-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400/80">Pre-loaded in this preset</span>
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[8px] font-bold text-violet-300">
                      {DEFAULT_WORKFLOW.version}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[
                      { n: DEFAULT_WORKFLOW.states.length,      label: 'states' },
                      { n: DEFAULT_WORKFLOW.transitions.length, label: 'transitions' },
                      { n: 5,                                   label: 'guards' },
                      { n: DEFAULT_WORKFLOW.sampleInvoices.length, label: 'test invoices' },
                    ].map(({ n, label }) => (
                      <div key={label} className="rounded-lg bg-slate-900/60 py-1.5">
                        <div className="text-[15px] font-bold text-white leading-none">{n}</div>
                        <div className="mt-0.5 text-[8px] text-slate-500 leading-none">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Kind colour bar — proportional state kind breakdown */}
                  <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full">
                    {Object.entries(
                      DEFAULT_WORKFLOW.states.reduce((acc, s) => {
                        acc[s.state_kind] = (acc[s.state_kind] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([kind, count]) => (
                      <div
                        key={kind}
                        style={{
                          width: `${(count / DEFAULT_WORKFLOW.states.length) * 100}%`,
                          background: KIND_COLORS_PRESET[kind] || '#7EA7D4',
                        }}
                        title={`${kind}: ${count}`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {Object.entries(
                      DEFAULT_WORKFLOW.states.reduce((acc, s) => { acc[s.state_kind] = (acc[s.state_kind]||0)+1; return acc; }, {})
                    ).map(([kind, count]) => (
                      <span key={kind} className="text-[8px] text-slate-500">
                        <span style={{ color: KIND_COLORS_PRESET[kind] }}>●</span> {count} {kind}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Common adjustments checklist */}
                <div>
                  <div className="mb-1.5 text-[8.5px] font-bold uppercase tracking-wider text-slate-600">
                    Common adjustments — check what your client needs
                  </div>
                  <div className="space-y-1">
                    {DEFAULT_WORKFLOW.commonAdjustments.map(adj => (
                      <label
                        key={adj.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/[0.06] bg-slate-800/40 px-2.5 py-1.5 hover:border-white/[0.12] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedAdj[adj.id]}
                          onChange={() => toggleAdj(adj.id)}
                          className="h-3.5 w-3.5 accent-violet-400 rounded"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="text-[9.5px] font-medium text-slate-200">{adj.label}</span>
                          <span className="ml-1.5 text-[8.5px] text-slate-500">{adj.current}</span>
                        </span>
                        <span className="flex-shrink-0 text-[8px] text-violet-400/70 font-medium">{adj.action}</span>
                      </label>
                    ))}
                  </div>
                  {Object.values(checkedAdj).some(Boolean) && (
                    <p className="mt-1.5 text-[9px] text-violet-400/80">
                      ✓ {Object.values(checkedAdj).filter(Boolean).length} adjustment{Object.values(checkedAdj).filter(Boolean).length > 1 ? 's' : ''} flagged — canvas will highlight these states when opened
                    </p>
                  )}
                </div>
              </div>
            )}
          </ModeCard>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-white/[0.07] px-6 py-4">
          {/* Name input — shown for ALL modes including Mode 4 (names the preset copy) */}
          <div className="flex flex-1 items-center gap-2">
            <span className="text-[10px] text-slate-500 flex-shrink-0">
              {mode === 4 ? 'Name your copy' : 'Workflow name'}
            </span>
            <input
              type="text"
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              placeholder={footerPlaceholder}
              className={`flex-1 rounded-lg border bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-600 outline-none transition-colors ${
                mode === 4
                  ? 'border-violet-400/25 focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/15'
                  : 'border-white/[0.1] focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/15'
              }`}
            />
          </div>
          {mode === 4 && (
            <div className="text-[9.5px] text-slate-600 flex-shrink-0">
              Opens as a named copy · original preset preserved
            </div>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-[11px] font-semibold text-slate-400 hover:text-white hover:border-white/[0.2] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!mode || !canCreate || generating}
            className={[
              'rounded-lg px-5 py-2 text-[11px] font-bold text-white shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed min-w-[150px] flex items-center justify-center gap-1.5',
              mode === 4
                ? 'bg-violet-600 shadow-violet-500/25 hover:bg-violet-500'
                : 'bg-sky-600 shadow-sky-500/20 hover:bg-sky-500',
            ].join(' ')}
          >
            {generating ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Generating…
              </>
            ) : footerLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

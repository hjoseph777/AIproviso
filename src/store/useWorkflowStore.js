import { create } from 'zustand';

const makeId = () => Math.random().toString(36).slice(2, 9);

// ── Default seed data ──────────────────────────────────────────
const DEFAULT_WORKFLOW = {
  id: 'wf-default',
  name: 'Contract Lifecycle',
  states: [
    { id: 's01', name: 'Draft',              initial: true  },
    { id: 's02', name: 'Under Review',       initial: false },
    { id: 's03', name: 'Reviewed',           initial: false },
    { id: 's04', name: 'Approve 50k',        initial: false },
    { id: 's05', name: 'Approve High',       initial: false },
    { id: 's06', name: 'Signed Internally',  initial: false },
    { id: 's07', name: 'Sent to Customer',   initial: false },
    { id: 's08', name: 'Signed by Customer', initial: false },
    { id: 's09', name: 'About to Expire',    initial: false },
    { id: 's10', name: 'Expired',            initial: false },
    { id: 's11', name: 'Discarded',          initial: false },
  ],
  transitions: [
    { id: 't01', from: 'Draft',              to: 'Under Review',       conditions: null, permissions: null },
    { id: 't02', from: 'Under Review',       to: 'Reviewed',           conditions: null, permissions: null },
    { id: 't03', from: 'Under Review',       to: 'Draft',              conditions: null, permissions: null },
    { id: 't04', from: 'Reviewed',           to: 'Approve 50k',        conditions: null, permissions: null },
    { id: 't05', from: 'Reviewed',           to: 'Approve High',       conditions: null, permissions: null },
    { id: 't06', from: 'Approve 50k',        to: 'Signed Internally',  conditions: null, permissions: null },
    { id: 't07', from: 'Approve High',       to: 'Signed Internally',  conditions: null, permissions: null },
    { id: 't08', from: 'Signed Internally',  to: 'Sent to Customer',   conditions: null, permissions: null },
    { id: 't09', from: 'Sent to Customer',   to: 'Signed by Customer', conditions: null, permissions: null },
    { id: 't10', from: 'Signed by Customer', to: 'About to Expire',    conditions: null, permissions: null },
    { id: 't11', from: 'About to Expire',    to: 'Expired',            conditions: null, permissions: null },
    { id: 't12', from: 'Draft',              to: 'Discarded',          conditions: null, permissions: null },
    { id: 't13', from: 'Under Review',       to: 'Discarded',          conditions: null, permissions: null },
    { id: 't14', from: 'Reviewed',           to: 'Discarded',          conditions: null, permissions: null },
    { id: 't15', from: 'Discarded',          to: 'Draft',              conditions: null, permissions: null },
  ],
};

const DEFAULT_USERS = [
  { id: 'u01', name: 'Bill Ward',      role: 'CEO',             email: 'bill.ward@acme.com',      isCM: true  },
  { id: 'u02', name: 'Betty Black',    role: 'CFO',             email: 'betty.black@acme.com',    isCM: true  },
  { id: 'u03', name: 'Molly Chambers', role: 'Sales Director',  email: 'molly.chambers@acme.com', isCM: true  },
  { id: 'u04', name: 'Raymond Oakley', role: 'Sales Engineer',  email: 'raymond.oakley@acme.com', isCM: false },
  { id: 'u05', name: 'Tom McKenzie',   role: 'Service Manager', email: 'tom.mckenzie@acme.com',   isCM: false },
];

const DEFAULT_PROPERTIES = [
  { id: 'p01', name: 'Contract Title',  type: 'Text',    required: true  },
  { id: 'p02', name: 'Contract Number', type: 'Integer', required: true  },
  { id: 'p03', name: 'Contract Value',  type: 'Decimal', required: true  },
  { id: 'p04', name: 'Customer',        type: 'Lookup',  required: true  },
  { id: 'p05', name: 'Contract Owner',  type: 'Lookup',  required: true  },
  { id: 'p06', name: 'Effective Date',  type: 'Date',    required: false },
  { id: 'p07', name: 'Expiration Date', type: 'Date',    required: false },
];

const DEFAULT_RULES = [
  { id: 'r01', text: 'Service Agreements over 50,000 euros require Executive Management approval' },
  { id: 'r02', text: 'Only Contract Managers can create and edit contracts' },
  { id: 'r03', text: 'All users can view all contracts at all times' },
  { id: 'r04', text: 'Signed contracts are converted to PDF and locked from editing' },
];

const fresh = () => ({
  workflows:  [JSON.parse(JSON.stringify(DEFAULT_WORKFLOW))],
  activeId:   'wf-default',
  users:      JSON.parse(JSON.stringify(DEFAULT_USERS)),
  properties: JSON.parse(JSON.stringify(DEFAULT_PROPERTIES)),
  rules:      JSON.parse(JSON.stringify(DEFAULT_RULES)),
});

// ── Store ─────────────────────────────────────────────────────
export const useWorkflowStore = create((set, get) => ({
  ...fresh(),

  // ── Selectors ──────────────────────────────────────────────
  getActive: () => {
    const { workflows, activeId } = get();
    return workflows.find(w => w.id === activeId) || null;
  },

  // ── Workflow CRUD ──────────────────────────────────────────
  addWorkflow: () => {
    const wf = { id: makeId(), name: 'New Workflow', states: [], transitions: [] };
    set(s => ({ workflows: [...s.workflows, wf], activeId: wf.id }));
  },
  deleteWorkflow: (id) => set(s => {
    const next = s.workflows.filter(w => w.id !== id);
    if (!next.length) return s;
    const activeId = s.activeId === id ? next[0].id : s.activeId;
    return { workflows: next, activeId };
  }),
  renameWorkflow: (id, name) => set(s => ({
    workflows: s.workflows.map(w => w.id === id ? { ...w, name } : w)
  })),
  setActive: (id) => set({ activeId: id }),

  // ── State CRUD ─────────────────────────────────────────────
  addState: (wfId) => set(s => ({
    workflows: s.workflows.map(w => w.id !== wfId ? w : {
      ...w, states: [...w.states, { id: makeId(), name: '', initial: false }]
    })
  })),

  updateState: (wfId, stateId, patch) => set(s => ({
    workflows: s.workflows.map(w => w.id !== wfId ? w : {
      ...w, states: w.states.map(st => st.id !== stateId ? st : { ...st, ...patch })
    })
  })),

  // Rename + cascade all transitions referencing old name
  renameState: (wfId, stateId, newName) => {
    const wf = get().workflows.find(w => w.id === wfId);
    if (!wf) return;
    const oldName = wf.states.find(s => s.id === stateId)?.name || '';
    set(s => ({
      workflows: s.workflows.map(w => w.id !== wfId ? w : {
        ...w,
        states: w.states.map(st => st.id !== stateId ? st : { ...st, name: newName }),
        transitions: w.transitions.map(t => ({
          ...t,
          from: t.from === oldName ? newName : t.from,
          to:   t.to   === oldName ? newName : t.to,
        })),
      })
    }));
  },

  // Returns { ok, error } — blocked if state is in any transition
  deleteState: (wfId, stateId) => {
    const wf = get().workflows.find(w => w.id === wfId);
    if (!wf) return { ok: false, error: 'Workflow not found' };
    const state = wf.states.find(s => s.id === stateId);
    if (!state) return { ok: false, error: 'State not found' };
    const inUse = wf.transitions.some(t => t.from === state.name || t.to === state.name);
    if (inUse) return { ok: false, error: `"${state.name}" is in use — remove its transitions first.` };
    set(s => ({
      workflows: s.workflows.map(w => w.id !== wfId ? w : {
        ...w, states: w.states.filter(st => st.id !== stateId)
      })
    }));
    return { ok: true };
  },

  // ── Transition CRUD ────────────────────────────────────────
  addTransition: (wfId) => set(s => ({
    workflows: s.workflows.map(w => w.id !== wfId ? w : {
      ...w,
      transitions: [...w.transitions, { id: makeId(), from: '', to: '', conditions: null, permissions: null }]
    })
  })),

  updateTransition: (wfId, transId, patch) => set(s => ({
    workflows: s.workflows.map(w => w.id !== wfId ? w : {
      ...w, transitions: w.transitions.map(t => t.id !== transId ? t : { ...t, ...patch })
    })
  })),

  deleteTransition: (wfId, transId) => set(s => ({
    workflows: s.workflows.map(w => w.id !== wfId ? w : {
      ...w, transitions: w.transitions.filter(t => t.id !== transId)
    })
  })),

  // ── Global: Users ──────────────────────────────────────────
  addUser: () => set(s => ({
    users: [...s.users, { id: makeId(), name: '', role: '', email: '', isCM: false }]
  })),
  updateUser: (id, patch) => set(s => ({
    users: s.users.map(u => u.id !== id ? u : { ...u, ...patch })
  })),
  deleteUser: (id) => set(s => ({ users: s.users.filter(u => u.id !== id) })),

  // ── Global: Properties ─────────────────────────────────────
  addProperty: () => set(s => ({
    properties: [...s.properties, { id: makeId(), name: '', type: 'Text', required: false }]
  })),
  updateProperty: (id, patch) => set(s => ({
    properties: s.properties.map(p => p.id !== id ? p : { ...p, ...patch })
  })),
  deleteProperty: (id) => set(s => ({ properties: s.properties.filter(p => p.id !== id) })),

  // ── Global: Rules ──────────────────────────────────────────
  addRule: () => set(s => ({
    rules: [...s.rules, { id: makeId(), text: '' }]
  })),
  updateRule: (id, text) => set(s => ({
    rules: s.rules.map(r => r.id !== id ? r : { ...r, text })
  })),
  deleteRule: (id) => set(s => ({ rules: s.rules.filter(r => r.id !== id) })),

  // ── Reset everything ───────────────────────────────────────
  resetAll: () => set(fresh()),
}));

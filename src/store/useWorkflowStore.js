import { create } from 'zustand';

const makeId = () => Math.random().toString(36).slice(2, 9);

// ── Starting workflows ──────────────────────────────────────────
// Tab 1: Service Agreement — real domain workflow, diagram visible on load
// Tab 2: Workflow A · 25 States — empty placeholder for 🔥 Low stress test
// Tab 3: Workflow B · 100 States — empty placeholder for 🔥🔥 Max stress test

const SERVICE_AGREEMENT = {
  id: 'wf-sa',
  name: 'Service Agreement',
  states: [
    { id: 'sa01', name: 'Draft',              initial: true  },
    { id: 'sa02', name: 'Under Review',       initial: false },
    { id: 'sa03', name: 'Reviewed',           initial: false },
    { id: 'sa04', name: 'Pending Approval',   initial: false },
    { id: 'sa05', name: 'Approved',           initial: false },
    { id: 'sa06', name: 'Pending Signature',  initial: false },
    { id: 'sa07', name: 'Signed',             initial: false },
    { id: 'sa08', name: 'Active',             initial: false },
    { id: 'sa09', name: 'Expiring Soon',      initial: false },
    { id: 'sa10', name: 'Expired',            initial: false },
    { id: 'sa11', name: 'Terminated',         initial: false },
    { id: 'sa12', name: 'Discarded',          initial: false },
  ],
  transitions: [
    { id: 'st01', from: 'Draft',             to: 'Under Review',      conditions: null, permissions: null },
    { id: 'st02', from: 'Under Review',      to: 'Draft',             conditions: null, permissions: null },
    { id: 'st03', from: 'Under Review',      to: 'Reviewed',          conditions: null, permissions: null },
    { id: 'st04', from: 'Reviewed',          to: 'Pending Approval',  conditions: null, permissions: null },
    { id: 'st05', from: 'Pending Approval',  to: 'Under Review',      conditions: null, permissions: null },
    { id: 'st06', from: 'Pending Approval',  to: 'Approved',          conditions: null, permissions: null },
    { id: 'st07', from: 'Approved',          to: 'Pending Signature', conditions: null, permissions: null },
    { id: 'st08', from: 'Pending Signature', to: 'Draft',             conditions: null, permissions: null },
    { id: 'st09', from: 'Pending Signature', to: 'Signed',            conditions: null, permissions: null },
    { id: 'st10', from: 'Signed',            to: 'Active',            conditions: null, permissions: null },
    { id: 'st11', from: 'Active',            to: 'Expiring Soon',     conditions: null, permissions: null },
    { id: 'st12', from: 'Expiring Soon',     to: 'Active',            conditions: null, permissions: null },
    { id: 'st13', from: 'Expiring Soon',     to: 'Expired',           conditions: null, permissions: null },
    { id: 'st14', from: 'Active',            to: 'Terminated',        conditions: null, permissions: null },
    { id: 'st15', from: 'Draft',             to: 'Discarded',         conditions: null, permissions: null },
    { id: 'st16', from: 'Under Review',      to: 'Discarded',         conditions: null, permissions: null },
  ],
};

const fresh = () => ({
  workflows: [
    JSON.parse(JSON.stringify(SERVICE_AGREEMENT)),
  ],
  activeId:   'wf-sa',
  users:      [],
  properties: [],
  rules:      [],
  hoveredState: null,
  hoveredTransition: null,
  cmdPaletteOpen: false,
});


// ── Store ─────────────────────────────────────────────────────
export const useWorkflowStore = create((set, get) => ({
  ...fresh(),
  setHoveredState: (name) => set({ hoveredState: name }),
  setHoveredTransition: (from, to) => {
    if (!from || !to) {
      set({ hoveredTransition: null });
      return;
    }
    set({ hoveredTransition: { from, to } });
  },
  setCmdPaletteOpen: (open) => set({ cmdPaletteOpen: open }),

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

  // Clears only states + transitions of one workflow — keeps name, keeps other tabs
  clearWorkflow: (wfId) => set(s => ({
    workflows: s.workflows.map(w => w.id !== wfId ? w : { ...w, states: [], transitions: [] })
  })),

  // Stress-test seeder — creates a NEW temporary workflow tab pre-loaded with data.
  // Call from topbar 🔥 / 🔥🔥 buttons. User deletes the tab with ✕ when done.
  // N = number of states, target = approximate number of transitions.
  seedStressTest: (N = 25, target = 50) => {
    const pad = n => String(n).padStart(2, '0');
    const nm  = i => `State ${pad(i + 1)}`;

    const states = Array.from({ length: N }, (_, i) => ({
      id:      `st-${pad(i + 1)}`,
      name:    nm(i),
      initial: i === 0,
    }));

    const seen = new Set();
    const transitions = [];
    const addT = (from, to) => {
      const key = `${from}|${to}`;
      if (seen.has(key) || from === to) return;
      seen.add(key);
      transitions.push({ id: makeId(), from, to, conditions: null, permissions: null });
    };

    for (let i = 0; i < N - 1; i++)          addT(nm(i), nm(i + 1));
    for (let i = 9; i < N; i += 10)          addT(nm(i), nm(0));
    for (let i = 0; i < N - 10; i += 10)     addT(nm(i), nm(i + 10));
    for (let i = 0; i < N - 5; i += 5)       addT(nm(i), nm(i + 5));
    for (let i = 0; transitions.length < target && i < N - 3; i += 2) addT(nm(i), nm(i + 3));
    for (let i = N - 1; transitions.length < target && i > 1; i -= 3) addT(nm(i), nm(i - 2));

    const label = N <= 25 ? '🔥' : '🔥🔥';
    const wf = {
      id:   makeId(),
      name: `${label} Stress ${N}`,
      states,
      transitions,
    };
    set(s => ({ workflows: [...s.workflows, wf], activeId: wf.id }));
  },

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

  // Accepts a fully-parsed object and adds it as a new workflow tab,
  // merging users/properties/rules into the global store arrays.
  importWorkflow: ({ workflow, users = [], properties = [], rules = [] }) => {
    const wf = {
      id:          makeId(),
      name:        workflow.name || 'Imported Workflow',
      states:      (workflow.states      || []).map(s => ({ id: makeId(), ...s })),
      transitions: (workflow.transitions || []).map(t => ({ id: makeId(), ...t })),
    };
    set(s => ({
      workflows:  [...s.workflows, wf],
      activeId:   wf.id,
      users:      [...s.users,      ...users.map(u => ({ id: makeId(), ...u }))],
      properties: [...s.properties, ...properties.map(p => ({ id: makeId(), ...p }))],
      rules:      [...s.rules,      ...rules.map(r => ({ id: makeId(), ...r }))],
    }));
    return wf.id;
  },

  // ── Import from M-Files Vault ──────────────────────────────
  // Takes workflow JSON from M-Files (via pull-from-vault.ps1) and creates a new tab.
  seedImportedWorkflow: (mfData) => {
    const date = mfData.importedAt ? mfData.importedAt.split('T')[0] : new Date().toISOString().split('T')[0];
    const wf = {
      id:          makeId(),
      name:        `📥 ${mfData.name} (imported ${date})`,
      source:      mfData.source || 'mfiles',
      importedAt:  mfData.importedAt,
      states:      (mfData.states || []).map(s => ({ id: makeId(), ...s })),
      transitions: (mfData.transitions || []).map(t => ({ id: makeId(), ...t })),
    };
    set(s => {
      // Extract texts from rules and scripts to save to global rules
      const newRules = [
        ...(mfData.rules || []).map(r => ({ id: makeId(), text: r.text })),
        ...(mfData.scripts || []).map(scr => ({ id: makeId(), text: `VBScript on state ${scr.state}: ${scr.text}` }))
      ];
      return {
        workflows: [...s.workflows, wf],
        activeId:  wf.id,
        rules:     [...s.rules, ...newRules],
      };
    });
    return wf.id;
  },

  // ── Reset everything ───────────────────────────────────────
  resetAll: () => set(fresh()),
}));

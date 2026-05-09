import { create } from 'zustand';

const makeId = () => Math.random().toString(36).slice(2, 9);

// ── Blank initial state ─────────────────────────────────────────
// No demo data. Use ⚡ Stress Test to populate, or build from scratch.
const BLANK_ID = 'wf-1';

const fresh = () => ({
  workflows:  [{ id: BLANK_ID, name: 'New Workflow', states: [], transitions: [] }],
  activeId:   BLANK_ID,
  users:      [],
  properties: [],
  rules:      [],
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

  // Clears only states + transitions of one workflow — keeps name, keeps other tabs
  clearWorkflow: (wfId) => set(s => ({
    workflows: s.workflows.map(w => w.id !== wfId ? w : { ...w, states: [], transitions: [] })
  })),

  // Stress-test loader — parameterized (N states, target transitions)
  // Presets: Low=25/50 (quick demo) | Max=100/150 (full stress)
  // Pattern layers (each addT is a no-op if key already seen):
  //   1. Linear chain 01→02→…→N      →  N-1  transitions
  //   2. Back to [*] every 10th state  → floor(N/10)
  //   3. Skip-forward by 10            → floor((N-10)/10)
  //   4. Skip-forward by 5             → floor((N-5)/5)
  //   5. Branch +3 from even states    → fills to target
  //   6. Reverse −2 from tail           → safety top-up
  loadStressTest: (wfId, N = 100, target = 150) => {
    const pad = n => String(n).padStart(2, '0');
    const nm  = i => `State ${pad(i + 1)}`; // "State 01" … "State N"

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

    // 1. Linear chain: 99 transitions
    for (let i = 0; i < N - 1; i++)          addT(nm(i), nm(i + 1));
    // 2. Back to initial every 10th state: 10 transitions
    for (let i = 9; i < N; i += 10)          addT(nm(i), nm(0));
    // 3. Skip-forward by 10: 9 transitions
    for (let i = 0; i < N - 10; i += 10)     addT(nm(i), nm(i + 10));
    // 4. Skip-forward by 5: 19 transitions
    for (let i = 0; i < N - 5; i += 5)       addT(nm(i), nm(i + 5));
    // 5. Branch +3 from even states (fills to target)
    for (let i = 0; transitions.length < target && i < N - 3; i += 2) addT(nm(i), nm(i + 3));
    // 6. Reverse -2 from tail (safety top-up if still under target)
    for (let i = N - 1; transitions.length < target && i > 1; i -= 3) addT(nm(i), nm(i - 2));

    set(s => ({
      workflows: s.workflows.map(w => w.id !== wfId ? w : { ...w, states, transitions })
    }));
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

  // ── Reset everything ───────────────────────────────────────
  resetAll: () => set(fresh()),
}));

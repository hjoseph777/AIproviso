import { assign, setup } from 'xstate';

export const propertyInspectorMachine = setup({
  types: {
    context: /** @type {{ mode: 'idle' | 'node' | 'edge', nodeId: string | null, edgeId: string | null, activeTab: 'basic' | 'actions' | 'flags', dirty: boolean }} */ ({}),
    events: /** @type {
      | { type: 'SELECT_NODE'; nodeId: string }
      | { type: 'SELECT_EDGE'; edgeId: string }
      | { type: 'CLEAR' }
      | { type: 'SET_TAB'; tab: 'basic' | 'actions' | 'flags' }
      | { type: 'MARK_DIRTY' }
      | { type: 'SAVED' }
    } */ ({}),
  },
  actions: {
    selectNode: assign(({ event }) => ({
      mode: 'node',
      nodeId: event.type === 'SELECT_NODE' ? event.nodeId : null,
      edgeId: null,
      activeTab: 'basic',
      dirty: false,
    })),
    selectEdge: assign(({ event }) => ({
      mode: 'edge',
      edgeId: event.type === 'SELECT_EDGE' ? event.edgeId : null,
      nodeId: null,
      activeTab: 'basic',
      dirty: false,
    })),
    clearSelection: assign(() => ({
      mode: 'idle',
      nodeId: null,
      edgeId: null,
      activeTab: 'basic',
      dirty: false,
    })),
    setTab: assign(({ event }) => ({
      activeTab: event.type === 'SET_TAB' ? event.tab : 'basic',
    })),
    markDirty: assign(() => ({ dirty: true })),
    markSaved: assign(() => ({ dirty: false })),
  },
}).createMachine({
  id: 'propertyInspector',
  initial: 'idle',
  context: {
    mode: 'idle',
    nodeId: null,
    edgeId: null,
    activeTab: 'basic',
    dirty: false,
  },
  states: {
    idle: {
      on: {
        SELECT_NODE: { target: 'nodeSelected', actions: 'selectNode' },
        SELECT_EDGE: { target: 'edgeSelected', actions: 'selectEdge' },
      },
    },
    nodeSelected: {
      on: {
        SELECT_NODE: { target: 'nodeSelected', actions: 'selectNode' },
        SELECT_EDGE: { target: 'edgeSelected', actions: 'selectEdge' },
        CLEAR: { target: 'idle', actions: 'clearSelection' },
        SET_TAB: { actions: 'setTab' },
        MARK_DIRTY: { actions: 'markDirty' },
        SAVED: { actions: 'markSaved' },
      },
    },
    edgeSelected: {
      on: {
        SELECT_NODE: { target: 'nodeSelected', actions: 'selectNode' },
        SELECT_EDGE: { target: 'edgeSelected', actions: 'selectEdge' },
        CLEAR: { target: 'idle', actions: 'clearSelection' },
        SET_TAB: { actions: 'setTab' },
        MARK_DIRTY: { actions: 'markDirty' },
        SAVED: { actions: 'markSaved' },
      },
    },
  },
});

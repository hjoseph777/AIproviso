import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import { create } from 'zustand';
import { fromRFState, toRFState } from '../engine/workflowCanvas';
import {
  saveWorkflow as apiSave,
  loadWorkflow as apiLoad,
  listWorkflows as apiList,
  publishWorkflow as apiPublish,
} from './workflowPersistence';
import { listProjectWorkflows as apiListProjectWorkflows } from './projectPersistence';

// Lazy reference to avoid circular import — resolved at call time
const getActiveProjectId = () => {
  try {
    // eslint-disable-next-line global-require
    return require('./useProjectStore').default.getState().activeProjectId || null;
  } catch {
    return null;
  }
};

const makeId = () => Math.random().toString(36).slice(2, 9);
const DEFAULT_POSITION_STEP_Y = 180;

const formatStateKindLabel = (stateKind = 'standard') => (
  String(stateKind || 'standard')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const buildTransitionEventType = (targetName = 'transition') => (
  `workflow.${String(targetName || 'transition').trim().toLowerCase().replace(/\s+/g, '_')}`
);

const buildTransitionLabel = (targetName = '') => (
  targetName ? `Go to ${targetName}` : 'New Transition'
);

const normalizeNodeLookupKey = (value = '') => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
);

const computeSuggestedNodePositions = (states = [], transitions = []) => {
  const totalStates = states.length;

  // Adaptive density: keep small graphs breathable, compact large enterprise maps.
  const layoutProfile = totalStates <= 12
    ? { perColumn: 4, xStart: 190, yStart: 160, xGap: 330, yGap: 220 }
    : totalStates <= 28
      ? { perColumn: 5, xStart: 175, yStart: 140, xGap: 295, yGap: 185 }
      : { perColumn: 6, xStart: 160, yStart: 120, xGap: 255, yGap: 160 };

  const stateNames = states.map((state) => state.name);
  const adjacency = new Map(stateNames.map((name) => [name, []]));
  const indegree = new Map(stateNames.map((name) => [name, 0]));

  transitions.forEach((transition) => {
    if (!adjacency.has(transition.from) || !adjacency.has(transition.to)) return;
    adjacency.get(transition.from).push(transition.to);
    indegree.set(transition.to, (indegree.get(transition.to) || 0) + 1);
  });

  const roots = states
    .filter((state) => state.initial)
    .map((state) => state.name);

  if (!roots.length) {
    stateNames
      .filter((name) => (indegree.get(name) || 0) === 0)
      .forEach((name) => roots.push(name));
  }

  if (!roots.length && states[0]?.name) roots.push(states[0].name);

  const queue = [...new Set(roots)];
  const ordered = [];
  const seen = new Set();

  while (queue.length) {
    const name = queue.shift();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    ordered.push(name);

    const nextNodes = [...(adjacency.get(name) || [])].sort((left, right) => {
      const leftScore = indegree.get(left) || 0;
      const rightScore = indegree.get(right) || 0;
      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.localeCompare(right);
    });

    nextNodes.forEach((nextName) => {
      if (!seen.has(nextName)) queue.push(nextName);
    });
  }

  stateNames.forEach((name) => {
    if (!seen.has(name)) ordered.push(name);
  });

  return new Map(ordered.map((name, index) => {
    const column = Math.floor(index / layoutProfile.perColumn);
    const row = index % layoutProfile.perColumn;
    const serpentineOffset = column % 2 === 0 ? row : (layoutProfile.perColumn - 1) - row;

    return [
      name,
      {
        x: layoutProfile.xStart + (column * layoutProfile.xGap),
        y: layoutProfile.yStart + (serpentineOffset * layoutProfile.yGap),
      },
    ];
  }));
};

const createDefaultNode = (index = 0, options = {}) => ({
  id: makeId(),
  state_kind: options.stateKind || 'standard',
  name: options.name || `${formatStateKindLabel(options.stateKind || 'standard')} ${index + 1}`,
  description: '',
  assignee_role_id: null,
  fallback_role_id: null,
  sla_policy_id: null,
  escalation_policy_id: null,
  entry_action_ids: [],
  exit_action_ids: [],
  invoked_service_id: null,
  behaviour_flags: defaultBehaviourFlags(),
  tags: [],
  canvas_position: options.position || {
    x: 180 + (Math.floor(index / 4) * 320),
    y: 160 + ((index % 4) * DEFAULT_POSITION_STEP_Y),
  },
});

const normalizeWorkflowGraph = (workflow = {}, { regenerateStateIds = false } = {}) => {
  const rawStates = workflow.states || workflow.nodes || [];
  const rawTransitions = workflow.transitions || workflow.edges || [];
  const stateIdMap = new Map();
  const stateIdsByName = new Map();
  let repaired = false;

  const states = rawStates.map((state, index) => {
    const originalId = state?.id ? String(state.id) : '';
    const nextId = regenerateStateIds ? makeId() : (originalId || makeId());
    const name = state?.name || `State ${index + 1}`;

    if (!originalId || nextId !== originalId) repaired = true;
    if (originalId) stateIdMap.set(originalId, nextId);
    if (!stateIdsByName.has(normalizeNodeLookupKey(name))) {
      stateIdsByName.set(normalizeNodeLookupKey(name), nextId);
    }

    return {
      ...state,
      id: nextId,
      name,
      xstate: state?.xstate || {},
    };
  });

  const stateNamesById = new Map(states.map((state) => [String(state.id), state.name]));

  const resolveNodeId = (candidateId, candidateName) => {
    const rawId = String(candidateId || '').trim();
    if (rawId) return stateIdMap.get(rawId) || (stateNamesById.has(rawId) ? rawId : '');

    const rawName = normalizeNodeLookupKey(candidateName);
    if (!rawName) return '';
    return stateIdsByName.get(rawName) || '';
  };

  const transitions = rawTransitions.map((transition) => {
    const fromNodeId = resolveNodeId(transition.from_node_id || transition.source, transition.from);
    const toNodeId = resolveNodeId(transition.to_node_id || transition.target, transition.to);
    const fromName = stateNamesById.get(fromNodeId) || transition.from || '';
    const toName = stateNamesById.get(toNodeId) || transition.to || '';

    if (
      fromNodeId !== String(transition.from_node_id || transition.source || '')
      || toNodeId !== String(transition.to_node_id || transition.target || '')
      || fromName !== String(transition.from || '')
      || toName !== String(transition.to || '')
      || !transition.id
    ) {
      repaired = true;
    }

    return {
      ...transition,
      id: transition.id || makeId(),
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      from: fromName,
      to: toName,
      xstate: transition.xstate || {},
    };
  });

  return {
    workflow: {
      ...workflow,
      id: workflow.id || makeId(),
      name: workflow.name || 'Imported Workflow',
      states,
      transitions,
    },
    repaired,
  };
};

const mapLegacyPropertyType = (type = '') => {
  switch (String(type || '').toLowerCase()) {
    case 'integer': return 'integer';
    case 'decimal': return 'decimal';
    case 'boolean': return 'boolean';
    case 'date': return 'date';
    case 'json': return 'json';
    case 'lookup': return 'uuid';
    default: return 'string';
  }
};

const defaultBehaviourFlags = () => ({
  comments_enabled: true,
  email_approval_enabled: false,
  vendor_reply_enabled: false,
  lock_fields_on_entry: false,
  on_missing_po: 'route_exception',
  token_expiry_hours: 48,
  gl_suggestion_enabled: false,
  anomaly_check_enabled: false,
  duplicate_check_enabled: false,
});

const createActiveDefinition = (workflow, properties = [], rules = []) => {
  if (!workflow) return null;

  const { workflow: normalizedWorkflow } = normalizeWorkflowGraph(workflow);
  const workflowRecord = normalizedWorkflow;

  const suggestedPositions = computeSuggestedNodePositions(workflowRecord.states || [], workflowRecord.transitions || []);

  const nodeIdsByName = new Map();
  const nodeIdsByNormalizedName = new Map();
  const nodeIdsById = new Map();
  const nodes = (workflowRecord.states || []).map((state, index) => {
    nodeIdsByName.set(state.name, state.id);
    nodeIdsByNormalizedName.set(normalizeNodeLookupKey(state.name), state.id);
    nodeIdsById.set(String(state.id), state.id);
    return {
      id: state.id,
      state_kind: state.state_kind || (state.initial ? 'initial' : 'standard'),
      name: state.name,
      description: state.description || '',
      assignee_role_id: state.assignee_role_id || null,
      fallback_role_id: state.fallback_role_id || null,
      sla_policy_id: state.sla_policy_id || null,
      escalation_policy_id: state.escalation_policy_id || null,
      entry_action_ids: state.entry_action_ids || [],
      exit_action_ids: state.exit_action_ids || [],
      invoked_service_id: state.invoked_service_id || null,
      behaviour_flags: state.behaviour_flags || defaultBehaviourFlags(),
      tags: state.tags || [],
      canvas_position: state.canvas_position || suggestedPositions.get(state.name) || { x: 180, y: 160 + (index * DEFAULT_POSITION_STEP_Y) },
    };
  });

  const resolveTransitionNodeId = (rawRef) => {
    const raw = String(rawRef || '').trim();
    if (!raw) return '';
    const normalized = normalizeNodeLookupKey(raw);
    return (
      nodeIdsById.get(raw)
      || nodeIdsByName.get(raw)
      || nodeIdsByNormalizedName.get(normalized)
      || ''
    );
  };

  const edges = (workflowRecord.transitions || []).map((transition) => ({
    id: transition.id,
    from_node_id: resolveTransitionNodeId(transition.from_node_id || transition.from),
    to_node_id: resolveTransitionNodeId(transition.to_node_id || transition.to),
    event_type: transition.xstate?.eventType || `workflow.${String(transition.to || 'transition').trim().toLowerCase().replace(/\s+/g, '_')}`,
    label: transition.label || `${transition.from} -> ${transition.to}`,
    guard_id: transition.guard_id || null,
    pre_action_ids: transition.pre_action_ids || [],
    post_notification_ids: transition.post_notification_ids || [],
    integration_binding_ids: transition.integration_binding_ids || [],
    delay_policy_id: transition.delay_policy_id || null,
    reentry: transition.xstate?.reenter ?? true,
    internal: transition.internal ?? false,
  }));

  return {
    id: workflowRecord.id,
    tenant_id: workflowRecord.tenant_id || 'tenant-local',
    version: workflowRecord.version || 1,
    status: workflowRecord.status || 'draft',
    source: workflowRecord.source || 'manual',
    complexity: workflowRecord.complexity || 'simple',
    name: workflowRecord.name || 'Untitled Workflow',
    description: workflowRecord.description || '',
    nodes,
    edges,
    roles: workflowRecord.roles || [],
    approval_matrix: workflowRecord.approval_matrix || [],
    sla_policies: workflowRecord.sla_policies || [],
    escalation_policies: workflowRecord.escalation_policies || [],
    delay_policies: workflowRecord.delay_policies || [],
    integration_bindings: workflowRecord.integration_bindings || [],
    document_requirements: workflowRecord.document_requirements || [],
    workflow_properties: properties.map((property) => ({
      id: property.id,
      key: property.key || property.name || `property.${property.id}`,
      label: property.label || property.name || 'Unnamed Property',
      type: mapLegacyPropertyType(property.type),
      required: !!property.required,
      default_value: property.default_value ?? null,
      description: property.description || '',
    })),
    guard_registry: rules.map((rule) => ({
      id: rule.id,
      name: rule.name || rule.text || `Guard ${rule.id}`,
      description: rule.text || '',
      expression_dsl: rule.expression_dsl || '',
      parameters: rule.parameters || [],
    })),
    action_registry: workflowRecord.action_registry || [],
    service_registry: workflowRecord.service_registry || [],
    notification_registry: workflowRecord.notification_registry || [],
    task_policies: workflowRecord.task_policies || [],
    created_by: workflowRecord.created_by,
    created_at: workflowRecord.created_at,
    updated_at: workflowRecord.updated_at,
  };
};

const mapNodeChangesToCanvasData = (changes = {}) => {
  const next = {};
  if ('name' in changes) next.name = changes.name;
  if ('state_kind' in changes) next.stateKind = changes.state_kind;
  if ('assignee_role_id' in changes) next.assigneeRoleId = changes.assignee_role_id;
  if ('fallback_role_id' in changes) next.fallbackRoleId = changes.fallback_role_id;
  if ('sla_policy_id' in changes) next.slaPolicyId = changes.sla_policy_id;
  if ('escalation_policy_id' in changes) next.escalationPolicyId = changes.escalation_policy_id;
  if ('tags' in changes) next.tags = changes.tags;
  return next;
};

const mapEdgeChangesToCanvasData = (changes = {}) => {
  const next = {};
  if ('event_type' in changes) next.eventType = changes.event_type;
  if ('label' in changes) next.label = changes.label;
  if ('guard_id' in changes) next.guardId = changes.guard_id;
  if ('delay_policy_id' in changes) next.delayPolicyId = changes.delay_policy_id;
  if ('bend_point' in changes) next.bendPoint = changes.bend_point;
  return next;
};

const definitionToLegacyWorkflow = (definition, previousWorkflow = {}) => {
  if (!definition) return previousWorkflow;

  const previousStatesById = new Map((previousWorkflow.states || []).map((state) => [state.id, state]));
  const previousTransitionsById = new Map((previousWorkflow.transitions || []).map((transition) => [transition.id, transition]));
  const nodeById = new Map((definition.nodes || []).map((node) => [node.id, node]));

  return {
    ...previousWorkflow,
    id: definition.id,
    tenant_id: definition.tenant_id,
    version: definition.version,
    status: definition.status,
    source: definition.source,
    complexity: definition.complexity,
    name: definition.name,
    description: definition.description || previousWorkflow.description || '',
    states: (definition.nodes || []).map((node) => {
      const previousState = previousStatesById.get(node.id) || {};
      return {
        ...previousState,
        id: node.id,
        name: node.name,
        initial: node.state_kind === 'initial',
        description: node.description || '',
        assignee_role_id: node.assignee_role_id || null,
        fallback_role_id: node.fallback_role_id || null,
        sla_policy_id: node.sla_policy_id || null,
        escalation_policy_id: node.escalation_policy_id || null,
        entry_action_ids: node.entry_action_ids || [],
        exit_action_ids: node.exit_action_ids || [],
        invoked_service_id: node.invoked_service_id || null,
        behaviour_flags: node.behaviour_flags || defaultBehaviourFlags(),
        tags: node.tags || [],
        canvas_position: node.canvas_position || previousState.canvas_position,
        xstate: previousState.xstate || {},
      };
    }),
    transitions: (definition.edges || []).map((edge) => {
      const previousTransition = previousTransitionsById.get(edge.id) || {};
      return {
        ...previousTransition,
        id: edge.id,
        from_node_id: edge.from_node_id || null,
        to_node_id: edge.to_node_id || null,
        from: nodeById.get(edge.from_node_id)?.name || previousTransition.from || '',
        to: nodeById.get(edge.to_node_id)?.name || previousTransition.to || '',
        label: edge.label || previousTransition.label || '',
        guard_id: edge.guard_id || null,
        pre_action_ids: edge.pre_action_ids || [],
        post_notification_ids: edge.post_notification_ids || [],
        integration_binding_ids: edge.integration_binding_ids || [],
        delay_policy_id: edge.delay_policy_id || null,
        internal: !!edge.internal,
        conditions: previousTransition.conditions ?? null,
        permissions: previousTransition.permissions ?? null,
        xstate: {
          ...(previousTransition.xstate || {}),
          eventType: edge.event_type,
          reenter: edge.reentry ?? true,
        },
      };
    }),
  };
};

const syncWorkflowsFromDefinition = (workflows, nextDefinition) => {
  if (!nextDefinition) return workflows;
  return workflows.map((workflow) => (
    workflow.id === nextDefinition.id ? definitionToLegacyWorkflow(nextDefinition, workflow) : workflow
  ));
};

const syncEditorState = (state, patch = {}) => {
  const activeDefinition = patch.activeDefinition ?? state.activeDefinition;
  const rfNodes = patch.rfNodes ?? state.rfNodes;
  const rfEdges = patch.rfEdges ?? state.rfEdges;
  const selectedNodeId = rfNodes.some((node) => node.id === (patch.selectedNodeId ?? state.selectedNodeId))
    ? (patch.selectedNodeId ?? state.selectedNodeId)
    : null;
  const selectedEdgeId = rfEdges.some((edge) => edge.id === (patch.selectedEdgeId ?? state.selectedEdgeId))
    ? (patch.selectedEdgeId ?? state.selectedEdgeId)
    : null;

  return {
    ...patch,
    workflows: patch.workflows ?? syncWorkflowsFromDefinition(state.workflows, activeDefinition),
    activeDefinition,
    activeVersion: activeDefinition?.version || 0,
    rfNodes,
    rfEdges,
    selectedNodeId,
    selectedEdgeId,
  };
};

const deriveEditorSlice = (state) => {
  const activeWorkflow = state.workflows.find((workflow) => workflow.id === state.activeId) || null;
  const activeDefinition = createActiveDefinition(activeWorkflow, state.properties, state.rules);
  const validationIssues = validateWorkflowDefinition(activeDefinition);
  const { canvasNodes: rfNodes, canvasEdges: rfEdges } = toRFState(activeDefinition, validationIssues);
  const selectedNodeId = rfNodes.some((node) => node.id === state.selectedNodeId) ? state.selectedNodeId : null;
  const selectedEdgeId = rfEdges.some((edge) => edge.id === state.selectedEdgeId) ? state.selectedEdgeId : null;

  return {
    activeDefinition,
    activeVersion: activeDefinition?.version || 0,
    rfNodes,
    rfEdges,
    validationIssues,
    selectedNodeId,
    selectedEdgeId,
  };
};

const withEditorProjection = (state, patch = {}) => ({
  ...patch,
  ...deriveEditorSlice({ ...state, ...patch }),
});

// ── Starting workflow example ───────────────────────────────────
// Default seed shown on first load.

const WORKFLOW_EXAMPLE = {
  id: 'wf-ap-invoice',
  name: 'Invoice Approval Flow',
  states: [
    { id: 'ap01', name: 'Received',          state_kind: 'initial',   initial: true,  description: 'entry: validate · audit' },
    { id: 'ap02', name: 'Extracted',         state_kind: 'technical', initial: false, description: 'invoke: Granite-Docling' },
    { id: 'ap03', name: 'Matched',           state_kind: 'technical', initial: false, description: 'invoke: matchPO · 2-way' },
    { id: 'ap04', name: 'Pending Approval',  state_kind: 'approval',  initial: false, description: 'entry: email · token' },
    { id: 'ap05', name: 'Manager',           state_kind: 'approval',  initial: false, assignee_role_id: 'ap_manager' },
    { id: 'ap06', name: 'CFO Approval',      state_kind: 'approval',  initial: false, assignee_role_id: 'cfo_role' },
    { id: 'ap07', name: 'Approved',          state_kind: 'terminal',  initial: false, description: 'entry: postERP · seal' },
    { id: 'ap08', name: 'Exception',         state_kind: 'exception', initial: false, description: 'entry: alert · hold' },
    { id: 'ap09', name: 'Escalated',         state_kind: 'exception', initial: false, description: 'after: 4h · auto' },
  ],
  transitions: [
    { id: 'at01', from: 'Received',         to: 'Extracted',         label: 'OCR extract',  conditions: null, permissions: null },
    { id: 'at02', from: 'Extracted',        to: 'Matched',           label: 'conf ≥ 0.70',  conditions: null, permissions: null },
    { id: 'at03', from: 'Matched',          to: 'Pending Approval',  label: 'PO match',     conditions: null, permissions: null },
    { id: 'at04', from: 'Pending Approval', to: 'Manager',           label: '≤ $25k',       conditions: null, permissions: null },
    { id: 'at05', from: 'Pending Approval', to: 'CFO Approval',      label: '> $25k',       conditions: null, permissions: null },
    { id: 'at06', from: 'Manager',          to: 'Approved',          label: 'APPROVE',      conditions: null, permissions: null },
    { id: 'at07', from: 'CFO Approval',     to: 'Approved',          label: 'APPROVE',      conditions: null, permissions: null },
    { id: 'at08', from: 'Extracted',        to: 'Exception',         label: 'conf < 0.70',  conditions: null, permissions: null },
    { id: 'at09', from: 'Matched',          to: 'Exception',         label: 'no PO',        conditions: null, permissions: null },
    { id: 'at10', from: 'Pending Approval', to: 'Escalated',         label: 'after 4h',     conditions: null, permissions: null },
  ],
};

const DEFAULT_RUNTIME_RULES = [
  { id: 'rule.invoice.confidence.high', text: 'Extraction confidence >= 0.70 can continue to PO matching.' },
  { id: 'rule.invoice.confidence.low', text: 'Extraction confidence < 0.70 must route to Exception.' },
  { id: 'rule.invoice.po.required', text: 'Missing PO should route the invoice to Exception.' },
  { id: 'rule.invoice.approval.threshold', text: 'Invoices <= $25k route to Manager; above $25k route to CFO Approval.' },
  { id: 'rule.invoice.escalation', text: 'Pending Approval exceeding 4h escalates automatically.' },
];

const MAX_HISTORY = 50;

const makeValidationIssue = ({ type, severity = 'warning', message, targetId = null, linkedId = null }) => ({
  id: `${type}:${targetId || linkedId || Math.random().toString(36).slice(2, 8)}`,
  type,
  severity,
  message,
  targetId,
  linkedId,
});

const isLikelyRuleRef = (value = '') => /^[a-z0-9_.-]+$/i.test(String(value || '').trim());

const isValidGuardExpression = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return true;
  if (isLikelyRuleRef(text)) return true;
  return /^[\w\s().><=!&|"'\-+/*%:,]+$/.test(text) && !/&&\s*\|\||\|\|\s*&&/.test(text);
};

const buildAdjacency = (nodes = [], edges = []) => {
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  const incoming = new Map(nodes.map((node) => [node.id, []]));
  const undirected = new Map(nodes.map((node) => [node.id, []]));

  edges.forEach((edge) => {
    if (!outgoing.has(edge.from_node_id) || !incoming.has(edge.to_node_id)) return;
    outgoing.get(edge.from_node_id).push(edge.to_node_id);
    incoming.get(edge.to_node_id).push(edge.from_node_id);
    undirected.get(edge.from_node_id).push(edge.to_node_id);
    undirected.get(edge.to_node_id).push(edge.from_node_id);
  });

  return { outgoing, incoming, undirected };
};

const walkReachable = (seedIds = [], adjacency = new Map()) => {
  const seen = new Set();
  const queue = [...seedIds];
  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    (adjacency.get(nodeId) || []).forEach((nextId) => {
      if (!seen.has(nextId)) queue.push(nextId);
    });
  }
  return seen;
};

const hasDirectedPath = (startId, predicate, outgoing, { allowSelf = false } = {}) => {
  const seen = new Set();
  const stack = [{ id: startId, depth: 0 }];
  while (stack.length) {
    const { id: nodeId, depth } = stack.pop();
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    if (predicate(nodeId) && (allowSelf || depth > 0)) return true;
    (outgoing.get(nodeId) || []).forEach((nextId) => {
      if (!seen.has(nextId)) stack.push({ id: nextId, depth: depth + 1 });
    });
  }
  return false;
};

const isNodeInCycle = (startId, outgoing) => {
  const stack = [...(outgoing.get(startId) || [])];
  const seen = new Set([startId]);

  while (stack.length) {
    const nodeId = stack.pop();
    if (!nodeId) continue;
    if (nodeId === startId) return true;
    if (seen.has(nodeId)) continue;
    seen.add(nodeId);
    (outgoing.get(nodeId) || []).forEach((nextId) => stack.push(nextId));
  }

  return false;
};

const validateWorkflowDefinition = (definition) => {
  if (!definition) return [];

  const nodes = definition.nodes || [];
  const edges = definition.edges || [];
  const issues = [];
  const terminals = nodes.filter((node) => node.state_kind === 'terminal').map((node) => node.id);
  const initials = nodes.filter((node) => node.state_kind === 'initial');

  if (nodes.length > 0 && initials.length === 0) {
    issues.push(makeValidationIssue({
      type: 'missing-initial-state',
      severity: 'error',
      message: 'Workflow has no initial state.',
    }));
  }

  if (initials.length > 1) {
    initials.forEach((node) => {
      issues.push(makeValidationIssue({
        type: 'duplicate-initial-state',
        severity: 'error',
        message: `State "${node.name}" is marked initial, but only one initial state is allowed.`,
        targetId: node.id,
      }));
    });
  }

  const { outgoing, incoming, undirected } = buildAdjacency(nodes, edges);
  const connectionSeed = initials[0]?.id || nodes[0]?.id;
  const connected = connectionSeed ? walkReachable([connectionSeed], undirected) : new Set();
  nodes.forEach((node) => {
    if (connectionSeed && !connected.has(node.id)) {
      issues.push(makeValidationIssue({
        type: 'disconnected-subgraph',
        severity: 'warning',
        message: `State "${node.name}" is disconnected from the main workflow graph.`,
        targetId: node.id,
      }));
    }
  });

  const toTerminal = terminals.length ? walkReachable(terminals, incoming) : new Set();
  if (!terminals.length && nodes.length > 0) {
    issues.push(makeValidationIssue({
      type: 'missing-terminal-state',
      severity: 'warning',
      message: 'Workflow has no terminal state.',
    }));
  }

  nodes.filter((node) => node.state_kind !== 'terminal').forEach((node) => {
    if (!toTerminal.has(node.id)) {
      issues.push(makeValidationIssue({
        type: 'orphaned-state',
        severity: 'warning',
        message: `State "${node.name}" has no directed path to a terminal state.`,
        targetId: node.id,
      }));
    }
  });

  nodes.forEach((node) => {
    const inCycle = isNodeInCycle(node.id, outgoing);
    if (inCycle && !toTerminal.has(node.id)) {
      issues.push(makeValidationIssue({
        type: 'cycle-without-exit',
        severity: 'warning',
        message: `State "${node.name}" participates in a cycle without a terminal escape path.`,
        targetId: node.id,
      }));
    }
  });

  edges.forEach((edge) => {
    const guardRef = edge.guard_id || '';
    if (guardRef && !isValidGuardExpression(guardRef)) {
      issues.push(makeValidationIssue({
        type: 'guard-parse-error',
        severity: 'error',
        message: `Transition "${edge.label || edge.id}" has an invalid guard expression.`,
        targetId: edge.id,
      }));
    }
  });

  return issues;
};

const cloneHistorySnapshot = (snapshot) => {
  if (typeof structuredClone === 'function') return structuredClone(snapshot);
  return JSON.parse(JSON.stringify(snapshot));
};

const fresh = () => {
  // Start empty — no pre-seeded workflow.
  // WorkflowDesignerShell loads from backend on mount; if nothing exists it
  // shows the Workflow Studio mode selector so the user chooses how to start.
  const seed = {
  workflows: [],
  activeId:   null,
  users:      [],
  properties: [],
  rules:      JSON.parse(JSON.stringify(DEFAULT_RUNTIME_RULES)),
  activeDefinition: null,
  activeVersion: 0,
  rfNodes: [],
  rfEdges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  recentlyAddedNodeId: null,
  validationIssues: [],
  lastPublishError: null,
  lastPublishedAt: null,
  isDirty: false,
  lastSavedAt: null,
  hoveredState: null,
  hoveredTransition: null,
  cmdPaletteOpen: false,
  historyStack: [],
  historyPointer: -1,
  };
  return { ...seed, ...deriveEditorSlice(seed) };
};


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

  // ── History / Undo / Redo ──────────────────────────────────
  pushHistory: () => {
    const s = get();
    const snapshot = cloneHistorySnapshot({
      activeDefinition: s.activeDefinition,
      workflows: s.workflows,
      rfNodes: s.rfNodes,
      rfEdges: s.rfEdges,
    });
    const historyStack = [...s.historyStack.slice(0, s.historyPointer + 1), snapshot].slice(-MAX_HISTORY);
    set({ historyStack, historyPointer: historyStack.length - 1 });
  },
  undo: () => {
    const s = get();
    const pointer = s.historyPointer - 1;
    if (pointer < 0 || !s.historyStack[pointer]) return;
    const snapshot = s.historyStack[pointer];
    set({
      activeDefinition: snapshot.activeDefinition,
      workflows: snapshot.workflows,
      rfNodes: snapshot.rfNodes,
      rfEdges: snapshot.rfEdges,
      historyPointer: pointer,
      historyStack: s.historyStack,
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
    });
  },
  redo: () => {
    const s = get();
    const pointer = s.historyPointer + 1;
    if (pointer >= s.historyStack.length || !s.historyStack[pointer]) return;
    const snapshot = s.historyStack[pointer];
    set({
      activeDefinition: snapshot.activeDefinition,
      workflows: snapshot.workflows,
      rfNodes: snapshot.rfNodes,
      rfEdges: snapshot.rfEdges,
      historyPointer: pointer,
      historyStack: s.historyStack,
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
    });
  },
  canUndo: () => get().historyPointer > 0,
  canRedo: () => get().historyPointer < get().historyStack.length - 1,

  // ── Selectors ──────────────────────────────────────────────
  getActive: () => {
    const { workflows, activeId } = get();
    return workflows.find(w => w.id === activeId) || null;
  },
  getActiveDefinition: () => get().activeDefinition,
  applyCanvasNodeChanges: (changes = []) => set((state) => {
    if (!changes.length) return state;

    const rfNodes = applyNodeChanges(changes, state.rfNodes);
    const hasRemoveChange = changes.some((c) => c.type === 'remove');
    const hasAddChange    = changes.some((c) => c.type === 'add');
    const hasPositionChange = changes.some((c) => c.type === 'position');

    // Guard against transient bad change batches
    if (!hasRemoveChange && state.rfNodes.length > 0 && rfNodes.length === 0) {
      return state;
    }

    // For dimension/select-only changes: just preserve measured dimensions.
    // Avoid the fromRFState→toRFState round-trip which recreates rfEdges every
    // time React Flow measures a node — this caused a render loop with 4900+ calls.
    const isStructural = hasRemoveChange || hasAddChange || hasPositionChange;
    if (!isStructural) {
      const measuredById = new Map(rfNodes.map((n) => [n.id, n.measured]));
      const rfNodesWithMeasured = state.rfNodes.map((n) => {
        const measured = measuredById.get(n.id);
        return measured ? { ...n, measured } : n;
      });
      return syncEditorState(state, { rfNodes: rfNodesWithMeasured });
    }

    if (!state.activeDefinition) {
      return syncEditorState(state, { rfNodes });
    }

    const measuredById = new Map(rfNodes.map((n) => [n.id, n.measured]));
    const activeDefinition = fromRFState(state.activeDefinition, rfNodes, state.rfEdges);
    const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);

    const canvasNodesWithMeasured = canvasNodes.map((n) => {
      const measured = measuredById.get(n.id);
      return measured ? { ...n, measured } : n;
    });

    return syncEditorState(state, {
      activeDefinition,
      rfNodes: canvasNodesWithMeasured,
      rfEdges: canvasEdges,
    });
  }),
  applyCanvasEdgeChanges: (changes = []) => set((state) => {
    if (!changes.length) return state;

    const rfEdges = applyEdgeChanges(changes, state.rfEdges);
    return syncEditorState(state, { rfEdges });
  }),
  applyCollaborativeSnapshot: (snapshot = {}) => set((state) => {
    if (!snapshot || snapshot.workflowId !== state.activeId || !state.activeDefinition) return state;
    if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return state;

    const activeDefinition = fromRFState(state.activeDefinition, snapshot.nodes, snapshot.edges);
    const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);

    return syncEditorState(state, {
      activeDefinition,
      rfNodes: canvasNodes,
      rfEdges: canvasEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
    });
  }),
  setSelectedNodeId: (nodeId) => set(s => ({ ...withEditorProjection(s, { selectedNodeId: nodeId, selectedEdgeId: null }) })),
  setSelectedEdgeId: (edgeId) => set(s => ({ ...withEditorProjection(s, { selectedEdgeId: edgeId, selectedNodeId: null }) })),
  selectNode: (nodeId) => set(s => ({ ...withEditorProjection(s, { selectedNodeId: nodeId, selectedEdgeId: null }) })),
  selectEdge: (edgeId) => set(s => ({ ...withEditorProjection(s, { selectedEdgeId: edgeId, selectedNodeId: null }) })),
  clearSelection: () => set(s => ({ ...withEditorProjection(s, { selectedNodeId: null, selectedEdgeId: null }) })),
  markSaved: () => set(s => ({ ...withEditorProjection(s, { isDirty: false, lastSavedAt: new Date().toISOString() }) })),

  // ── Backend persistence ───────────────────────────────────────────────────
  // saveActiveWorkflow: debounced auto-save — always injects activeProjectId
  saveActiveWorkflow: async () => {
    const state = useWorkflowStore.getState();
    const { activeId, activeDefinition, workflows } = state;
    if (!activeId || !activeDefinition) return;
    const wf = workflows.find(w => w.id === activeId);
    if (!wf) return;
    const projectId = getActiveProjectId();
    const result = await apiSave(activeId, {
      name:       wf.name || activeDefinition.name || 'Untitled',
      definition: activeDefinition,
      version:    activeDefinition.version || 1,
      tenantId:   activeDefinition.tenant_id,
      projectId,
    });
    if (result?.ok) {
      useWorkflowStore.getState().markSaved();
    }
  },

  // loadWorkflowById: load a saved workflow from the backend and activate it
  loadWorkflowById: async (id) => {
    const result = await apiLoad(id);
    if (!result?.ok || !result.workflow) return null;
    const { definition } = result.workflow;
    if (!definition) return null;
    useWorkflowStore.getState().importWorkflow({ workflow: definition });
    return id;
  },

  // listRemoteWorkflows: returns [{id, name, status, version, updated_at}]
  listRemoteWorkflows: async (tenantId) => {
    const result = await apiList(tenantId);
    return result?.workflows ?? [];
  },

  // publishActiveWorkflowToBackend: publishes draft → published on the backend
  publishActiveWorkflowToBackend: async () => {
    const { activeId, saveActiveWorkflow } = useWorkflowStore.getState();
    if (!activeId) return null;
    // Save first to ensure latest definition is persisted
    await saveActiveWorkflow();
    const result = await apiPublish(activeId);
    return result?.workflow ?? null;
  },
  publishActiveWorkflow: ({ allowInvalid = false } = {}) => set((state) => {
    if (!state.activeDefinition || !state.activeId) return state;

    const blockingIssues = (state.validationIssues || []).filter((issue) => issue.severity === 'error');
    if (blockingIssues.length > 0 && !allowInvalid) {
      return {
        ...state,
        lastPublishError: `${blockingIssues.length} blocking validation issue(s) found.`,
      };
    }

    const nextVersion = Number(state.activeDefinition.version || 0) + 1;
    const activeDefinition = {
      ...state.activeDefinition,
      status: 'published',
      version: nextVersion,
      updated_at: new Date().toISOString(),
    };

    return syncEditorState(state, {
      activeDefinition,
      isDirty: true,
      lastPublishError: null,
      lastPublishedAt: new Date().toISOString(),
    });
  }),
  autoLayoutCanvas: () => set((state) => {
    if (!state.activeDefinition) return state;

    const stateById = new Map(state.activeDefinition.nodes.map((node) => [node.id, node]));
    const positionsByName = computeSuggestedNodePositions(
      state.activeDefinition.nodes.map((node) => ({ name: node.name, initial: node.state_kind === 'initial' })),
      state.activeDefinition.edges.map((edge) => ({
        from: stateById.get(edge.from_node_id)?.name,
        to: stateById.get(edge.to_node_id)?.name,
      }))
    );

    const activeDefinition = {
      ...state.activeDefinition,
      nodes: state.activeDefinition.nodes.map((node) => ({
        ...node,
        canvas_position: positionsByName.get(node.name) || node.canvas_position,
      })),
    };
    const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);

    return syncEditorState(state, {
      activeDefinition,
      rfNodes: canvasNodes,
      rfEdges: canvasEdges,
    });
  }),
  addCanvasNode: (options = {}) => {
    get().pushHistory();
    set((state) => {
      if (!state.activeDefinition) return state;
      const siblingCount = state.activeDefinition.nodes.filter((node) => node.state_kind === (options.stateKind || 'standard')).length;
      const newNode = createDefaultNode(siblingCount, options);
      const activeDefinition = {
        ...state.activeDefinition,
        nodes: [...state.activeDefinition.nodes, newNode],
      };
      const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);
      return syncEditorState(state, {
        activeDefinition,
        rfNodes: canvasNodes,
        rfEdges: canvasEdges,
        selectedNodeId: newNode.id,
        selectedEdgeId: null,
        recentlyAddedNodeId: newNode.id,
        isDirty: true,
      });
    });
    setTimeout(() => {
      set((state) => (state.recentlyAddedNodeId ? { ...state, recentlyAddedNodeId: null } : state));
    }, 1600);
  },
  duplicateCanvasNode: (nodeId) => {
    get().pushHistory();
    set((state) => {
      if (!state.activeDefinition) return state;
      const original = state.activeDefinition.nodes.find((n) => n.id === nodeId);
      if (!original) return state;
      const newNode = {
        ...JSON.parse(JSON.stringify(original)),
        id: makeId(),
        name: `${original.name} (copy)`,
        state_kind: original.state_kind === 'initial' ? 'standard' : original.state_kind,
        canvas_position: {
          x: (original.canvas_position?.x || 0) + 70,
          y: (original.canvas_position?.y || 0) + 70,
        },
      };
      const activeDefinition = {
        ...state.activeDefinition,
        nodes: [...state.activeDefinition.nodes, newNode],
      };
      const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);
      return syncEditorState(state, {
        activeDefinition,
        rfNodes: canvasNodes,
        rfEdges: canvasEdges,
        selectedNodeId: newNode.id,
        selectedEdgeId: null,
        isDirty: true,
      });
    });
  },
  updateNodePosition: (nodeId, position) => set((state) => {
    if (!state.activeDefinition) return state;

    const rfNodes = state.rfNodes.map((node) => (
      node.id === nodeId
        ? {
            ...node,
            position,
            data: {
              ...node.data,
              definitionNode: {
                ...node.data.definitionNode,
                canvas_position: position,
              },
            },
          }
        : node
    ));

    const activeDefinition = {
      ...state.activeDefinition,
      nodes: state.activeDefinition.nodes.map((node) => (
        node.id === nodeId ? { ...node, canvas_position: position } : node
      )),
    };

    return syncEditorState(state, { activeDefinition, rfNodes });
  }),
  addEdge: (sourceNodeId, targetNodeId) => {
    get().pushHistory();
    set((state) => {
      if (!state.activeDefinition || !sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return state;
      const existingEdge = state.activeDefinition.edges.find((edge) => (
        edge.from_node_id === sourceNodeId && edge.to_node_id === targetNodeId
      ));
      if (existingEdge) {
        return syncEditorState(state, { selectedEdgeId: existingEdge.id, selectedNodeId: null });
      }
      const targetNode = state.activeDefinition.nodes.find((node) => node.id === targetNodeId);
      const newEdge = {
        id: makeId(),
        from_node_id: sourceNodeId,
        to_node_id: targetNodeId,
        event_type: buildTransitionEventType(targetNode?.name),
        label: buildTransitionLabel(targetNode?.name),
        guard_id: null,
        pre_action_ids: [],
        post_notification_ids: [],
        integration_binding_ids: [],
        delay_policy_id: null,
        reentry: true,
        internal: false,
      };
      const activeDefinition = {
        ...state.activeDefinition,
        edges: [...state.activeDefinition.edges, newEdge],
      };
      const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);
      return syncEditorState(state, {
        activeDefinition,
        rfNodes: canvasNodes,
        rfEdges: canvasEdges,
        selectedNodeId: null,
        selectedEdgeId: newEdge.id,
        isDirty: true,
      });
    });
  },
  deleteCanvasNode: (nodeId) => {
    get().pushHistory();
    set((state) => {
      if (!state.activeDefinition) return state;
      const remainingNodes = state.activeDefinition.nodes.filter((node) => node.id !== nodeId);
      if (remainingNodes.length === state.activeDefinition.nodes.length) return state;
      const hadInitial = state.activeDefinition.nodes.find((node) => node.id === nodeId)?.state_kind === 'initial';
      const normalizedNodes = hadInitial && remainingNodes.length
        ? remainingNodes.map((node, index) => ({
            ...node,
            state_kind: index === 0 ? 'initial' : (node.state_kind === 'initial' ? 'standard' : node.state_kind),
          }))
        : remainingNodes;
      const activeDefinition = {
        ...state.activeDefinition,
        nodes: normalizedNodes,
        edges: state.activeDefinition.edges.filter((edge) => edge.from_node_id !== nodeId && edge.to_node_id !== nodeId),
      };
      const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);
      return syncEditorState(state, {
        activeDefinition,
        rfNodes: canvasNodes,
        rfEdges: canvasEdges,
        selectedNodeId: null,
        selectedEdgeId: null,
        isDirty: true,
      });
    });
  },
  updateNodeProperties: (nodeId, changes) => set((state) => {
    if (!state.activeDefinition) return state;

    const rfNodes = state.rfNodes.map((node) => (
      node.id === nodeId
        ? {
            ...node,
            className: `workflow-node ${changes.state_kind || node.data.stateKind || node.data.definitionNode?.state_kind || 'standard'}`,
            data: {
              ...node.data,
              ...mapNodeChangesToCanvasData(changes),
              definitionNode: {
                ...node.data.definitionNode,
                ...changes,
              },
            },
          }
        : node
    ));

    const definitionSeed = {
      ...state.activeDefinition,
      nodes: state.activeDefinition.nodes.map((node) => (
        node.id === nodeId ? { ...node, ...changes } : node
      )),
    };
    const activeDefinition = fromRFState(definitionSeed, rfNodes, state.rfEdges);
    const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);

    return syncEditorState(state, {
      activeDefinition,
      rfNodes: canvasNodes,
      rfEdges: canvasEdges,
      isDirty: true,
    });
  }),
  updateEdgeProperties: (edgeId, changes) => get().updateEdge(edgeId, changes),
  deleteCanvasEdge: (edgeId) => {
    get().pushHistory();
    set((state) => {
      if (!state.activeDefinition) return state;
      const activeDefinition = {
        ...state.activeDefinition,
        edges: state.activeDefinition.edges.filter((edge) => edge.id !== edgeId),
      };
      if (activeDefinition.edges.length === state.activeDefinition.edges.length) return state;
      const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);
      return syncEditorState(state, {
        activeDefinition,
        rfNodes: canvasNodes,
        rfEdges: canvasEdges,
        selectedEdgeId: null,
        isDirty: true,
      });
    });
  },
  reverseCanvasEdge: (edgeId) => {
    get().pushHistory();
    set((state) => {
      if (!state.activeDefinition) return state;

      const edge = state.activeDefinition.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) return state;

      const nextFrom = edge.to_node_id;
      const nextTo = edge.from_node_id;
      if (!nextFrom || !nextTo || nextFrom === nextTo) return state;

      const hasDuplicate = state.activeDefinition.edges.some((candidate) => (
        candidate.id !== edgeId
        && candidate.from_node_id === nextFrom
        && candidate.to_node_id === nextTo
      ));
      if (hasDuplicate) return state;

      const targetNode = state.activeDefinition.nodes.find((node) => node.id === nextTo);
      const activeDefinition = {
        ...state.activeDefinition,
        edges: state.activeDefinition.edges.map((candidate) => (
          candidate.id === edgeId
            ? {
                ...candidate,
                from_node_id: nextFrom,
                to_node_id: nextTo,
                event_type: buildTransitionEventType(targetNode?.name),
                label: buildTransitionLabel(targetNode?.name),
              }
            : candidate
        )),
      };

      const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);
      return syncEditorState(state, {
        activeDefinition,
        rfNodes: canvasNodes,
        rfEdges: canvasEdges,
        selectedEdgeId: edgeId,
        selectedNodeId: null,
        isDirty: true,
      });
    });
  },
  updateEdge: (edgeId, changes) => set((state) => {
    if (!state.activeDefinition) return state;

    const currentEdge = state.activeDefinition.edges.find((edge) => edge.id === edgeId);
    if (!currentEdge) return state;

    const nextTargetNodeId = changes.target || changes.to_node_id || currentEdge.to_node_id;
    const targetNode = state.activeDefinition.nodes.find((node) => node.id === nextTargetNodeId);
    const shouldRefreshDerivedFields = (
      ('source' in changes)
      || ('target' in changes)
      || ('from_node_id' in changes)
      || ('to_node_id' in changes)
    ) && !('label' in changes) && !('event_type' in changes);

    const canonicalChanges = {
      ...(shouldRefreshDerivedFields ? {
        label: buildTransitionLabel(targetNode?.name),
        event_type: buildTransitionEventType(targetNode?.name),
      } : {}),
      ...changes,
      ...(changes.source ? { from_node_id: changes.source } : {}),
      ...(changes.target ? { to_node_id: changes.target } : {}),
    };
    const rfEdges = state.rfEdges.map((edge) => (
      edge.id === edgeId
        ? {
            ...edge,
            ...(canonicalChanges.from_node_id ? { source: canonicalChanges.from_node_id } : {}),
            ...(canonicalChanges.to_node_id ? { target: canonicalChanges.to_node_id } : {}),
            data: {
              ...edge.data,
              ...mapEdgeChangesToCanvasData(canonicalChanges),
              definitionEdge: {
                ...edge.data.definitionEdge,
                ...canonicalChanges,
              },
            },
            label: canonicalChanges.label ?? edge.label,
            animated: canonicalChanges.delay_policy_id ? true : edge.animated,
          }
        : edge
    ));

    const definitionSeed = {
      ...state.activeDefinition,
      edges: state.activeDefinition.edges.map((edge) => (
        edge.id === edgeId ? { ...edge, ...canonicalChanges } : edge
      )),
    };
    const activeDefinition = fromRFState(definitionSeed, state.rfNodes, rfEdges);
    const { canvasNodes, canvasEdges } = toRFState(activeDefinition, state.validationIssues || []);

    return syncEditorState(state, {
      activeDefinition,
      rfNodes: canvasNodes,
      rfEdges: canvasEdges,
      isDirty: true,
    });
  }),

  // ── Bootstrap from backend ────────────────────────────────────
  // Called once on WorkflowDesignerShell mount.
  // Returns true if at least one workflow was loaded, false if canvas stays empty.
  bootstrapFromBackend: async (tenantId) => {
    // Prefer project-scoped endpoint when an active project is known
    const projectId = getActiveProjectId();
    let stubs;
    if (projectId) {
      const result = await apiListProjectWorkflows(projectId);
      stubs = result?.workflows;
    } else {
      const result = await apiList(tenantId);
      stubs = result?.workflows ?? result; // handle both {workflows:[]} and []
    }
    if (!stubs?.length) return false;               // no saved workflows → empty canvas

    // Sort by most recently updated and load the first one fully
    const sorted = [...stubs].sort((a, b) =>
      new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    );

    const result = await apiLoad(sorted[0].id);
    if (!result?.ok || !result.workflow?.definition) return false;

    const def = result.workflow.definition;
    // Hydrate remaining stubs as shallow workflow objects (name only, no states/transitions)
    // so the tab strip shows all saved workflows. Only the active one is fully loaded.
    const shallowStubs = sorted.slice(1).map(s => ({
      id: s.id, name: s.name, states: [], transitions: [],
    }));

    const { workflow: wf, repaired } = normalizeWorkflowGraph({
      id:          def.id || sorted[0].id,
      name:        def.name || sorted[0].name,
      states:      def.nodes || def.states || [],
      transitions: def.edges || def.transitions || [],
    });

    const allWorkflows = [wf, ...shallowStubs];
    set(s => {
      const next = { ...s, workflows: allWorkflows, activeId: wf.id, isDirty: repaired };
      return { ...next, ...deriveEditorSlice(next) };
    });

    return true;
  },

  // ── Workflow CRUD ──────────────────────────────────────────
  addWorkflow: (projectId) => {
    const pid = projectId || getActiveProjectId();
    if (!pid) {
      // Caller must handle this — no project = no workflow
      throw new Error('NO_PROJECT');
    }
    const wf = { id: makeId(), name: 'New Workflow', project_id: pid, states: [], transitions: [] };
    set(s => ({ ...withEditorProjection(s, { workflows: [...s.workflows, wf], activeId: wf.id, isDirty: true }) }));
  },
  deleteWorkflow: (id) => set(s => {
    const next = s.workflows.filter(w => w.id !== id);
    if (!next.length) return s;
    const activeId = s.activeId === id ? next[0].id : s.activeId;
    return { ...withEditorProjection(s, { workflows: next, activeId, isDirty: true }) };
  }),
  renameWorkflow: (id, name) => set(s => ({
    ...withEditorProjection(s, {
      workflows: s.workflows.map(w => w.id === id ? { ...w, name } : w),
      isDirty: true,
    })
  })),
  setActive: (id) => set(s => ({ ...withEditorProjection(s, { activeId: id, selectedNodeId: null, selectedEdgeId: null }) })),

  // Clears only states + transitions of one workflow — keeps name, keeps other tabs
  clearWorkflow: (wfId) => set(s => ({
    ...withEditorProjection(s, {
      workflows: s.workflows.map(w => w.id !== wfId ? w : { ...w, states: [], transitions: [] }),
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
    })
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
    set(s => ({ ...withEditorProjection(s, { workflows: [...s.workflows, wf], activeId: wf.id, isDirty: true }) }));
  },

  // ── State CRUD ─────────────────────────────────────────────
  addState: (wfId) => set(s => ({
    ...withEditorProjection(s, {
      workflows: s.workflows.map(w => w.id !== wfId ? w : {
        ...w, states: [...w.states, { id: makeId(), name: '', initial: false, xstate: {} }]
      }),
      isDirty: true,
    })
  })),

  updateState: (wfId, stateId, patch) => set(s => ({
    ...withEditorProjection(s, {
      workflows: s.workflows.map(w => w.id !== wfId ? w : {
        ...w, states: w.states.map(st => st.id !== stateId ? st : { ...st, ...patch })
      }),
      isDirty: true,
    })
  })),

  // Rename + cascade all transitions referencing old name
  renameState: (wfId, stateId, newName) => {
    const wf = get().workflows.find(w => w.id === wfId);
    if (!wf) return;
    const oldName = wf.states.find(s => s.id === stateId)?.name || '';
    set(s => ({
      ...withEditorProjection(s, {
        workflows: s.workflows.map(w => w.id !== wfId ? w : {
          ...w,
          states: w.states.map(st => st.id !== stateId ? st : { ...st, name: newName }),
          transitions: w.transitions.map(t => ({
            ...t,
            from: t.from === oldName ? newName : t.from,
            to:   t.to   === oldName ? newName : t.to,
          })),
        }),
        isDirty: true,
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
      ...withEditorProjection(s, {
        workflows: s.workflows.map(w => w.id !== wfId ? w : {
          ...w, states: w.states.filter(st => st.id !== stateId)
        }),
        selectedNodeId: s.selectedNodeId === stateId ? null : s.selectedNodeId,
        isDirty: true,
      })
    }));
    return { ok: true };
  },

  // ── Transition CRUD ────────────────────────────────────────
  addTransition: (wfId) => set(s => ({
    ...withEditorProjection(s, {
      workflows: s.workflows.map(w => w.id !== wfId ? w : {
        ...w,
        transitions: [...w.transitions, { id: makeId(), from: '', to: '', conditions: null, permissions: null, xstate: {} }]
      }),
      isDirty: true,
    })
  })),

  updateTransition: (wfId, transId, patch) => set(s => ({
    ...withEditorProjection(s, {
      workflows: s.workflows.map(w => w.id !== wfId ? w : {
        ...w, transitions: w.transitions.map(t => t.id !== transId ? t : { ...t, ...patch })
      }),
      isDirty: true,
    })
  })),

  deleteTransition: (wfId, transId) => set(s => ({
    ...withEditorProjection(s, {
      workflows: s.workflows.map(w => w.id !== wfId ? w : {
        ...w, transitions: w.transitions.filter(t => t.id !== transId)
      }),
      selectedEdgeId: s.selectedEdgeId === transId ? null : s.selectedEdgeId,
      isDirty: true,
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
    ...withEditorProjection(s, {
      properties: [...s.properties, { id: makeId(), name: '', type: 'Text', required: false }],
      isDirty: true,
    })
  })),
  updateProperty: (id, patch) => set(s => ({
    ...withEditorProjection(s, {
      properties: s.properties.map(p => p.id !== id ? p : { ...p, ...patch }),
      isDirty: true,
    })
  })),
  deleteProperty: (id) => set(s => ({ ...withEditorProjection(s, { properties: s.properties.filter(p => p.id !== id), isDirty: true }) })),

  // ── Global: Rules ──────────────────────────────────────────
  addRule: () => set(s => ({
    ...withEditorProjection(s, {
      rules: [...s.rules, { id: makeId(), text: '' }],
      isDirty: true,
    })
  })),
  updateRule: (id, text) => set(s => ({
    ...withEditorProjection(s, {
      rules: s.rules.map(r => r.id !== id ? r : { ...r, text }),
      isDirty: true,
    })
  })),
  deleteRule: (id) => set(s => ({ ...withEditorProjection(s, { rules: s.rules.filter(r => r.id !== id), isDirty: true }) })),

  // Accepts a fully-parsed object and adds it as a new workflow tab,
  // merging users/properties/rules into the global store arrays.
  importWorkflow: ({ workflow, users = [], properties = [], rules = [] }) => {
    const { workflow: wf } = normalizeWorkflowGraph(workflow, { regenerateStateIds: true });
    set(s => ({
      ...withEditorProjection(s, {
        workflows:  [...s.workflows, wf],
        activeId:   wf.id,
        users:      [...s.users,      ...users.map(u => ({ id: makeId(), ...u }))],
        properties: [...s.properties, ...properties.map(p => ({ id: makeId(), ...p }))],
        rules:      [...s.rules,      ...rules.map(r => ({ ...r, id: r.id || makeId() }))],
        selectedNodeId: null,
        selectedEdgeId: null,
        isDirty: true,
      }),
    }));
    return wf.id;
  },

  // ── Import workflow from JSON file (POST /api/workflows/import) ──────────
  // Accepts a Provisio-exported workflow JSON and creates a new tab.
  seedImportedWorkflow: (mfData) => {
    const date = mfData.importedAt ? mfData.importedAt.split('T')[0] : new Date().toISOString().split('T')[0];
    const wf = {
      ...normalizeWorkflowGraph({
        name: `📥 ${mfData.name} (imported ${date})`,
        states: mfData.states || [],
        transitions: mfData.transitions || [],
      }, { regenerateStateIds: true }).workflow,
      source: mfData.source || 'provisio',
      importedAt: mfData.importedAt,
    };
    set(s => {
      // Extract texts from rules and scripts to save to global rules
      const newRules = [
        ...(mfData.rules || []).map(r => ({ id: r.id || makeId(), text: r.text })),
        ...(mfData.scripts || []).map(scr => ({ id: scr.id || makeId(), text: `VBScript on state ${scr.state}: ${scr.text}` }))
      ];
      return {
        ...withEditorProjection(s, {
          workflows: [...s.workflows, wf],
          activeId:  wf.id,
          rules:     [...s.rules, ...newRules],
          selectedNodeId: null,
          selectedEdgeId: null,
          isDirty: true,
        }),
      };
    });
    return wf.id;
  },

  // ── Reset everything ───────────────────────────────────────
  resetAll: () => set(fresh()),
}));

if (typeof window !== 'undefined') {
  window.__workflowStore = useWorkflowStore;
}

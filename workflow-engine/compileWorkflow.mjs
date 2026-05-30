const TERMINAL_STATE_KINDS = new Set(['terminal']);

function assertDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new Error('compileWorkflow requires a workflow definition object');
  }
  if (!Array.isArray(definition.nodes) || !definition.nodes.length) {
    throw new Error('WorkflowDefinition.nodes must contain at least one node');
  }
  if (!Array.isArray(definition.edges)) {
    throw new Error('WorkflowDefinition.edges must be an array');
  }
}

function buildIndex(entries = []) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function pickInitialNode(definition) {
  const initialNodes = definition.nodes.filter((node) => node.state_kind === 'initial');
  if (initialNodes.length !== 1) {
    throw new Error(`WorkflowDefinition must contain exactly one initial node, received ${initialNodes.length}`);
  }
  return initialNodes[0];
}

function validateReferences(definition, indexes) {
  definition.edges.forEach((edge) => {
    if (!indexes.nodes.has(edge.from_node_id)) {
      throw new Error(`WorkflowEdge ${edge.id} references missing from_node_id ${edge.from_node_id}`);
    }
    if (!indexes.nodes.has(edge.to_node_id)) {
      throw new Error(`WorkflowEdge ${edge.id} references missing to_node_id ${edge.to_node_id}`);
    }
    if (edge.guard_id && !indexes.guards.has(edge.guard_id)) {
      throw new Error(`WorkflowEdge ${edge.id} references missing guard_id ${edge.guard_id}`);
    }
    edge.pre_action_ids.forEach((actionId) => {
      if (!indexes.actions.has(actionId)) {
        throw new Error(`WorkflowEdge ${edge.id} references missing pre_action ${actionId}`);
      }
    });
    edge.post_notification_ids.forEach((notificationId) => {
      if (!indexes.notifications.has(notificationId)) {
        throw new Error(`WorkflowEdge ${edge.id} references missing post_notification ${notificationId}`);
      }
    });
    if (edge.delay_policy_id && !indexes.delays.has(edge.delay_policy_id)) {
      throw new Error(`WorkflowEdge ${edge.id} references missing delay_policy_id ${edge.delay_policy_id}`);
    }
  });

  definition.nodes.forEach((node) => {
    node.entry_action_ids.forEach((actionId) => {
      if (!indexes.actions.has(actionId)) {
        throw new Error(`WorkflowNode ${node.id} references missing entry_action ${actionId}`);
      }
    });
    node.exit_action_ids.forEach((actionId) => {
      if (!indexes.actions.has(actionId)) {
        throw new Error(`WorkflowNode ${node.id} references missing exit_action ${actionId}`);
      }
    });
    if (node.invoked_service_id && !indexes.services.has(node.invoked_service_id)) {
      throw new Error(`WorkflowNode ${node.id} references missing invoked_service_id ${node.invoked_service_id}`);
    }
    if (node.sla_policy_id && !indexes.slas.has(node.sla_policy_id)) {
      throw new Error(`WorkflowNode ${node.id} references missing sla_policy_id ${node.sla_policy_id}`);
    }
    if (node.escalation_policy_id && !indexes.escalations.has(node.escalation_policy_id)) {
      throw new Error(`WorkflowNode ${node.id} references missing escalation_policy_id ${node.escalation_policy_id}`);
    }
  });
}

function resolvePath(source, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function parseLiteral(raw) {
  const value = String(raw).trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return { ref: value };
}

function compareValues(leftValue, operator, rightValue) {
  switch (operator) {
    case '==': return leftValue === rightValue;
    case '!=': return leftValue !== rightValue;
    case '>': return Number(leftValue) > Number(rightValue);
    case '>=': return Number(leftValue) >= Number(rightValue);
    case '<': return Number(leftValue) < Number(rightValue);
    case '<=': return Number(leftValue) <= Number(rightValue);
    case 'includes': return Array.isArray(leftValue) ? leftValue.includes(rightValue) : String(leftValue || '').includes(String(rightValue));
    default: throw new Error(`Unsupported guard operator ${operator}`);
  }
}

function evaluateClause(clause, scope) {
  const match = clause.match(/^([a-zA-Z0-9_.]+)\s*(==|!=|>=|<=|>|<|includes)\s*(.+)$/);
  if (!match) {
    throw new Error(`Unsupported guard clause: ${clause}`);
  }
  const [, leftPath, operator, rightRaw] = match;
  const leftValue = resolvePath(scope, leftPath);
  const parsedRight = parseLiteral(rightRaw);
  const rightValue = parsedRight && typeof parsedRight === 'object' && 'ref' in parsedRight
    ? resolvePath(scope, parsedRight.ref)
    : parsedRight;
  return compareValues(leftValue, operator, rightValue);
}

function evaluateGuardExpression(expressionDsl, scope) {
  const expression = String(expressionDsl || '').trim();
  if (!expression) return true;

  if (expression.includes(' || ')) {
    return expression.split(/\s\|\|\s/).some((clause) => evaluateGuardExpression(clause, scope));
  }
  if (expression.includes(' && ')) {
    return expression.split(/\s&&\s/).every((clause) => evaluateGuardExpression(clause, scope));
  }
  return evaluateClause(expression, scope);
}

function buildGuardImplementations(guardRegistry = []) {
  return Object.fromEntries(guardRegistry.map((guard) => [
    guard.id,
    ({ context = {}, event = {} }) => evaluateGuardExpression(guard.expression_dsl, { context, event }),
  ]));
}

function buildActionImplementations(actionRegistry = []) {
  return Object.fromEntries(actionRegistry.map((action) => [
    action.id,
    ({ context = {} }) => ({ ...context, last_action_id: action.id }),
  ]));
}

function buildServiceImplementations(serviceRegistry = []) {
  return Object.fromEntries(serviceRegistry.map((service) => [
    service.id,
    async () => ({ serviceId: service.id, status: 'stubbed' }),
  ]));
}

function buildDelayImplementations(delayPolicies = []) {
  return Object.fromEntries(delayPolicies.map((policy) => [policy.id, policy.duration_ms]));
}

function compileNode(node, definition, indexes) {
  const outgoing = definition.edges.filter((edge) => edge.from_node_id === node.id);
  const on = Object.fromEntries(outgoing.map((edge) => {
    const transition = {
      target: edge.to_node_id,
      actions: edge.pre_action_ids,
      reenter: edge.reentry,
      internal: edge.internal,
    };
    if (edge.guard_id) transition.guard = edge.guard_id;
    return [edge.event_type, transition];
  }));

  const config = {
    entry: node.entry_action_ids,
    exit: node.exit_action_ids,
    tags: node.tags,
    meta: {
      nodeId: node.id,
      name: node.name,
      stateKind: node.state_kind,
      behaviourFlags: node.behaviour_flags,
      assigneeRoleId: node.assignee_role_id || null,
      fallbackRoleId: node.fallback_role_id || null,
      slaPolicyId: node.sla_policy_id || null,
      escalationPolicyId: node.escalation_policy_id || null,
    },
  };

  if (Object.keys(on).length) {
    config.on = on;
  }

  if (node.invoked_service_id) {
    config.invoke = { src: node.invoked_service_id, id: `invoke.${node.id}` };
  }

  if (node.sla_policy_id) {
    const slaPolicy = indexes.slas.get(node.sla_policy_id);
    if (slaPolicy) {
      config.after = {
        [node.sla_policy_id]: {
          actions: [],
        },
      };
    }
  }

  if (TERMINAL_STATE_KINDS.has(node.state_kind)) {
    config.type = 'final';
  }

  return config;
}

function buildIndexes(definition) {
  return {
    nodes: buildIndex(definition.nodes),
    guards: buildIndex(definition.guard_registry || []),
    actions: buildIndex(definition.action_registry || []),
    services: buildIndex(definition.service_registry || []),
    notifications: buildIndex(definition.notification_registry || []),
    delays: buildIndex(definition.delay_policies || []),
    slas: buildIndex(definition.sla_policies || []),
    escalations: buildIndex(definition.escalation_policies || []),
  };
}

export function compileWorkflow(definition) {
  assertDefinition(definition);
  const indexes = buildIndexes(definition);
  validateReferences(definition, indexes);
  const initialNode = pickInitialNode(definition);

  const states = Object.fromEntries(definition.nodes.map((node) => [
    node.id,
    compileNode(node, definition, indexes),
  ]));

  return {
    machineConfig: {
      id: definition.id,
      initial: initialNode.id,
      context: {
        workflowDefinitionId: definition.id,
        workflowVersion: definition.version,
      },
      states,
    },
    implementations: {
      guards: buildGuardImplementations(definition.guard_registry || []),
      actions: buildActionImplementations(definition.action_registry || []),
      actors: buildServiceImplementations(definition.service_registry || []),
      delays: buildDelayImplementations(definition.delay_policies || []),
    },
    index: {
      nodeIds: definition.nodes.map((node) => node.id),
      edgeIds: definition.edges.map((edge) => edge.id),
      guardIds: (definition.guard_registry || []).map((guard) => guard.id),
    },
  };
}

export function validateWorkflowDefinition(definition) {
  const indexes = buildIndexes(definition);
  validateReferences(definition, indexes);
  pickInitialNode(definition);
  return true;
}

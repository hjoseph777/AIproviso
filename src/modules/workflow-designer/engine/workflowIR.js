const normalizeNodeId = (value = '') => value.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

function titleCase(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveRuleIdForState(stateName = '') {
  const normalized = stateName.toLowerCase();
  if (normalized.includes('review')) return 'rule.invoice.confidence.manual_review';
  if (normalized.includes('approval')) return 'rule.invoice.approval.pending';
  if (normalized.includes('signature')) return 'rule.invoice.signature.pending';
  if (normalized.includes('draft')) return 'rule.workflow.transition.recorded';
  return null;
}

function toCleanList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function eventTypeForTransition(transition) {
  if (!transition?.to) return 'workflow.transition';
  return `invoice.${String(transition.to).trim().toLowerCase().replace(/\s+/g, '_')}`;
}

function buildCanonicalWorkflowIR(wf, rules = []) {
  if (!wf) return null;
  const ruleCatalog = Object.fromEntries(rules.map((rule) => [rule.id, rule]));
  const states = (wf.states || []).map((state) => {
    const stateId = normalizeNodeId(state.name).toLowerCase();
    const ruleId = deriveRuleIdForState(state.name);
    const authoredXState = state.xstate || {};
    const tags = toCleanList(authoredXState.tags);

    return {
      id: state.id,
      name: state.name,
      initial: !!state.initial,
      meta: {
        business: {
          label: state.name,
          lane: state.initial ? 'entry' : 'flow',
        },
        runtime: {
          stateId,
          ruleId,
          routeEligible: true,
        },
        xstate: {
          stateId: `states.${stateId}`,
          entryAction: authoredXState.entryAction || `action.enter.${stateId}`,
          exitAction: authoredXState.exitAction || `action.exit.${stateId}`,
          invoke: authoredXState.invoke || null,
          after: authoredXState.after || null,
          always: authoredXState.always || null,
          tags: tags.length ? tags : [state.initial ? 'entry-state' : 'workflow-state'],
          meta: authoredXState.meta || {
            label: state.name,
            initial: !!state.initial,
          },
        },
        n8n: {
          nodeId: `n8n.state.${stateId}`,
          webhookPath: `/webhook/invoice.${stateId}`,
          connector: state.initial ? 'intake' : 'workflow-router',
        },
        rule: ruleId ? ruleCatalog[ruleId] || { id: ruleId, text: titleCase(ruleId) } : null,
      },
    };
  });

  const transitions = (wf.transitions || []).map((transition) => {
    const fromId = normalizeNodeId(transition.from).toLowerCase();
    const toId = normalizeNodeId(transition.to).toLowerCase();
    const authoredXState = transition.xstate || {};
    const eventType = authoredXState.eventType || eventTypeForTransition(transition);
    const ruleId = deriveRuleIdForState(transition.to) || deriveRuleIdForState(transition.from);
    const actions = toCleanList(authoredXState.actions);

    return {
      id: transition.id,
      from: transition.from,
      to: transition.to,
      meta: {
        runtime: {
          eventType,
          ruleId,
          guardName: ruleId ? titleCase(ruleId).replace(/\s+/g, '_').toLowerCase() : null,
        },
        xstate: {
          eventType,
          target: authoredXState.target || `states.${toId}`,
          guardName: authoredXState.guardName || (ruleId ? `guard.${fromId}_to_${toId}` : null),
          actions: actions.length ? actions : [`action.transition.${fromId}_to_${toId}`],
          reenter: authoredXState.reenter ?? true,
        },
        n8n: {
          nodeId: `n8n.edge.${fromId}_${toId}`,
          webhookPath: `/webhook/${eventType.replace(/\./g, '-')}`,
          connector: 'http-request',
        },
      },
    };
  });

  return {
    workflow: {
      id: wf.id,
      name: wf.name,
    },
    states,
    transitions,
    rules: rules.map((rule) => ({ id: rule.id, text: rule.text })),
  };
}

function compileToXState(ir) {
  if (!ir) return null;
  return {
    id: normalizeNodeId(ir.workflow.name || 'workflow').toLowerCase(),
    initial: ir.states.find((state) => state.initial)?.meta.runtime.stateId || ir.states[0]?.meta.runtime.stateId || 'draft',
    states: Object.fromEntries(ir.states.map((state) => {
      const outgoing = ir.transitions.filter((transition) => transition.from === state.name);
      return [state.meta.runtime.stateId, {
        entry: state.meta.xstate.entryAction,
        exit: state.meta.xstate.exitAction,
        invoke: state.meta.xstate.invoke,
        after: state.meta.xstate.after,
        always: state.meta.xstate.always,
        tags: state.meta.xstate.tags,
        meta: state.meta.xstate.meta,
        on: Object.fromEntries(outgoing.map((transition) => [transition.meta.xstate.eventType, {
          target: transition.meta.xstate.target,
          guard: transition.meta.xstate.guardName,
          actions: transition.meta.xstate.actions,
          reenter: transition.meta.xstate.reenter,
        }])),
      }];
    })),
  };
}

function compileToN8n(ir) {
  if (!ir) return null;
  return {
    name: `${ir.workflow.name || 'Workflow'} Orchestration`,
    nodes: [
      ...ir.states.map((state) => ({
        id: state.meta.n8n.nodeId,
        name: `${state.name} Node`,
        type: state.initial ? 'webhook' : 'trigger',
        webhookPath: state.meta.n8n.webhookPath,
        connector: state.meta.n8n.connector,
      })),
      ...ir.transitions.map((transition) => ({
        id: transition.meta.n8n.nodeId,
        name: `${transition.from} -> ${transition.to}`,
        type: 'httpRequest',
        webhookPath: transition.meta.n8n.webhookPath,
        connector: transition.meta.n8n.connector,
      })),
    ],
  };
}

export {
  buildCanonicalWorkflowIR,
  compileToN8n,
  compileToXState,
  eventTypeForTransition,
  normalizeNodeId,
};
const hasIssueForTarget = (issues = [], targetId) => issues.some((issue) => issue.targetId === targetId || issue.linkedId === targetId);

export const toRFNode = (node, issues = []) => ({
  id: node.id,
  type: 'workflowState',
  position: node.canvas_position || { x: 0, y: 0 },
  // Explicit measured dimensions so React Flow v12 enables edge rendering immediately.
  // RF v12 gates edges on nodesInitialized (all nodes have measured); without this
  // the edges SVG never mounts. RF will overwrite with real ResizeObserver dimensions.
  width: 220,
  height: 110,
  measured: { width: 220, height: 110 },
  data: {
    nodeId: node.id,
    stateKind: node.state_kind,
    name: node.name,
    assigneeRoleId: node.assignee_role_id || null,
    fallbackRoleId: node.fallback_role_id || null,
    slaPolicyId: node.sla_policy_id || null,
    escalationPolicyId: node.escalation_policy_id || null,
    tags: node.tags || [],
    hasValidationErrors: hasIssueForTarget(issues, node.id),
    definitionNode: node,
  },
  className: `workflow-node ${node.state_kind}`,
  selectable: true,
  draggable: true,
});

export const toRFEdge = (edge, nodes = [], issues = []) => ({
  id: edge.id,
  source: edge.from_node_id,
  target: edge.to_node_id,
  type: 'default',
  label: edge.label,
  selectable: true,
  reconnectable: true,
  focusable: true,
  data: {
    edgeId: edge.id,
    eventType: edge.event_type,
    label: edge.label,
    guardId: edge.guard_id || null,
    delayPolicyId: edge.delay_policy_id || null,
    bendPoint: edge.bend_point || null,
    hasValidationErrors: hasIssueForTarget(issues, edge.id),
    sourceKind: nodes.find((n) => n.id === edge.from_node_id)?.state_kind || 'standard',
    definitionEdge: edge,
  },
  animated: !!edge.delay_policy_id,
});

export const toRFState = (definition, issues = []) => ({
  canvasNodes: (definition?.nodes || []).map((node) => toRFNode(node, issues)),
  canvasEdges: (definition?.edges || []).filter((edge) => edge.from_node_id && edge.to_node_id).map((edge) => toRFEdge(edge, definition?.nodes || [], issues)),
});

export const fromRFState = (definition, canvasNodes = [], canvasEdges = []) => {
  const nodeIndex = new Map(canvasNodes.map((node) => [node.id, node]));
  const edgeIndex = new Map(canvasEdges.map((edge) => [edge.id, edge]));

  return {
    ...definition,
    nodes: (definition?.nodes || []).map((node) => {
      const canvasNode = nodeIndex.get(node.id);
      return {
        ...node,
        name: canvasNode?.data?.name || node.name,
        state_kind: canvasNode?.data?.stateKind || node.state_kind,
        assignee_role_id: canvasNode?.data?.assigneeRoleId ?? node.assignee_role_id,
        fallback_role_id: canvasNode?.data?.fallbackRoleId ?? node.fallback_role_id,
        sla_policy_id: canvasNode?.data?.slaPolicyId ?? node.sla_policy_id,
        escalation_policy_id: canvasNode?.data?.escalationPolicyId ?? node.escalation_policy_id,
        tags: canvasNode?.data?.tags || node.tags,
        canvas_position: canvasNode?.position || node.canvas_position,
      };
    }),
    edges: (definition?.edges || []).map((edge) => {
      const canvasEdge = edgeIndex.get(edge.id);
      return {
        ...edge,
        from_node_id: canvasEdge?.source || edge.from_node_id,
        to_node_id: canvasEdge?.target || edge.to_node_id,
        event_type: canvasEdge?.data?.eventType || edge.event_type,
        label: canvasEdge?.data?.label || edge.label,
        guard_id: canvasEdge?.data?.guardId ?? edge.guard_id,
        delay_policy_id: canvasEdge?.data?.delayPolicyId ?? edge.delay_policy_id,
        bend_point: canvasEdge?.data?.bendPoint ?? edge.bend_point ?? null,
      };
    }),
  };
};
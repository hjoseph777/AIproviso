# AI Proviso GUI Revamp Plan

## Goal

Build a workflow authoring and AP workbench experience that is friendlier than engine-centric tools while staying compatible with the canonical workflow definition and runtime model.

The UI must separate two product modes:

- AP Workbench: operators, reviewers, approvers
- Integrator Designer: consultants, admins

Do not overload one screen to serve both equally.

## Screen Model

### 1. AP Workbench

Primary jobs:

- review invoice queue
- inspect extraction confidence
- resolve exceptions
- approve or reject
- see SLA risk
- view audit and routing history

Core panels:

- queue list
- invoice detail and document viewer
- extraction confidence panel
- current workflow state and assigned task
- audit timeline
- action rail

### 2. Integrator Designer

Primary jobs:

- author workflow definitions
- configure state and transition behavior
- validate and simulate
- publish new versions
- compare versions

Core panels:

- React Flow canvas
- inspector panel
- validation panel
- version and publish panel
- simulation panel

## React Flow Data Model

### Canvas State

Canvas state is an editing projection, not the source of truth.

```ts
type DesignerDocument = {
  definition: WorkflowDefinition;
  canvasNodes: ReactFlowNode[];
  canvasEdges: ReactFlowEdge[];
  selectedNodeId: UUID | null;
  selectedEdgeId: UUID | null;
  validationIssues: ValidationIssue[];
  dirty: boolean;
};
```

### Node Mapping

```ts
type WorkflowCanvasNodeData = {
  nodeId: UUID;
  stateKind: WorkflowStateKind;
  name: string;
  assigneeRoleId: UUID | null;
  slaPolicyId: UUID | null;
  escalationPolicyId: UUID | null;
  tags: string[];
  hasValidationErrors: boolean;
};
```

Rules:

- `nodeId` is the canonical reference
- canvas position is editor-only but persisted back into `WorkflowNode.canvas_position`
- no runtime-only snapshot data lives in React Flow node data

### Edge Mapping

```ts
type WorkflowCanvasEdgeData = {
  edgeId: UUID;
  eventType: string;
  label: string;
  guardId: UUID | null;
  delayPolicyId: UUID | null;
  hasValidationErrors: boolean;
};
```

Rules:

- edge source and target map to `from_node_id` and `to_node_id`
- guard references are UUIDs only
- no free-text rule names as identity

## Inspector Design

### State Inspector

Fields:

- state name
- state kind
- assignee role
- fallback role
- SLA policy
- escalation policy
- entry actions
- exit actions
- invoked service
- behavior flags
- document requirements
- tags

### Transition Inspector

Fields:

- label
- event type
- guard reference
- pre-actions
- post notifications
- integration bindings
- delay policy
- reentry
- internal

## UX Modes

### Novice Mode

Visible:

- state name
- approval owner
- SLA
- escalation
- comments
- email approval toggle
- exception handling settings

Hidden by default:

- service refs
- action registry ids
- raw integration refs
- advanced timing behavior

### Expert Mode

Adds:

- guard UUID and DSL preview
- service refs
- action ids
- integration binding refs
- runtime metadata preview
- compiled machine preview

## Validation UX

Validation must be inline, not a detached afterthought.

Issues to surface:

- missing initial state
- duplicate initial states
- unreachable node
- orphan transition
- missing guard reference
- missing role assignment on approval state
- conflicting approval thresholds
- missing target for delay or escalation
- publish attempt with unresolved errors

Every issue should support:

- severity
- message
- linked node or edge id
- inspector jump

## Store Shape Direction

Replace global workflow properties and rules with a per-definition editing model.

Target store shape:

```ts
type WorkflowDesignerState = {
  activeDefinition: WorkflowDefinition | null;
  canvasNodes: ReactFlowNode[];
  canvasEdges: ReactFlowEdge[];
  selectedNodeId: UUID | null;
  selectedEdgeId: UUID | null;
  validationIssues: ValidationIssue[];
  dirty: boolean;
  mode: 'novice' | 'expert';
};
```

Rules:

- approval thresholds, properties, rules, and behaviors live inside `activeDefinition`
- no global mutable arrays for workflow-scoped configuration
- canvas arrays are derived editing projections

## Publish Flow

Required steps:

1. save draft
2. run validation
3. run simulation
4. show version impact
5. publish immutable version

Publish must explicitly tell the user:

- this version affects new invoices only
- in-flight invoices remain pinned to prior version

## Implementation Order

1. Map canonical `WorkflowDefinition` to React Flow node and edge data
2. Replace global workflow editor state with one definition-centric store
3. Build state inspector
4. Build transition inspector
5. Add inline validation panel and jump-to-issue behavior
6. Add novice and expert display modes
7. Add publish and version UX

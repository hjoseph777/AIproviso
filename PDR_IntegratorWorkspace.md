# AI Proviso — Workflow Designer Canvas
## Complete Implementation Document

**Author:** Harry Joseph — scriptdotnet · Xerox Canada  
**Stack:** React Flow Pro · XState v5 · Zustand · n8n · PostgreSQL 16  
**Date:** May 2026 · Version 2.0  
**Purpose:** Definitive build reference for the AI Proviso integrator workspace canvas

---

## Table of Contents

1. [Architecture Decision — Why This Exact Stack](#1-architecture-decision)
2. [Core Design Philosophy — Two Elements Only](#2-core-design-philosophy)
3. [React Flow Pro — Feature Map](#3-react-flow-pro-feature-map)
4. [State Box Node Specification](#4-state-box-node-specification)
5. [Transition Arrow Edge Specification](#5-transition-arrow-edge-specification)
6. [Bidirectional Arrows — Full Spec](#6-bidirectional-arrows)
7. [Bézier Curves — Bend and Reshape](#7-bézier-curves--bend-and-reshape)
8. [Three AI Creation Modes](#8-three-ai-creation-modes)
9. [Auto Layout — Optimize and Fit](#9-auto-layout--optimize-and-fit)
10. [Simulation Mode](#10-simulation-mode)
11. [Real-Time Collaboration](#11-real-time-collaboration)
12. [Performance — Optimized Redraw](#12-performance--optimized-redraw)
13. [Data Model — Canonical Schema](#13-data-model--canonical-schema)
14. [XState Integration — The Execution Engine](#14-xstate-integration)
15. [UI Layout — Three-Panel Design](#15-ui-layout--three-panel-design)
16. [Implementation Prompts — Step by Step](#16-implementation-prompts)
17. [React Flow Pro Examples — Integration Order](#17-react-flow-pro-examples--integration-order)
18. [Verification Checklist](#18-verification-checklist)
19. [Delivery Timeline — 12 Days](#19-delivery-timeline)

---

## 1. Architecture Decision

### Why React Flow Pro Over Mermaid

Mermaid.js was used in the original `Proviso_App.jsx` SOW editor. It is dropped from AI Proviso entirely.

```
Mermaid                          React Flow Pro
────────────────────────────────────────────────────────
Text → SVG render only           Interactive node canvas
No drag-drop                     Native drag-drop
No handles                       4-directional handles per node
No selection events              onNodeClick, onEdgeClick, full event API
No inline editing                Custom node components — full React
No connection drawing            onConnect, live connection line preview
No zoom/pan control              Built-in zoom, pan, fit, minimap
No custom nodes                  nodeTypes registration — any HTML
No custom edges                  edgeTypes registration — any SVG/HTML
No bend handles                  Edge path manipulation built-in
No collaboration                 Liveblocks integration in Pro examples
No simulation                    animated prop + CSS keyframes
Build time: weeks                Build time: days using Pro examples
```

### The Division Rule — Enforced

```
react-flow        canvas rendering, interaction, serialisation
XState v5         execution engine — backend ONLY, never on canvas
PostgreSQL 16     persistence, audit, snapshots — only source of truth
n8n 2.22.3        notifications, ERP calls — post-commit ONLY
BullMQ + Redis 7  SLA timers, reliable delivery
Zustand 4.5       canvas state, rfNodes, rfEdges, selection
@zustend/temporal 50-state undo/redo — built into Zustand
elkjs             auto-layout computation
Yjs + WebSocket   real-time collaboration sync
qwen2.5:14b       AI generation and customisation — design-time only
```

### Package Installation

```bash
# React Flow Pro — requires Pro subscription
npm install @xyflow/react

# Layout
npm install elkjs

# State management
npm install zustand
npm install @zustend/temporal

# XState execution (backend)
npm install xstate xstate-migrate

# Collaboration
npm install yjs y-websocket

# Styling
npm install tailwindcss
```

---

## 2. Core Design Philosophy — Two Elements Only

The entire designer is built around two draggable elements. Nothing else.

```
┌─────────────────────────────────────────────────────────┐
│  TOOLBAR — exactly two items                            │
│                                                         │
│   ┌──────────────┐        ┌──────────────┐             │
│   │              │        │              │             │
│   │  STATE BOX   │        │   ARROW      │             │
│   │              │        │              │             │
│   │  drag to     │        │  drag to     │             │
│   │  canvas      │        │  canvas then │             │
│   │              │        │  connect two │             │
│   │  dbl-click   │        │  boxes       │             │
│   │  to config   │        │  dbl-click   │             │
│   │              │        │  to config   │             │
│   └──────────────┘        └──────────────┘             │
└─────────────────────────────────────────────────────────┘
```

**The rule:** No condition diamond nodes. No gateway shapes. No separate event nodes. All logic — guards, conditions, entry actions, exit actions, SLA timers — lives inside the double-click editors on boxes and arrows only.

This matches how M-Files works conceptually (state + transition model) but makes it visual, interactive, and AI-assisted.

### Why This Is the Right Model

```
Canvas shows:   what the workflow does (states)
Arrows show:    when it moves (transitions)
Double-click:   how it decides (conditions and guards)

Separation of visual flow from logic detail is what
makes tools feel powerful yet approachable.
M-Files, BPMN, Windows Workflow Foundation, XState —
all use the same state + transition model.
```

---

## 3. React Flow Pro — Feature Map

Every Pro example maps to a specific AP Proviso feature.

| Pro Example | Feature It Provides | AP Proviso Usage |
| :--- | :--- | :--- |
| `shapes-pro-example` | Custom node shapes | State Box — stripe, pill, meta row |
| `editable-edge-pro-example` | Double-click edge edit | Transition Editor popup |
| `collaborative-pro-example` | Multi-user Yjs sync | Philippe + Harry simultaneous editing |
| `undo-redo-pro-example` | Full history stack | Ctrl+Z / Ctrl+Y 50 states |
| `copy-paste-pro-example` | Duplicate nodes/edges | Right-click → Duplicate |
| `auto-layout-pro-example` | Auto-arrange nodes | ELKjs layout button |
| `dynamic-layouting-pro-example` | Live layout updates | Optimized redraw |
| `libavoid-edge-routing-pro-example` | Smart path routing | Arrows route around nodes |
| `node-position-animation-pro-example` | Smooth node movement | Simulation state transitions |
| `selection-grouping-pro-example` | Group multi-select | Group AP sub-processes |
| `expand-collapse-pro-example` | Collapse sub-workflows | Nested AP processes |
| `helper-lines-pro-example` | Snap-to-grid alignment | 12px grid snapping |
| `freehand-draw-pro-example` | Free drawing | Annotation / markup layer |
| `server-side-image-creation-pro-example` | Export canvas as image | PNG/SVG export |
| `remove-attribution-pro-example` | Remove watermark | Clean production UI for Michel |
| `force-layout-pro-example` | Physics-based layout | Large workflow organisation |
| `parent-child-relation-pro-example` | Nested node relationships | Sub-workflow grouping |

### Integration Priority Order

```
PHASE 1 — Core canvas (Days 1–4)
  shapes-pro-example              ← State Box custom node
  editable-edge-pro-example       ← double-click Arrow editor
  helper-lines-pro-example        ← 12px grid snap alignment
  remove-attribution-pro-example  ← clean UI from day one

PHASE 2 — Smart layout and performance (Days 5–7)
  auto-layout-pro-example         ← ELKjs auto-arrange
  dynamic-layouting-pro-example   ← optimised redraw
  libavoid-edge-routing           ← arrows never overlap nodes
  node-position-animation         ← smooth simulation transitions

PHASE 3 — User experience (Days 8–9)
  copy-paste-pro-example          ← duplicate states fast
  undo-redo-pro-example           ← 50-state history
  selection-grouping-pro-example  ← group sub-processes
  expand-collapse-pro-example     ← hide/show sub-workflows

PHASE 4 — Collaboration and export (Days 10–12)
  collaborative-pro-example              ← Harry + Philippe live
  server-side-image-creation-pro-example ← PNG/SVG export
  freehand-draw-pro-example              ← annotation layer
  parent-child-relation-pro-example      ← nested workflows
```

---

## 4. State Box Node Specification

### Visual Design Rules

```
The state box is a professional card, not a toy widget.
Rules enforced without exception:

  - Rounded corners: 8px — not playground-rounded (16px+)
  - Left accent stripe: 2px width — the ONLY colour on the card
  - No gradients, no glows in default state
  - No emoji icons on the card face
  - No saturated background fills
  - Hover: subtle border colour change + 1px lift only
  - Selected: 1.5px border + kind-coloured shadow ring (2px)
  - Four directional handles: invisible at rest, appear on hover
  - Font: Inter or DM Sans — not Sora, not Outfit (too playful)

Width: 148–165px depending on content
Height: auto, minimum 78px
```

### Accent Stripe Colour System — Semantic Only

```
State kind          Stripe colour         Meaning
─────────────────────────────────────────────────────────
initial             #22c97a  emerald       entry point
auto / technical    #3b8fff  sapphire      automated step
approval / gate     #c88c18  amber         human decision
exception           #c43048  crimson       error path
terminal            #8060e8  violet        final state
ERP / teal          #12aac0  cyan          system integration
```

### Node Card Layout (top to bottom)

```
┌─ 2px accent stripe
│  ┌────────────────────────────────────┐
│  │  State Name           [kind pill] │  ← font-weight 500
│  │  state kind label                 │  ← 8px monospace dim
│  │  ─────────────────────────────── │  ← 1px separator
│  │  entry: action1 · action2         │  ← 8.5px mono muted
│  │  ⏱ 4h · L1→L2→L3                │  ← amber, only if SLA
│  └────────────────────────────────────┘
```

### Kind Pill — Barely Visible

```css
/* The pill is NOT a badge. It is a ghost label. */
.kind-pill {
  font-size: 8px;
  font-family: monospace;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgba(colour, 0.2);    /* barely there border */
  color: rgba(colour, 0.7);               /* desaturated colour */
  background: rgba(colour, 0.05);         /* ghost fill */
  opacity: 0.7;
}
```

### Double-Click → State Editor Modal

Opens as a sliding right panel — NOT a modal dialog.
No Save button. Every field change is live.
Four progressive tabs — only Basic shown by default.

**Tab 1 — Basic**

| Field | Type | Notes |
| :--- | :--- | :--- |
| Name | Text input | Live updates card on canvas |
| Kind | Visual pill buttons | Not a `<select>` dropdown |
| Assignee role | Dropdown | AP Manager, Controller, CFO |
| SLA duration | Number + unit | hours / days |
| Escalation chain | L1/L2/L3 rows | after_ms + notify_role |
| Outgoing transitions | Clickable list | Click → selects edge |

**Tab 2 — Actions**

| Field | Type |
| :--- | :--- |
| Entry actions | Checklist with add button |
| Exit actions | Checklist with add button |
| Invoked service | Service selector + on_done/on_error targets |

**Tab 3 — Flags**

| Flag | Default |
| :--- | :--- |
| Comments enabled | Off |
| One-tap email approval | Off |
| Vendor reply enabled | Off |
| Lock fields on entry | Off |
| GL suggestion | Off |
| Anomaly detection | Off |

**Tab 4 — XState**

Live read-only JSON preview of compiled XState state config. Updates in real time as fields change. Copy button. No editing — compiled from definition.

---

## 5. Transition Arrow Edge Specification

### Visual Design Rules

```
Bézier curves — curvature 0.4
Stroke width: 1.2px default, 1.8px selected
Arrow colour follows SOURCE node kind — NOT a fixed colour
Arrowhead: small (7px marker), same colour family as stroke
Label: floating pill with solid dark background (#07121e)
  - Hides the edge line behind it
  - Border: 0.6px matching edge colour at 35% opacity
  - Font: 8.5px JetBrains Mono
  - Visible on hover of edge — not always shown
  - Solid background is critical — prevents label/line overlap

Animated dashes for delayed edges (is_delayed: true):
  stroke-dasharray: 5 4
  animation: dash 1.2s linear infinite

Bidirectional pairs: offset +7px and -7px on the off-axis
```

### Arrow Style Options (User Selectable)

Right-click any edge → Style picker appears.

| Style | SVG | When to Use |
| :--- | :--- | :--- |
| Bézier (default) | Smooth organic curve | Most AP transitions |
| Smooth step | Rounded right-angle | Hierarchical layouts |
| Step | Hard right-angle | Technical/ERP flows |
| Straight | Direct line | Simple linear flows |
| Dashed | Dashed Bézier | Optional/conditional paths |
| Animated | Pulsing dot on curve | Simulation mode active |

### Bend and Reshape

Every selected edge shows a circular bend handle at the midpoint.

```
Interaction:
  Select edge → bend handle appears at curve midpoint (8px circle)
  Drag bend handle → curve reshapes in real time
  Edges store cx, cy bend point coordinates
  Double-click edge → resets to auto Bézier

Technical implementation:
  If edge.cx !== null && edge.cy !== null:
    Use quadratic Bézier through the bend point
    M fx,fy Q cp1x,cp1y cx,cy Q cp2x,cp2y tx,ty
  Else:
    Use auto cubic Bézier
    M fx,fy C c1x,c1y c2x,c2y tx,ty

  Bend handle follows cursor in real time during drag
  snapH() called on mouseup — bend position saved to history
  Auto-layout resets all bend handles to null
```

### Double-Click → Transition Editor

Opens in inspector right panel. Two-tab editor for bidirectional arrows.

**Tab A→B (Forward direction)**

| Field | Type |
| :--- | :--- |
| Event type | Dropdown: APPROVE, REJECT, OCR_COMPLETE, SLA_BREACH, TOKEN_APPROVAL |
| Label | Text input |
| Guard condition | Visual builder (field / operator / value) |
| Pre-transition actions | Sync actions checklist |
| Post-commit notifications | Async n8n actions |
| Vendor notification | Toggle |
| Delayed (BullMQ timer) | Toggle + ms input |

**Tab B→A (Return direction)**

Same fields as A→B. Can be left empty — edge becomes one-directional.

**Guard Builder (visual)**

```
┌─────────────────────────────────────────────────────┐
│  ● Visual builder   ○ Expression editor             │
│                                                     │
│  [invoice.total ▼]  [> ▼]  [25000           ]      │
│  [AND ▼]                                            │
│  [invoice.vendor_id ▼]  [is not empty ▼]           │
│  [AND ▼]                                            │
│  [invoice.date ▼]  [is not empty ▼]                │
│                                                     │
│  + Add condition                                    │
│                                                     │
│  Expression preview:                                │
│  invoice.total > 25000                              │
│  AND invoice.vendor_id IS NOT NULL                  │
│  AND invoice.date IS NOT NULL                       │
│                                                     │
│  [Save as reusable guard]                           │
│  Name: [Amount above $25k with required fields  ]   │
└─────────────────────────────────────────────────────┘
```

Available field operators by type:

```
number:   > < >= <= = != is not empty
string:   = != contains starts with is not empty is empty
boolean:  is true is false
date:     before after is not empty
```

Saved guards are stored in `guard_registry` table with a stable UUID. Edges reference the guard by UUID — never by name string. This means renaming a guard never breaks an edge.

---

## 6. Bidirectional Arrows

### Canvas Rendering

```
SINGLE DIRECTION          BIDIRECTIONAL
─────────────────         ────────────────────────────

┌─────────┐               ┌─────────┐
│  BOX A  │               │  BOX A  │
└────┬────┘               └────┬────┘
     │                         │  ▲
     │  (one arrowhead)        │  │  (two arrowheads,
     ▼                         ▼  │   slightly offset)
┌─────────┐               ┌─────────┐
│  BOX B  │               │  BOX B  │
└─────────┘               └─────────┘

label: "approved"         label A→B: "approved"
                          label B→A: "rejected"
                          (each label on its own offset curve)
```

### Technical Implementation

```typescript
// WorkflowTransitionEdge.tsx

// Detect bidirectional pair
const isBidir = allEdges.some(e =>
  e.id !== edge.id &&
  e.source === edge.target &&
  e.target === edge.source
)

// Offset value: +7px for forward, -7px for return
const offset = isBidir ? (isForward ? 7 : -7) : 0

// Apply offset perpendicular to edge direction
// Vertical edge: offset on x-axis
// Horizontal edge: offset on y-axis
```

### Bidirectional Editor — Two Tabs

```
┌────────────────────────────────────────────────────────┐
│  Transition: Pending Approval → Manager                │
│  ──────────────────────────────────────────────────   │
│  [→ A to B]    [← B to A]                             │
│  ══════════════════════════════════════                │
│                                                        │
│  Tab: A → B selected                                   │
│                                                        │
│  Event type:   [ APPROVE ▼ ]                           │
│  Label:        [ approved                           ]  │
│  Condition:    invoice.total <= 25000                  │
│  Trigger:      [ Manual ▼ ]                            │
│  Post-commit:  [✓] email_assignee via n8n              │
│  Priority:     [ 1 ]                                   │
│                                                        │
│                     [Reset]  [Save]                    │
└────────────────────────────────────────────────────────┘
```

### Bidirectional Rendering Rules

| Condition | Visual |
| :--- | :--- |
| Only A→B configured | Single arrowhead pointing B, single curve |
| Only B→A configured | Single arrowhead pointing A, single curve |
| Both configured | Two offset curves, two arrowheads |
| Both animated (simulation) | Both curves show pulsing dot |

---

## 7. Bézier Curves — Bend and Reshape

### The Auto-Bézier Algorithm

```typescript
function calcBezier(edge: WorkflowEdge) {
  const from = getNodeBounds(edge.from_node_id)
  const to   = getNodeBounds(edge.to_node_id)

  // Direction detection — pick handles based on dominant axis
  const dx = to.cx - from.cx
  const dy = to.cy - from.cy
  const isVerticalDominant = Math.abs(dy) > Math.abs(dx) * 0.6

  let fx, fy, tx, ty

  if (isVerticalDominant) {
    // Use top/bottom handles with optional lateral offset
    if (dy > 0) {
      fx = from.b.x + edge.off  // bottom of source
      fy = from.b.y
      tx = to.t.x + edge.off    // top of target
      ty = to.t.y
    } else {
      fx = from.t.x + edge.off  // top of source
      fy = from.t.y
      tx = to.b.x + edge.off    // bottom of target
      ty = to.b.y
    }
  } else {
    // Use left/right handles
    if (dx > 0) {
      fx = from.r.x;  fy = from.r.y + edge.off
      tx = to.l.x;    ty = to.l.y + edge.off
    } else {
      fx = from.l.x;  fy = from.l.y + edge.off
      tx = to.r.x;    ty = to.r.y + edge.off
    }
  }

  // Control points for smooth curve
  const dist = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2)
  const cp = Math.min(dist * 0.42, 88)

  let c1x, c1y, c2x, c2y
  if (isVerticalDominant) {
    const dir = dy > 0 ? 1 : -1
    c1x = fx;       c1y = fy + dir * cp
    c2x = tx;       c2y = ty - dir * cp
  } else {
    const dir = dx > 0 ? 1 : -1
    c1x = fx + dir * cp;  c1y = fy
    c2x = tx - dir * cp;  c2y = ty
  }

  return `M${fx},${fy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`
}
```

### Manual Bend Implementation

```typescript
// When edge.cx and edge.cy are set (user has dragged bend handle)
// Use quadratic Bézier through the user-defined midpoint

function calcBendBezier(edge, fx, fy, tx, ty) {
  const mid = { x: edge.cx, y: edge.cy }

  const cp1x = fx + (mid.x - fx) * 0.7
  const cp1y = fy + (mid.y - fy) * 0.7
  const cp2x = tx + (mid.x - tx) * 0.7
  const cp2y = ty + (mid.y - ty) * 0.7

  return `M${fx},${fy} Q${cp1x},${cp1y} ${mid.x},${mid.y} Q${cp2x},${cp2y} ${tx},${ty}`
}
```

### Bend Handle Component

```typescript
// Shown only when edge is selected
// Positioned at curve midpoint
// Drag → updates edge.cx and edge.cy in real time
// Double-click edge → resets bend (cx = null, cy = null)

function BendHandle({ edgeId, zoomLevel }) {
  const edge = EDGES.find(e => e.id === edgeId)
  const { lx, ly } = calcMidpoint(edge)  // midpoint of current curve

  return (
    <div
      className="bend-handle"
      style={{
        position: 'absolute',
        left: lx * zoomLevel,
        top:  ly * zoomLevel,
        width: 10, height: 10,
        borderRadius: '50%',
        border: '1.5px solid #3b8fff',
        background: 'var(--s1)',
        cursor: 'move',
        transform: 'translate(-50%, -50%)',
      }}
      onMouseDown={startBendDrag}
      onDoubleClick={resetBend}
    />
  )
}
```

---

## 8. Three AI Creation Modes

All three modes produce identical output: a `WorkflowDefinition` JSON saved to PostgreSQL. All three render on the same canvas. The mode is the entry point, not the destination.

### Mode 1 — Dataset + AI Customise (Fastest)

```
Flow:
  Integrator searches 142-record dataset
  → Similarity search via pgvector + qwen2.5:14b
  → Top 3 matches shown with percentage scores
  → Integrator selects closest match
  → AI reads base record + new client requirements
  → AI customises — changes minimum necessary
  → Diff panel shows every change with reasoning
  → Integrator accepts/rejects each change
  → Canvas renders final workflow
  → Save to dataset for future deployments

Time:          5–15 minutes
Quality:       Highest — starts from proven foundation
AI role:       Customise a validated record
Human role:    Review and accept/reject diff items
```

### Mode 2 — Draw from Scratch + AI Assist

```
Flow:
  Integrator opens blank canvas
  → Drags STATE BOX from palette
  → Draws TRANSITION ARROW between boxes
  → AI watches every action and suggests inline
  → AI flags: unreachable states, missing transitions,
    SLA not configured, guard expression errors
  → AI suggestions appear as non-blocking toasts
  → Integrator accepts or ignores each suggestion

Time:          30–60 minutes
Quality:       Fully custom — integrator in control
AI role:       Inline assistant, not the author
Human role:    All topology decisions
```

### Mode 3 — AI Generate from Description (Most Impressive)

```
Flow:
  Integrator types plain English description
  → qwen2.5:14b parses description via Flowise
  → Generates complete WorkflowDefinition JSON
  → ELKjs auto-layout fires automatically
  → Canvas renders with Bézier edges
  → Diff panel shows everything AI created
  → Integrator reviews, adjusts on canvas
  → Activate when ready

Prompt example:
  "Service agreement workflow for a regulated
   financial services firm in Ontario. Three
   approval tiers based on contract value:
   under $50k, $50k–$250k, above $250k.
   Compliance review on all contracts above $100k.
   Automatic expiry notification at 30 and 7 days."

Time:          2–5 minutes to first draft
Quality:       Good starting point — needs review
AI role:       Full generation from description
Human role:    Review and refine
```

### AI Prompt Structure for Mode 3

```javascript
// Flowise two-stage prompt chain

const systemPrompt = `
You are an AP workflow architect for AI Proviso.
Generate a complete WorkflowDefinition JSON matching
this exact schema: ${canonicalSchemaJSON}

RULES:
1. Every id field must be a valid UUID
2. Every guard must be in guard_registry AND referenced
   by UUID on the edge — never inline
3. Initial state must have kind: "initial"
4. Terminal states must have kind: "terminal"
5. Every approval state must have an SLA policy
6. canvas_position y values: initial state at y:50,
   each layer adds 120, multiple nodes in same layer
   spaced 200px apart on x
7. Entry actions on every approval state minimum:
   sendApprovalEmail, generateApprovalToken, startSLATimer

Return ONLY valid JSON. No explanation. No markdown.
`

const response = await callOllama('qwen2.5:14b', systemPrompt, userDescription)
const definition = JSON.parse(response) as WorkflowDefinition
```

---

## 9. Auto Layout — Optimize and Fit

### ELKjs Layered Algorithm

The layout algorithm uses topological sort to determine correct layer positions, then spaces nodes to avoid overlap.

```typescript
// ELK layout configuration for AP workflow
const ELK_OPTIONS = {
  'elk.algorithm':                             'layered',
  'elk.direction':                             'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.nodeNode':                      '60',
  'elk.layered.nodePlacement.strategy':        'BRANDES_KOEPF',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.edgeRouting':                           'ORTHOGONAL',
}
```

### Manual Layout Algorithm (no ELK dependency)

For the standalone canvas demo, a topological sort produces clean results:

```typescript
function runLayout(nodes, edges) {

  // Step 1: topological sort
  const inDegree = {}
  nodes.forEach(n => { inDegree[n.id] = 0 })
  edges.forEach(e => { if (inDegree[e.t] !== undefined) inDegree[e.t]++ })

  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id)
  const order = []
  const layers = {}

  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    edges.filter(e => e.f === id).forEach(e => {
      inDegree[e.t]--
      if (inDegree[e.t] === 0) queue.push(e.t)
    })
  }

  // Step 2: assign layers
  order.forEach(id => {
    const maxPrev = edges
      .filter(e => e.t === id)
      .map(e => layers[e.f] ?? -1)
      .reduce((a, b) => Math.max(a, b), -1)
    layers[id] = maxPrev + 1
  })

  // Step 3: group by layer
  const byLayer = {}
  nodes.forEach(n => {
    const l = layers[n.id] ?? 0
    if (!byLayer[l]) byLayer[l] = []
    byLayer[l].push(n.id)
  })

  // Step 4: position nodes — centred per layer
  const canvasW = 600
  const PAD = { x: 60, y: 50 }
  const NODE = { w: 146 + 48, h: 78 + 110 - 78 }

  Object.keys(byLayer).sort().forEach(layer => {
    const ids = byLayer[layer]
    const totalW = ids.length * NODE.w - 48
    const startX = PAD.x + Math.max(0, (canvasW - totalW) / 2)

    ids.forEach((id, i) => {
      const node = nodes.find(n => n.id === id)
      node.x = Math.round((startX + i * NODE.w) / 12) * 12
      node.y = Math.round((PAD.y + parseInt(layer) * NODE.h) / 12) * 12
    })
  })

  // Reset all manual bend handles after layout
  edges.forEach(e => { e.cx = null; e.cy = null })

  // Fit view after layout
  setTimeout(fitView, 120)
}
```

### Optimize Fit — Precise fitView

```typescript
function fitView() {
  const canvasEl = document.getElementById('canvas-surface')
  const cw = canvasEl.offsetWidth
  const ch = canvasEl.offsetHeight - 26  // minus status bar

  // Find bounding box of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach(n => {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + NODE_W)
    maxY = Math.max(maxY, n.y + NODE_H)
  })

  const padW = maxX - minX + 64
  const padH = maxY - minY + 64

  // Fit zoom level — never exceed 0.96 to keep padding visible
  zoomLevel = Math.min(cw / padW, ch / padH, 0.96)

  // Centre the workflow in the viewport
  canvasInner.style.transform = `scale(${zoomLevel})`
  canvasInner.style.left = Math.max(0, (cw - padW * zoomLevel) / 2 - minX * zoomLevel + 30 * zoomLevel) + 'px'
  canvasInner.style.top  = Math.max(0, (ch - padH * zoomLevel) / 2 - minY * zoomLevel + 30 * zoomLevel) + 'px'

  zoomLabel.textContent = Math.round(zoomLevel * 100) + '%'
}
```

---

## 10. Simulation Mode

### How It Works

```
1. Click [▶ Simulate] in topbar
2. Canvas locks — no drag/edit
3. Current active state glows with kind-colour ring
4. Transition arrows animate when state changes
   (pulsing dot travels along Bézier path)
5. Simulation control panel appears bottom-centre
6. History log shows every transition in sequence
```

### Simulation Control Panel

```
┌──────────────────────────────────────────────────────────┐
│  [▶ Play]  [⏸ Pause]  [⏹ Stop]  [⏭ Step]               │
│                                                          │
│  Speed: [Slow ────●──── Fast]                            │
│                                                          │
│  Current state: PENDING APPROVAL                         │
│                                                          │
│  ─────────────────────────────────────────               │
│  09:14:22  Received → Extracted    OCR_COMPLETE          │
│  09:14:23  Extracted → Matched     conf: 0.94            │
│  09:14:24  Matched → Pending       PO match              │
│  09:14:25  Pending → CFO Approval  $74,200 > $25k        │
└──────────────────────────────────────────────────────────┘
```

### State Colour Codes During Simulation

| State condition | Visual |
| :--- | :--- |
| Currently active | Emerald glow ring + pulsing border |
| Completed | Desaturated, grey fill overlay |
| Error / exception | Crimson glow ring |
| Pending / waiting | Amber pulse animation |
| Not yet reached | Default — no change |

### Animated Edge — CSS Keyframe

```css
/* Flowing dash animation — subtle, not dramatic */
@keyframes flow-dash {
  to { stroke-dashoffset: -20; }
}

.edge-animated {
  stroke-dasharray: 5 4;
  animation: flow-dash 1.2s linear infinite;
}

/* Dot pulse on active transition */
@keyframes dot-travel {
  0%   { offset-distance: 0%; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}

.transition-dot {
  offset-path: path('M...');  /* edge SVG path */
  animation: dot-travel 0.8s ease-in-out;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--edge-colour);
}
```

---

## 11. Real-Time Collaboration

### Stack

```
Yjs             CRDT-based shared data structures
y-websocket     WebSocket transport for Yjs
Liveblocks      Alternative to y-websocket (Pro example uses this)
```

### Shared State

```typescript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const doc = new Y.Doc()
const provider = new WebsocketProvider('wss://your-server', 'workflow-room', doc)

// Shared maps — synced across all clients
const sharedNodes = doc.getMap('nodes')   // node positions + data
const sharedEdges = doc.getMap('edges')   // edge connections + data
const awareness = provider.awareness      // cursor positions, selections
```

### Presence — Each User

```typescript
// Set current user awareness state
awareness.setLocalStateField('user', {
  id:      userId,
  name:    userName,
  color:   userColor,    // unique per user, used for cursor/avatar
  cursor:  null,         // { x, y } canvas position
  selected: null,        // node or edge id currently selected
})

// React to other users' awareness
awareness.on('change', () => {
  const states = Array.from(awareness.getStates().values())
  setOnlineUsers(states.map(s => s.user).filter(Boolean))
})
```

### Presence Indicators on Canvas

```
Node being edited by another user:
  - Coloured border ring (user's colour)
  - Small avatar in top-right corner of node
  - Tooltip: "Sarah is editing this"

Cursor positions:
  - Live cursor for each remote user
  - Labelled with user name
  - Colour matches user's assigned colour

Online user list (top-right of topbar):
  - Avatar stack showing who is online
  - Click avatar → zoom canvas to their current view
```

### Conflict Resolution

| Conflict type | Resolution |
| :--- | :--- |
| Node label / config | Last-write-wins (Yjs default) |
| Node position | Merge by averaging — smooth UX |
| Edge connections | Preserve both, flag for review |
| Guard expressions | Last-write-wins |
| Simultaneous delete + edit | Deletion wins |

### Persistence and Undo

```typescript
// Y.UndoManager — full undo/redo across all clients
const undoManager = new Y.UndoManager([sharedNodes, sharedEdges])

// Ctrl+Z triggers undo for the local user
// Does NOT undo other users' changes
undoManager.undo()
undoManager.redo()

// Auto-save to PostgreSQL every 2 seconds
const debouncedSave = debounce(async () => {
  const snapshot = {
    nodes: Array.from(sharedNodes.values()),
    edges: Array.from(sharedEdges.values()),
    version: currentVersion,
    updated_at: new Date().toISOString(),
  }
  await fetch(`/api/workflows/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(snapshot),
  })
}, 2000)

sharedNodes.observe(debouncedSave)
sharedEdges.observe(debouncedSave)
```

---

## 12. Performance — Optimised Redraw

### Node Memoisation

```typescript
// Every custom node component is wrapped in React.memo
// Prevents re-render of unaffected nodes when one node moves

export const WorkflowStateNode = memo(({ id, data, selected }) => {
  return (
    <div className={`wn ${data.kind} ${selected ? 'sel' : ''}`}>
      {/* node content */}
    </div>
  )
})

// All event handlers use useCallback
const handleDoubleClick = useCallback((e: MouseEvent) => {
  e.stopPropagation()
  openInspector(id)
}, [id])
```

### Zustand Store — Sliced

```typescript
// Split into purpose-specific slices
// Never store derived data

const useWorkflowStore = create(
  temporal(
    (set, get) => ({
      // Nodes slice
      rfNodes: Node<WorkflowNodeData>[],
      updateNodePosition: (id, pos) => set(/* fast path — no isDirty */),
      updateNodeProperties: (id, changes) => set(/* sets isDirty */),

      // Edges slice
      rfEdges: Edge<WorkflowEdgeData>[],
      updateEdgeProperties: (id, changes) => set(/* sets isDirty */),

      // UI slice — never triggers node re-render
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: false,
      inspectorOpen: false,

      // Simulation slice
      simActive: false,
      simCurrentState: null,
      simHistory: [],
    }),
    { limit: 50 }
  )
)

// Key principle:
// updateNodePosition does NOT set isDirty — layout is not logic
// updateNodeProperties DOES set isDirty — logic has changed
```

### Edge Redraw — Only Affected Edges

```typescript
// When a node moves, only recalculate edges connected to that node
function updateAffectedEdges(movedNodeId: string) {
  const affectedEdgeIds = EDGES
    .filter(e => e.f === movedNodeId || e.t === movedNodeId)
    .map(e => e.id)

  affectedEdgeIds.forEach(id => {
    const edge = EDGES.find(e => e.id === id)
    updateEdge(edge)
  })
  // NOT: EDGES.forEach(e => updateEdge(e))
}
```

### Canvas Background — Memoised

```typescript
// Background never changes — render once, never re-render
const CanvasBackground = memo(() => (
  <Background
    variant={BackgroundVariant.Dots}
    gap={24}
    size={1}
    color="rgba(30,47,66,.55)"
  />
))
```

### Performance Targets

```
200+ nodes:    no lag during drag
Edge redraw:   only affected edges, not all edges
Full re-render: never triggered by single node move
Drag operation: 60fps target
Auto-layout:   ELKjs async — does not block UI thread
Collaboration: Yjs CRDT operations — O(1) per update
```

---

## 13. Data Model — Canonical Schema

### WorkflowDefinition

```typescript
interface WorkflowDefinition {
  id:                   string          // UUID — stable forever
  version:              number          // increments on publish only
  tenant_id:            string
  status:               'draft' | 'published' | 'retired'
  name:                 string
  description:          string
  nodes:                WorkflowNode[]
  edges:                WorkflowEdge[]
  guard_registry:       GuardDefinition[]
  approval_matrix:      ApprovalMatrixEntry[]
  sla_policies:         SLAPolicy[]
  escalation_policies:  EscalationPolicy[]
  integration_bindings: IntegrationBinding[]
}
```

### WorkflowNode (State Box)

```typescript
interface WorkflowNode {
  id:               string          // UUID — never rename
  kind:             'state'
  state_kind:       'initial' | 'auto' | 'approval' | 'exception' | 'terminal'
  name:             string
  description:      string
  assignee_role_id: string | null
  sla_policy_id:    string | null
  escalation_id:    string | null
  entry_actions:    ActionRef[]
  exit_actions:     ActionRef[]
  invoked_service:  ServiceRef | null
  behaviour_flags:  BehaviourFlags
  canvas_position:  { x: number; y: number }  // layout only — never in XState
  canvas_bend:      { cx: number | null; cy: number | null }  // bend handle
}
```

### WorkflowEdge (Transition Arrow)

```typescript
interface WorkflowEdge {
  id:                  string       // UUID
  from_node_id:        string       // UUID → WorkflowNode
  to_node_id:          string       // UUID → WorkflowNode
  event_type:          string       // XState event name
  guard_id:            string | null // UUID → guard_registry — NEVER name string
  label:               string
  style:               'bezier' | 'step' | 'smoothstep' | 'straight' | 'dashed'
  pre_actions:         ActionRef[]
  post_notifications:  NotificationRef[]
  is_delayed:          boolean
  delay_ms:            number | null    // BullMQ job delay
  vendor_notify:       boolean
  canvas_offset:       number           // bidirectional offset ±7px
  canvas_cx:           number | null    // bend handle x
  canvas_cy:           number | null    // bend handle y

  // Return direction (B→A) — null = one-directional
  return_event_type:   string | null
  return_guard_id:     string | null
  return_label:        string | null
  return_actions:      ActionRef[]
}
```

### GuardDefinition

```typescript
interface GuardDefinition {
  id:          string       // UUID — referenced by edges
  name:        string
  expression:  string       // e.g. "invoice.total > 25000"
  description: string
  parameters:  GuardParameter[]
}
// Every guard is stored once. Referenced by UUID on multiple edges.
// Renaming a guard never breaks any edge.
```

---

## 14. XState Integration

### The Division — Canvas vs Engine

```
Canvas (react-flow):
  Renders nodes and edges
  Handles drag, drop, selection, inline edit
  Reads from and writes to WorkflowDefinition JSON
  Has zero knowledge of XState
  Has zero knowledge of PostgreSQL

XState (server.mjs → WorkflowEngine.ts):
  Compiles WorkflowDefinition → XState machine
  Runs on backend only — never in browser
  Stateless between requests
  advance() is the ONLY door into workflow state

Rule: XState never touches the canvas.
      The canvas never calls XState directly.
```

### compileWorkflow — Pure Function

```typescript
// WorkflowDefinition → XState machine
// Pure function: no side effects, no DB calls, deterministic

export function compileWorkflow(def: WorkflowDefinition) {
  const states: Record<string, unknown> = {}

  def.nodes.forEach(node => {
    const stateConfig: Record<string, unknown> = {}

    if (node.entry_actions.length > 0) {
      stateConfig.entry = node.entry_actions.map(a => a.action_id)
    }
    if (node.exit_actions.length > 0) {
      stateConfig.exit = node.exit_actions.map(a => a.action_id)
    }
    if (node.invoked_service) {
      stateConfig.invoke = {
        src: node.invoked_service.service_id,
        onDone: { target: node.invoked_service.on_done },
        onError: { target: node.invoked_service.on_error },
      }
    }

    const sla = def.sla_policies.find(s => s.id === node.sla_policy_id)
    if (sla) {
      stateConfig.after = {
        [sla.duration_ms]: { target: findEscalationTarget(def, node) }
      }
    }

    if (node.state_kind === 'terminal') {
      stateConfig.type = 'final'
    }

    // Build transitions from edges
    const outgoing = def.edges.filter(e => e.from_node_id === node.id)
    if (outgoing.length > 0) {
      const on: Record<string, unknown> = {}
      outgoing.forEach(edge => {
        on[edge.event_type] = {
          target: edge.to_node_id,
          guard: edge.guard_id || undefined,  // UUID reference
          actions: edge.pre_actions.map(a => a.action_id),
        }
      })
      stateConfig.on = on
    }

    states[node.id] = stateConfig
  })

  const initialNode = def.nodes.find(n => n.state_kind === 'initial')
  if (!initialNode) throw new Error(`Workflow ${def.id} has no initial state`)

  return createMachine({
    id: def.id,
    initial: initialNode.id,
    states,
  }, {
    guards: buildGuardRegistry(def.guard_registry),
  })
}
```

### 10 Database Stability Rules

```
Rule 1:   PostgreSQL is the only source of truth
Rule 2:   XState is stateless between requests
Rule 3:   State + history + audit in ONE transaction
Rule 4:   n8n fires AFTER PostgreSQL commits — never inside
Rule 5:   AND version = $expected on every UPDATE (optimistic lock)
Rule 6:   Terminal invoices never transition
Rule 7:   FOR UPDATE SKIP LOCKED on every snapshot load
Rule 8:   Timer cancellation in SAME transaction as state exit
Rule 9:   REVOKE DELETE on workflow tables
Rule 10:  All changes through WorkflowEngine.advance() only
```

---

## 15. UI Layout — Three-Panel Design

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOPBAR                                                               │
│  P  AI Proviso  v1.0  Invoice Approval Flow          [◻ ▷ ✓ ↑]      │
├──────────────────────────────────────────────────────────────────────┤
│ LEFT PANEL (244px)  │ CANVAS (flex)                 │ INSPECTOR(268px)│
│                     │                               │                │
│ workflow selector   │ floating command bar          │ chip + name    │
│                     │                               │ sub-title      │
│ ┌──────────────┐    │ dot-grid background            │ tabs: 4        │
│ │ mode tabs    │    │                               │                │
│ ├──────────────┤    │ nodes                         │ form fields    │
│ │ ◫ Dataset   │    │  + state boxes                │ live update    │
│ │ ⊕ Scratch   │    │  + Bézier edges               │ no Save btn    │
│ │ ◈ AI Gen    │    │  + labels                     │                │
│ ├──────────────┤    │  + bend handles               │ diff panel     │
│ │ mode content │    │                               │ when AI active │
│ │  - search    │    │ zoom controls (right)         │                │
│ │  - results   │    │ status bar (bottom)           │ footer: 3 btns │
│ │  - load btn  │    │                               │                │
│ └──────────────┘    │                               │                │
└─────────────────────┴───────────────────────────────┴────────────────┘
```

### Floating Command Bar (Canvas Only)

```
┌───────────────────────────────────────────────────────────────────┐
│  Select   Connect  │  ⊞ Layout   ⤢ Fit  │  9 states  12 tr  │  ↩  ↪  │
└───────────────────────────────────────────────────────────────────┘
         ↕
When node selected:
┌──────────────────────────────────────────────────────────────────────────┐
│  Select   Connect  │  ⊞ Layout   ⤢ Fit  │  9  12 tr  │  ↩  ↪  │  rename  duplicate  delete  │
└──────────────────────────────────────────────────────────────────────────┘
         ↕
When edge selected:
┌────────────────────────────────────────────────────────────────────────┐
│  Select   Connect  │  ⊞ Layout   ⤢ Fit  │  9  12 tr  │  ↩  ↪  │  drag ● to bend  delete  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Implementation Prompts

Paste the project context block before every prompt.

### Project Context Block — Paste Before Every Prompt

```
I am building AI Proviso — an AP automation platform.

Stack: @xyflow/react v12, XState v5 (backend only),
       Zustand + @zustend/temporal, elkjs, PostgreSQL 16,
       n8n 2.22.3 pinned, BullMQ + Redis 7,
       qwen2.5:14b via Ollama, React + Vite, TypeScript,
       Yjs + y-websocket for collaboration.

Core rules:
- react-flow handles all canvas rendering and interaction
- XState runs ONLY on backend — never in the browser
- All canvas state goes through useWorkflowStore only
- n8n fires AFTER PostgreSQL commits — never inside transaction
- Position changes do NOT set isDirty — layout is not logic
- Guard conditions reference guard_registry by UUID — never name strings
- In-flight invoices stay pinned to their workflow version forever
- Two draggable elements only: STATE BOX and TRANSITION ARROW
- All logic lives inside double-click editors — no gateway nodes

Canvas design:
- Node stripe: 2px left accent — the ONLY colour on the card
- Bézier curves: curvature 0.42, drag bend handle to reshape
- Labels: floating pill with solid dark background
- Bidirectional arrows: offset ±7px, two-tab editor
- Snap to grid: 12px
- Auto-layout: topological sort + ELKjs
- Undo/redo: 50 states via @zustend/temporal
```

---

### Prompt 1 — Custom Node Component

```
Using the PROJECT CONTEXT above and React Flow Pro shapes-pro-example as reference:

Create src/components/nodes/WorkflowStateNode.tsx

Requirements:
1. Wrapped in React.memo()
2. Left accent stripe 2px — the ONLY colour (from node state_kind)
3. Four directional handles: hidden at rest, opacity 0.45 on node hover,
   fully visible + scaled 1.5x on handle hover
4. Node card layout:
   Row 1: name (12px 500 weight) + kind pill (top right, ghost style)
   Row 2: state kind label (8px monospace dim)
   Row 3: separator 1px
   Row 4: entry actions preview (8.5px mono muted, first 2 only)
   Row 5: SLA chip (amber, only if sla_policy_id is set)
5. Double-click → calls openInspector(nodeId) — does NOT open modal
6. Inline name editing:
   Double-click name text → input appears
   Enter confirms, ESC cancels, onBlur confirms
   Calls renameNodeInline from useWorkflowStore
7. Hover: translateY(-1px) + border-color change to kind colour at 28% opacity
8. Selected: 1.5px border + 2px kind-coloured shadow ring at 12% opacity

Kind colours:
  initial:   #22c97a  emerald
  auto:      #3b8fff  sapphire
  approval:  #c88c18  amber
  exception: #c43048  crimson
  terminal:  #8060e8  violet

Node background: rgba(10,16,29,.97)
Border default:  1px solid #1e2f42
Border radius:   7px (not 16px — not a toy)

Verify: React.memo() prevents re-render when unrelated node moves
Verify: Handles invisible at rest, visible on hover
Verify: Double-click inline edit works Enter/ESC
```

---

### Prompt 2 — Bézier Edge with Bend Handle

```
Using the PROJECT CONTEXT above:

Create src/components/edges/WorkflowTransitionEdge.tsx

Requirements:
1. Bézier curve using direction-aware handle selection:
   - Vertical dominant (abs dy > abs dx * 0.6): use top/bottom handles
   - Horizontal dominant: use left/right handles
   - Control point distance: min(dist * 0.42, 88)

2. Bidirectional support:
   - Detect reverse edge in edge list
   - If bidirectional: offset source/target by edge.canvas_offset (±7px)
   - Perpendicular to dominant direction

3. Manual bend handle:
   - If edge.canvas_cx !== null: use quadratic Bézier through bend point
   - Bend handle: 10px circle, shows only when edge selected
   - Drag bend handle → updates edge.canvas_cx / canvas_cy in real time
   - Double-click edge → resets bend to null (auto Bézier)
   - After auto-layout: all bend handles reset to null

4. Edge label: floating pill
   - background: rgba(7,12,20,.9) — solid, hides line behind it
   - border: 0.6px matching edge stroke at 35% opacity
   - font: 8.5px JetBrains Mono
   - Visible on edge hover and when edge selected
   - Hidden at rest

5. Stroke: 1.2px default, 1.8px selected
   Animated dashes for delayed edges: stroke-dasharray 5 4 + CSS animation
   Arrow colour follows source node kind

6. Invisible click target: strokeWidth 14, transparent

7. Selected edge: stroke rgba(59,143,255,.8), strokeWidth 1.8

Verify: Auto Bézier smooth in both vertical and horizontal layouts
Verify: Bend handle appears on selection, disappears on deselect
Verify: Drag bend handle reshapes curve in real time
Verify: Double-click edge resets bend
Verify: Bidirectional pair shows two offset curves
```

---

### Prompt 3 — Transition Editor — Two-Tab Bidirectional

```
Using the PROJECT CONTEXT above:

Create src/components/inspector/TransitionPropertiesForm.tsx

This renders inside CanvasInspector when an edge is selected.

Requirements:
1. Two tabs: "A → B" and "B → A"
   - A→B tab always shown
   - B→A tab shows "(empty — one-directional)" if return is null
   - Adding content to B→A makes edge bidirectional

2. Each tab contains:
   - Event type dropdown: APPROVE, REJECT, OCR_COMPLETE,
     SLA_BREACH, TOKEN_APPROVAL, ALWAYS (eventless)
   - Label text input (live preview on canvas label)
   - Guard builder (visual condition builder — see below)
   - Pre-transition actions: checklist, sync
   - Post-commit notifications: checklist, async via n8n
   - Delayed toggle + delay_ms input (BullMQ)
   - Vendor notification toggle

3. Guard builder visual:
   Row: [field dropdown] [operator dropdown] [value input]
   [AND/OR/NOT combinator] between rows
   + Add condition button
   Expression preview (green monospace)
   "Save as reusable guard" button → saves to guard_registry
   UUID reference written to edge.guard_id

4. Available field options:
   invoice.total (number), invoice.vendor_id (string),
   invoice.date (date), invoice.po_exists (boolean),
   invoice.confidence (number), vendor.risk_score (number)

5. Operators by type:
   number:  > < >= <= = != is not empty
   string:  = != contains starts with is not empty is empty
   boolean: is true is false
   date:    before after is not empty

6. Canvas label update: live — label on canvas updates as user types
7. NO Save button — all changes immediate via updateEdgeProperties

8. Curve section (at bottom):
   "Drag ● handle on canvas to reshape this curve"
   "Double-click line to reset to auto"
   If edge.canvas_cx !== null: show "↺ Reset to auto curve" button

Verify: Guard expression preview updates live
Verify: Save as reusable guard creates UUID in guard_registry
Verify: Edge guard_id references UUID not name string
Verify: Both tabs work independently
Verify: Canvas label updates live as label field changes
```

---

### Prompt 4 — Auto Layout + Fit

```
Using the PROJECT CONTEXT above:

Create src/hooks/useAutoLayout.ts

Requirements:
1. Topological sort to determine correct layer per node:
   - Use in-degree calculation
   - Each node's layer = max(predecessor layers) + 1
   - Handle cycles: any unvisited node gets layer 0

2. Group nodes by layer, centre each layer horizontally:
   - Canvas width from canvas element offsetWidth
   - Node spacing: node_width + 48px gap
   - Layer spacing: node_height + 110 - node_height vertical
   - Padding: 60px horizontal, 50px vertical
   - Snap final positions to 12px grid

3. After positioning:
   - Reset ALL edge.canvas_cx and edge.canvas_cy to null
   - Call snapH() to save layout to undo history
   - Call updateEdges() for all edges
   - Call fitView() after 120ms delay

4. fitView() implementation:
   - Calculate bounding box of all nodes
   - Add 64px padding on all sides
   - zoomLevel = min(canvasW / bboxW, canvasH / bboxH, 0.96)
   - Centre workflow in viewport
   - Update zoom label

5. useAutoLayout() returns:
   { runLayout, isRunning }
   isRunning: boolean for loading state in FloatingPill

6. runLayout() does NOT set isDirty — layout is not logic

Verify: Topological sort produces correct layer order for AP flow
Verify: Multiple nodes in same layer are spaced and centred
Verify: isDirty remains false after layout runs
Verify: fitView shows all nodes with padding
Verify: Bend handles reset to null after layout
```

---

### Prompt 5 — Three AI Creation Modes

```
Using the PROJECT CONTEXT above:

Create src/components/designer/ModePanel.tsx
and src/api/aiModes.ts

The left panel shows three tabs: Dataset · Scratch · AI Gen
Each tab shows different content. Switching is instant.

DATASET TAB:
1. Search input (searches 142-record dataset)
2. Filter chips: All, AP, SAP, Ontario, Manufacturing (toggle)
3. Results list — each record card shows:
   - Similarity percentage (colour coded: green >85%, amber >65%, grey below)
   - Workflow name
   - Industry, region, ERP, states count, touchless rate
   - Tag pills (AP, SAP, etc)
   - Left accent appears on hover and selection
4. Select record → Load button activates
5. Load button → spinner + "calling qwen2.5:14b..." status
6. On completion:
   - Button turns green "✓ loaded · N AI changes"
   - Diff panel appears in inspector bottom
   - Canvas loads AI-customised definition

SCRATCH TAB:
1. Brief description: "Drag states to canvas. AI assists as you build."
2. Collapsible palette groups: AP States, Approval Tiers, Outcomes
3. Each item: coloured dot + name + description
4. Drag to canvas → node created at drop position
5. AI inline suggestion fires after each add (non-blocking toast)

AI GEN TAB:
1. Textarea: "Describe your workflow..."
2. Three clickable example hints (populate textarea on click)
3. Generate button: gradient blue→violet
4. Options chips: use dataset, explain decisions, auto-layout
5. Workflow type chips: Invoice AP, Service Agreement, NDA, Expense
6. ERP target chips: SAP S/4HANA, SAP ECC, Dynamics 365, NetSuite
7. Generate → spinner → canvas renders → diff panel shown

DIFF PANEL (shown in inspector when AI active):
1. Header: "AI changes — N to review"
2. Each change item:
   - Type badge: modified / added / removed (ghost border style)
   - Change description: "Pending Approval · SLA 4h → 6h"
   - Reason: "client policy requires 6h SLA"
   - ✓ Accept and ✕ Reject buttons per item
3. Footer: [Reject all] [✓ Accept all]

Verify: Dataset tab shows search and filter working
Verify: Load button shows spinner during AI call
Verify: Diff panel renders 4 items correctly
Verify: Accept/reject per item works
Verify: AI Gen textarea populated by hint click
```

---

### Prompt 6 — Collaboration (Yjs)

```
Using the PROJECT CONTEXT above:

Implement real-time collaboration using Yjs + y-websocket.
Reference: React Flow Pro collaborative-pro-example.

Requirements:
1. Shared Y.Doc with two Y.Maps:
   - sharedNodes: synced node positions and data
   - sharedEdges: synced edge connections and data

2. Each user gets:
   - Unique userId (UUID generated on session start)
   - Display name (from user profile)
   - Colour (deterministic from userId, 6 distinct colours)

3. Awareness — broadcast per user:
   { userId, name, color, cursor: {x,y} | null, selectedId: string | null }

4. Render other users' cursors on canvas:
   - Label with user name
   - Coloured dot cursor
   - Smooth position updates (lerp 150ms)

5. Render other users' node selections:
   - Coloured border ring on selected node (user's colour)
   - Small avatar in top-right corner of node
   - Tooltip: "[name] is here"

6. Online user list in topbar:
   - Avatar stack (stacked circles, each user's colour)
   - Max 5 shown, "+N" overflow
   - Tooltip on hover shows name

7. Conflict resolution:
   - Node positions: Y.Map merge (last-write-wins)
   - Node data: last-write-wins
   - Edge data: last-write-wins

8. Auto-save:
   - Debounced 2000ms after any Y.Doc change
   - POST to /api/workflows/:id with full snapshot
   - Y.UndoManager for local undo (does not affect others)

Verify: Two browser tabs show same workflow state
Verify: Moving node in tab A appears in tab B within 100ms
Verify: User cursor visible in both tabs
Verify: Node selection indicator shows other user's colour
Verify: Undo in tab A does not affect tab B
```

---

### Prompt 7 — Simulation Mode

```
Using the PROJECT CONTEXT above:

Add simulation mode to the workflow designer.

Requirements:
1. [▶ Simulate] button in topbar activates simulation mode:
   - Canvas becomes read-only (no drag, no edit)
   - All node hover effects disabled
   - Command bar replaced with simulation controls

2. Simulation control panel (bottom-centre, slides up):
   [▶ Play] [⏸ Pause] [⏹ Stop] [⏭ Step]
   Speed slider: Slow (2s/step) → Normal (0.8s) → Fast (0.2s)
   Current state indicator (large, prominent)
   Scrollable transition history log

3. Active state visual:
   - Glow ring in state's kind colour
   - Subtle pulsing border animation
   - "Active" label appears

4. Transition animation (when state changes):
   - Animated dot travels along Bézier edge path
   - Duration: matches current speed setting
   - Edge stroke briefly brightens then returns to normal
   - Next state receives active glow

5. State colour codes:
   - Active:    kind-colour glow + pulse
   - Completed: opacity 0.45, grey fill overlay
   - Error:     crimson glow
   - Pending:   amber pulse
   - Not yet:   default

6. History log entry format:
   HH:MM:SS  FromState → ToState    event_type

7. [⏹ Stop] returns canvas to edit mode, all nodes reset to default

Verify: Canvas locks during simulation (no drag)
Verify: Dot animates along correct edge path
Verify: Completed nodes show grey overlay
Verify: History log scrolls as entries accumulate
Verify: Stop returns to normal edit mode
```

---

## 17. React Flow Pro Examples — Integration Order

### Start Here — Day 1

Clone the `shapes-pro-example` as the base project. Do not start from scratch.

```bash
# From Pro examples pack
cp -r shapes-pro-example/ proviso-canvas/
cd proviso-canvas
npm install
npm run dev
```

Replace the example's node components with `WorkflowStateNode`. Replace the example's edge with `WorkflowTransitionEdge`. The canvas infrastructure — drag-drop, zoom, pan, grid, minimap, controls — is already working.

### Merge Order

```
Day 1:  shapes-pro-example                  ← base project
Day 1:  remove-attribution-pro-example      ← clean UI immediately
Day 2:  editable-edge-pro-example           ← double-click editor pattern
Day 3:  helper-lines-pro-example            ← 12px snap grid
Day 4:  undo-redo-pro-example               ← Ctrl+Z / Ctrl+Y
Day 5:  auto-layout-pro-example             ← ELKjs integration
Day 5:  libavoid-edge-routing               ← arrows route around nodes
Day 6:  dynamic-layouting-pro-example       ← optimised redraw
Day 7:  node-position-animation-pro-example ← smooth simulation moves
Day 8:  copy-paste-pro-example              ← duplicate on right-click
Day 9:  selection-grouping-pro-example      ← group AP sub-processes
Day 10: expand-collapse-pro-example         ← sub-workflow collapse
Day 11: collaborative-pro-example           ← Harry + Philippe live
Day 12: server-side-image-creation          ← PNG/SVG export
```

---

## 18. Verification Checklist

### Canvas Interactions

```
□ Drag STATE BOX from palette → node appears at cursor position
□ Node snaps to 12px grid on drop
□ Double-click node name → inline edit appears
□ Enter confirms name → card and inspector update live
□ ESC cancels → original name restored
□ Drag TRANSITION ARROW → enters connect mode
□ Click target node → edge created with Bézier curve
□ Edge colour matches source node kind
□ Delayed edge shows animated dashes
□ Click edge → floating pill shows "drag ● to bend" + delete
□ Drag bend handle → curve reshapes in real time
□ Double-click edge → resets bend to auto Bézier
□ Bidirectional pair → two offset curves, two arrowheads
□ Edge label shows on hover, solid background hides line
□ Delete key on selected node → node + connected edges removed
□ Delete key on selected edge → edge removed
□ Ctrl+Z → undoes last action (50 states)
□ Ctrl+Y → redoes
□ Multi-select (shift+click) works
□ Right-click → context menu with Duplicate, Delete, Edit
```

### Auto Layout

```
□ Layout button → topological sort assigns correct layers
□ Initial state at top, terminal at bottom
□ Multiple nodes in same layer are centred and spaced
□ All manual bend handles reset to null after layout
□ fitView shows all nodes with padding
□ isDirty remains false after layout
□ No edge crossing where avoidable
```

### Inspector

```
□ Click node → inspector slides in, chip shows "state"
□ Click edge → inspector switches to transition form
□ Click canvas → inspector slides out
□ Name change in inspector updates canvas card live
□ Kind change updates accent stripe colour immediately
□ No Save button — all changes immediate
□ Four tabs work: Basic · Actions · Flags · XState
□ XState JSON preview updates live
□ Guard builder expression preview updates live
□ Save as reusable guard → guard_registry updated
□ Edge guard_id shows UUID not name
```

### AI Modes

```
□ Dataset search returns filtered results
□ Similarity percentages show correctly
□ Select record → Load button activates
□ Load → spinner → diff panel appears
□ Diff panel shows 4 items with reasons
□ Accept item → fades to 25% opacity, pointer-events none
□ Reject item → removed from list
□ Accept all → panel closes
□ Scratch palette: drag item to canvas → node created
□ AI Gen: click hint → textarea populated
□ AI Gen: Generate → spinner → success state
```

### Collaboration

```
□ Two browser tabs show same workflow state
□ Node move in tab A appears in tab B within 100ms
□ User cursor visible across tabs
□ Node selection shows other user's colour ring
□ Undo in one tab does not affect other tab
□ Auto-save fires 2 seconds after last change
```

---

## 19. Delivery Timeline — 12 Days

| Day | Focus | Deliverable |
| :- | :--- | :--- |
| 1 | Base setup | shapes-pro-example cloned, WorkflowStateNode renders |
| 2 | Edge editor | WorkflowTransitionEdge with Bézier + bend handle |
| 3 | Inspector | TransitionPropertiesForm two-tab bidirectional |
| 4 | State form | StatePropertiesForm four tabs, live mutations |
| 5 | Layout | ELKjs auto-layout + fitView + undo-redo |
| 6 | Performance | Memoisation, store slicing, optimised redraw |
| 7 | AI modes | Dataset tab + Mode 3 AI generate |
| 8 | Diff review | Diff panel + accept/reject per item |
| 9 | Simulation | Simulation mode + dot animation |
| 10 | Collaboration | Yjs + presence cursors + avatar stack |
| 11 | Export | PNG/SVG server-side image creation |
| 12 | Polish | 12px grid, copy-paste, selection grouping, demo prep |

---

**Day 12 complete = world-class AP workflow designer**  
**Two draggable elements. Infinite workflow combinations.**  
**All logic behind double-click. AI in all three creation modes.**  
**Bézier curves you can bend. Layout that optimises and fits.**  
**Real-time collaboration. Simulation with animated edges.**  
**Beats M-Files on every dimension.**

---

*AI Proviso · Integrator Workspace · PDR v2.0*  
*scriptdotnet · Xerox Canada · May 2026*  
*React Flow Pro + XState v5 + qwen2.5:14b + PostgreSQL 16*  
*The workflow designer M-Files consultants have always needed*

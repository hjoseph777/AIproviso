# AI Proviso Workflow Designer — Feature Catalog & Pro Upgrade Status

## Companion to PRD v10 · Updated 2026-05-29

---

## Document Metadata

| Field | Detail |
| :--- | :--- |
| **Product** | AI Proviso — AP-First Automation Platform |
| **Document Type** | Workflow Designer Feature Companion |
| **Classification** | Internal — Confidential |
| **Author** | Harry Joseph / scriptdotnet — Xerox Canada |
| **Parent PRD** | PRD v10.0 |
| **Purpose** | Formalise the official workflow designer capability set, Pro upgrade plan, and collaboration |
| **Deployment Baseline** | Docker Compose (local and integration) |
| **Enterprise Scale Path** | Kubernetes (AKS or equivalent managed Kubernetes) |

---

## 1. Scope

This document does not replace the architecture, module boundaries, or governance rules defined in PRD v10. It formalises the official feature offer for the workflow designer and clarifies the React Flow Pro upgrade path and collaboration strategy.

Locked implementation decisions for this release:

1. Direct integration path in main app module (no standalone-first track). ✅ Done
2. Collaboration enabled now in the active implementation stream. ✅ Done (BroadcastChannel baseline)
3. Canonical package policy: `@xyflow/react` only. ✅ Done
4. Day-1 must-pass gate: palette drag/drop + custom node + custom edge + live inspector + undo/redo. ✅ Done
5. Persistence remains local until workflow UX sign-off, then backend save/load integration begins. ✅ Active

---

## 2. Canonical Stack (Single Source of Truth)

| Layer | Standard | Status |
| :--- | :--- | :--- |
| UI Framework | React 18 | ✅ Live |
| Canvas Engine | `@xyflow/react` v12.9 (React Flow Pro baseline) | ✅ Live |
| Edge Utilities | `getBezierPath`, `EdgeLabelRenderer`, `BaseEdge` from `@xyflow/react` | ✅ Live |
| Pro Node Components | `NodeResizer`, `NodeToolbar` from `@xyflow/react` | ✅ Live (CSS fix needed) |
| Layout | `elkjs` v0.11 — ELK layered SPLINES layout | ✅ Live |
| State Store | `useWorkflowStore` (Zustand 5) | ✅ Live |
| History / Undo-Redo | Custom 50-deep stack in Zustand store | ✅ Live |
| Runtime Compiler | XState 5 (compile-on-demand) | ✅ Live |
| Collaboration — Local | Browser `BroadcastChannel` API (cross-tab same-origin) | ✅ Live |
| Collaboration — Network | Liveblocks or Partykit (planned, not yet wired) | 🔲 Planned |
| Styling | CSS-in-JS / CSS modules (no Tailwind — Tailwind not installed) | ⚠️ NodeToolbar needs fix |

---

## 3. React Flow Pro — What's In the Box

React Flow Pro (`@xyflow/react` v12) is the package already installed. It includes:

| Pro Feature | In Our Implementation | Notes |
| :--- | :--- | :--- |
| Core canvas v12 | ✅ Active | `@xyflow/react` |
| `NodeResizer` | ✅ Active | Resize handles on selected nodes |
| `NodeToolbar` | ✅ Active | Focus / Duplicate / Delete on selected nodes — needs CSS fix |
| Interactive MiniMap | ✅ Active | z-index 30, pannable, zoomable, 210×158 |
| `getBezierPath` | ✅ Active | curvature 0.4, directional source/target |
| `EdgeLabelRenderer` | ✅ Active | Floating pill labels |
| `BaseEdge` | ✅ Active | Visual path |
| Pro examples repo | 🔲 Reference only | Workflow builder example is reference material |
| Commercial license | ℹ️ Pending | Subscribe before production |

Pro examples not adopted as direct starting points — the AP domain canvas was built custom on top of v12. The Pro workflow builder example remains useful as a reference for patterns we haven't yet implemented (snap-to-grid, connection validation, etc.).

---

## 4. Official Feature Catalog — Current Status

| Feature Area | Feature | Status |
| :--- | :--- | :--- |
| **Canvas Core** | React Flow Pro foundation (`@xyflow/react` v12) | ✅ Live |
| **Canvas Core** | Drag/drop node creation from palette | ✅ Live |
| **Canvas Core** | Double-click quick node creation | ✅ Live |
| **Canvas Core** | Zoom, pan, minimap, controls | ✅ Live |
| **Canvas Core** | Snap-to-grid + guided alignment | 🔲 Not yet |
| **Canvas Core** | Bootstrap layout on workspace switch | ✅ Live |
| **Canvas Core** | ELK pre-load on mount (eliminates first-run delay) | ✅ Live |
| **Nodes** | AP domain node cards — 6 state kinds | ✅ Live |
| **Nodes** | `NodeResizer` — resize any node | ✅ Live |
| **Nodes** | `NodeToolbar` — contextual actions (Focus/Duplicate/Delete) | ✅ Live (CSS fix needed) |
| **Nodes** | Linter badges (⚠ No Exit / ⚠ Unreachable) | ✅ Live |
| **Nodes** | Path-highlighting (hover dims unrelated nodes) | ✅ Live |
| **Nodes** | Remote-presence avatars (coloured initials badges) | ✅ Live |
| **Edges** | Bézier edges — `getBezierPath` curvature 0.4 | ✅ Live |
| **Edges** | Directional source/target positions (bottom→top flow) | ✅ Live |
| **Edges** | Semantic colour routing (approve/reject/escalate/review/complete) | ✅ Live |
| **Edges** | Pill labels with solid background, inline editing | ✅ Live |
| **Edges** | 16px transparent hit-area for easy clicking | ✅ Live |
| **Edges** | Animated dashes for delayed transitions | ✅ Live |
| **Edges** | Remote-presence edge colouring (collaborator hue) | ✅ Live |
| **Layout** | ELK auto-layout — Layout button | ✅ Live |
| **Layout** | ✨ Optimize Paths (ELK re-run with visual feedback) | ✅ Live |
| **Layout** | AP lane map (topology-aware state placement) | ✅ Live |
| **Layout** | Exception column staggered between main flow layers | ✅ Live |
| **State** | Zustand store — full CRUD + 50-deep undo/redo | ✅ Live |
| **State** | Collaborative snapshot broadcast | ✅ Live |
| **Inspector** | Right-panel live property editor (node + edge) | ✅ Live |
| **Inspector** | XState-powered tab/mode state machine | ✅ Live |
| **Toolbar** | Lock/Unlock canvas | ✅ Live |
| **Toolbar** | State bar (lock/unlock guidance + optimising feedback) | ✅ Live |
| **Context Menu** | Right-click node/edge/canvas | ✅ Live |
| **Collaboration** | BroadcastChannel cross-tab sync (same machine) | ✅ Live |
| **Collaboration** | Session ID namespacing | ✅ Live |
| **Collaboration** | Presence pings on selection change | ✅ Live |
| **Collaboration** | Remote-user presence on nodes + edges | ✅ Live |
| **Collaboration** | Network-peer collaboration (Liveblocks / Partykit) | 🔲 Planned |
| **AI Authoring** | Mode 1: AI customisation from validated dataset | 🔲 Planned |
| **AI Authoring** | Mode 2: AI-assisted authoring on blank canvas | 🔲 Planned |
| **AI Authoring** | Mode 3: Full AI generation from scenario prompt | 🔲 Planned |
| **Governance** | Diff review gate before activation | 🔲 Planned |
| **Governance** | RBAC — permission-scoped actions | ✅ Architecture ready |
| **Overlays** | Business / Runtime / Target view modes | ✅ Live |
| **Persistence** | Backend save/load | 🔲 Deferred (awaiting UX sign-off) |

---

## 5. Collaboration Strategy

### Current Implementation (Live)
Collaboration is implemented using the browser's native **`BroadcastChannel` API**. This is:
- Zero-dependency (no server, no third-party service)
- Cross-tab on the same machine / same origin
- Sufficient for single-workstation pair-design sessions and demos

How it works:
1. Both users open the app in separate tabs and enter the same Session ID
2. Any workflow change broadcasts a snapshot to all other tabs in the session
3. Presence pings fire on every selection change, showing coloured avatar badges on nodes/edges

### Planned Upgrade (Network Collaboration)
For real-time cross-network collaboration (multiple machines), the plan is to integrate either:
- **Liveblocks** (the option shown in React Flow Pro examples) — managed CRDT/presence service
- **Partykit** — open-source alternative

The `CanvasSurface` collaboration scaffolding (session IDs, presence state, snapshot broadcast) is already designed to be swapped from `BroadcastChannel` to a WebSocket-backed provider with minimal changes.

---

## 6. Known Issues To Fix

| Issue | Priority | Root Cause |
| :--- | :--- | :--- |
| Canvas nodes overlap (cramped) | 🔴 Critical | `laneGapX = 180 < nodeWidth = 220` — Manager/CFO branches physically overlap spine column. Fix: `laneGapX ≥ 300` |
| `NodeToolbar` renders unstyled | 🟠 High | Uses Tailwind class names (`"flex items-center..."`) but Tailwind is not installed. Fix: replace with inline styles matching the app's dark theme |
| `SmartWorkflowEdge.jsx` dead file | 🟡 Low | Not registered anywhere. Safe to delete |
| `BezierTransitionEdge.jsx` is just a re-export | 🟡 Low | One-line shim file. Can merge into `InteractiveBezierEdge` or remove the indirection |
| Snap-to-grid not implemented | 🟡 Medium | Listed as Official in feature catalog but not built |
| Network collaboration not wired | 🟡 Medium | BroadcastChannel is local-only |

---

## 7. Acceptance Criteria

Feature catalog acceptance is complete when:
- All 🔴 Critical issues are resolved
- NodeToolbar renders correctly in the dark canvas theme
- Canvas is not cramped: no node overlaps at default layout
- `workflowDesignerFeature.md` and `SKILLS.md` expose the same feature inventory
- Collaboration is accurately described as BroadcastChannel (local) with Liveblocks (network) planned

---

AI Proviso · Xerox · 2026

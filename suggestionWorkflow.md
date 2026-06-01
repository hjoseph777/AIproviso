# Provisio GUI Suggestion Workflow (No Rewrite)

## Goal
Stabilize and polish the current GUI without a from-scratch rebuild.

## Strategy
- Keep existing product behavior and React Flow interaction model.
- Improve maintainability first, then visual consistency, then speed of iteration.
- Work in small batches with build verification after each batch.

## Priority Order
1. Styling architecture cleanup
2. Shell responsibility split
3. Interaction consistency pass
4. Runtime regression guardrails
5. Incremental UX polish

## Phase 1: Styling Architecture Cleanup (High ROI, Low Risk)
### Why
Current styling is concentrated in a large inline/global structure, which slows safe UI changes.

### Tasks
- Move global visual tokens to a central stylesheet layer.
- Introduce semantic variables (surface, border, accent, warning, success, text tiers).
- Keep component-level styles scoped to each module.
- Remove duplicated style declarations and one-off values.

### Deliverables
- Centralized token map
- Reduced style duplication
- Clear separation between app-wide and component-local styles

### Exit Criteria
- Visual output unchanged or improved
- Build passes
- No regressions in shell/canvas layout

## Phase 2: Shell Responsibility Split
### Why
The shell currently carries orchestration plus rendering concerns, increasing change risk.

### Tasks
- Separate orchestration logic from presentational layout sections.
- Extract sections into focused units (top bar, canvas frame, side panels, footer/status).
- Keep behavior and APIs stable while refactoring boundaries.

### Deliverables
- Smaller shell files/functions
- Clear component boundaries
- Easier testability and maintenance

### Exit Criteria
- Same behavior for bootstrap/save/publish/view switching
- Build passes
- No keyboard/canvas regressions

## Phase 3: Interaction Consistency Pass
### Why
Enterprise feel comes from consistent states more than adding new features.

### Tasks
- Standardize visual states across all panes: hover, selected, focused, invalid, dirty, disabled, collaborative.
- Align spacing, typography scale, and badge language.
- Normalize empty/loading/error states.

### Deliverables
- Interaction state guideline table
- Unified behavior for selection/focus cues

### Exit Criteria
- Visual consistency across canvas, inspector, and side panels
- No ambiguous state cues

## Phase 4: Runtime Regression Guardrails
### Why
Recent runtime issues show the need for explicit safety checks.

### Tasks
- Add smoke checks for core flows:
  - Designer boot
  - Node select/edit
  - Keyboard shortcuts
  - Save/publish
  - Canvas drag/drop/connect
- Add a lightweight pre-merge checklist.

### Deliverables
- Smoke test script/checklist
- Known-good verification path after refactors

### Exit Criteria
- Core workflow passes consistently after each change batch

## Phase 5: Incremental UX Polish
### Why
After architecture cleanup, polish becomes safe and fast.

### Tasks
- Improve information hierarchy in shell panels.
- Tighten microcopy for actions, warnings, and status signals.
- Improve responsive behavior for narrower widths.

### Deliverables
- Cleaner shell readability
- Reduced cognitive load in dense screens

### Exit Criteria
- Faster operator navigation
- Fewer clicks to key actions

## Suggested Execution Cadence
- Batch size: 1 logical objective per PR
- Validation cadence:
  - Run build after each batch
  - Run smoke checks after each phase
- Rollback rule:
  - If a refactor risks behavior, stop and ship behind a guarded toggle

## Suggested Definition of Done (Per Phase)
- Behavior unchanged unless intentionally improved
- Build is green
- No new console/runtime errors in core designer flows
- Change notes updated with scope and risk

## Immediate Next 3 Batches
1. Extract design tokens and normalize style variables
2. Split shell into orchestration + presentational layout sections
3. Add smoke checks for boot/select/edit/save/publish/connect flows

## Outcome Target
Within these phases, the product keeps its current momentum and feature depth while becoming significantly easier to maintain, safer to evolve, and more enterprise-ready in presentation.
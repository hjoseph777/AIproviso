# AI Proviso Change Blueprint
## Zero-Code Modification Plan Against PRD V4

---

## 1. Purpose

This document explains how to evolve the existing AIproviso application into the AP-first AI Proviso platform defined in Proviso_PRD_v4.md.

This is intentionally a modification-first blueprint.
It does not assume a rewrite.
It does not start from scratch.
It identifies:
- what already exists and should be preserved,
- what existing files should be extended,
- what should be refactored later,
- what gaps remain against PRD V4,
- the minimum modification path per file.

---

## 2. Current Product Baseline

The current repository already provides a strong foundation in these areas:
- Desktop shell via Electron
- Rich React-based workflow editor
- Zustand state store for workflow entities
- Zod workflow integrity validation
- Import and export flows
- M-Files vault bridge via PowerShell and Electron IPC
- Diagram visualization and interactive workflow editing

This means the current product is not a throwaway prototype.
It is an early workflow platform that can be redirected toward AP automation.

---

## 3. Architectural Decision

### Decision
Preserve the current Electron + React application as the main client shell and extend it into an AP platform incrementally.

### Why
- The current UX already supports spreadsheet-style editing, workflow modeling, and guided interactions.
- The current desktop shell already solves native file save, IPC, and Windows-first execution.
- The current state model already represents workflow states and transitions.
- The current M-Files bridge proves the application already knows how to orchestrate external enterprise systems.

### What not to do
- Do not replace the frontend before extracting more value from it.
- Do not rewrite the workflow builder to fit AP.
- Do not force all backend changes into a new service layer on day one.

### Recommended approach
- Keep current client shell.
- Expand domain model.
- Introduce AP modules beside existing workflow features.
- Add n8n and ERP orchestration through new integration contracts.
- Decrease M-Files centrality over time instead of removing it immediately.

---

## 4. Gap Summary Against PRD V4

### Already Present in Some Form
- Workflow modeling
- State transitions
- Validation framework
- Desktop delivery
- Import/export patterns
- Spreadsheet-like editing behavior
- External integration bridge

### Missing or Only Partially Present
- AP document model
- Vendor account number logic
- Invoice intake and OCR pipeline
- Matching engine
- Exception queues and pending routing
- Bidirectional n8n orchestration
- ERP posting and reconciliation model
- Audit model for AP transactions
- Drag-and-drop form builder
- Drag-and-drop menu/app builder
- Spreadsheet-style invoice workbench with strict workflow integrity
- Role and segregation-of-duties enforcement

---

## 5. File-by-File Change Blueprint

## 5.1 Core Frontend Shell

### File
src/App.jsx

### Current Role
- Global shell styling
- Global visual theme
- Mounts CommandCenter and CommandPalette

### Keep
- Overall app shell
- Existing visual hierarchy
- Desktop-oriented layout approach

### Minimum Modifications Needed
- Rebrand from workflow-ingestion emphasis to AP operations emphasis.
- Add visual tokens for AP statuses such as pending, exception, approved, reconciled.
- Preserve current shell layout but support additional workspace modes:
  - Workflow Designer
  - Invoice Workbench
  - Exception Control Tower
  - Integration Monitor
- Avoid major CSS replacement early.
- Refactor CSS only after AP modules are stable.

### Recommendation
Treat this file as presentation infrastructure, not business logic.
Do not overload it further with AP behavior.

---

### File
src/components/CommandCenter.jsx

### Current Role
- Main application surface
- Workflow builder UI
- Parsing modes
- Diagram interaction
- M-Files sync surface

### Keep
- Core interaction model
- Multi-panel layout
- Sectioned editing experience
- Mermaid-based workflow visualization
- Existing import/export interaction concepts

### Minimum Modifications Needed
- Split the current monolithic component into feature panels without changing the shell behavior immediately.
- Add top-level product modes for:
  - Workflow Designer
  - AP Intake
  - Invoice Queue
  - Exceptions
  - Integrations
- Reuse the current left-grid editing pattern for invoice queue and exception triage.
- Reuse the center pane for workflow visualization, queue dashboards, and trace/simulation views.
- Replace M-Files-first wording in the right pane with integration-agnostic wording.
- Keep M-Files as a connector mode, not the primary product identity.
- Add placeholders for future n8n and ERP run status in the current delivery/sync panel.

### High-Risk Area
This file is already large and multi-purpose.
It should be the first major refactor target before adding heavy AP logic.

### Recommended Refactor Direction
Extract subcomponents for:
- Workflow editor grid
- Workflow diagram canvas
- Sync panel
- AP queue panel
- Exception panel
- Integration panel

---

### File
src/components/CommandPalette.jsx

### Current Role
- Search and quick actions for workflows and states

### Keep
- Command palette pattern
- Keyboard-first navigation model

### Minimum Modifications Needed
- Expand search targets to include invoices, vendors, queues, exceptions, and integration runs.
- Add quick actions for:
  - Create invoice queue filter
  - Open exception queue
  - Re-run reconciliation
  - Open workflow trace
  - Start intake import
- Remove direct dependence on exportJSON from store shape assumptions.

### Recommendation
Convert this into the universal operations palette for AP users and admins.

---

## 5.2 State and Domain Modeling

### File
src/store/useWorkflowStore.js

### Current Role
- Central state container
- Workflow CRUD
- State CRUD
- Transition CRUD
- Global users, properties, and rules
- Workflow import/export support

### Keep
- Zustand as the state layer
- Existing workflow slice concepts
- Import and active-tab behavior
- Referential updates for state rename and transition integrity

### Minimum Modifications Needed
Expand the store from a single workflow-centric model into domain slices.

#### Recommended New Slices Inside Existing Store First
- workflowSlice
- invoiceSlice
- vendorSlice
- exceptionSlice
- integrationSlice
- uiSlice

#### New Domain Entities to Add
- invoices
- vendors
- purchaseOrders
- receipts
- approvalTasks
- exceptionCases
- reconciliationJobs
- auditEvents

#### New State Needed
- queue definitions and queue ownership
- SLA timers
- exception reasons
- confidence thresholds
- vendor match candidates
- ERP sync status
- n8n execution status
- workbench selection and filters

#### Integrity Rules to Add
- invoice status cannot jump across invalid workflow states
- editing permissions must depend on invoice state and role
- posting eligibility must be computed from policy checks
- bulk actions must route through same validations as single edits

### Recommendation
Do not create a completely new store immediately.
First evolve this store into grouped slices while preserving current consumers.
Only split into multiple files after the AP model stabilizes.

---

## 5.3 Validation and Workflow Integrity

### File
src/validation/schema.js

### Current Role
- Workflow validation using Zod
- Initial state rules
- Transition integrity
- Duplicate transition detection

### Keep
- Zod validation approach
- Cross-field validation style
- Separation between primitive schemas and refinement rules

### Minimum Modifications Needed
Extend validation beyond workflow structure into AP policy validation.

#### Add New Schemas
- VendorSchema
- InvoiceSchema
- PurchaseOrderSchema
- ReceiptSchema
- ExceptionCaseSchema
- ApprovalTaskSchema
- ReconciliationSchema

#### Add New Validation Layers
- required AP field validation
- vendor match confidence validation
- missing PO routing validation
- duplicate invoice validation
- approval policy validation
- posting eligibility validation
- bulk edit validation
- spreadsheet conflict validation

#### Add New Validation Outputs
- fieldErrors
- queueRoutingDecision
- policyViolations
- blockingIssues
- warningIssues
- requiredReviewFlags

### Recommendation
This file should become the enforcement core for workflow integrity across the AP platform.
Use it as the first-class rules engine boundary before adding UI complexity.

---

## 5.4 Import, Export, and Payload Contracts

### File
src/hooks/useExport.js

### Current Role
- Serializes workflow payloads for M-Files-oriented export

### Keep
- Export contract pattern
- Metadata envelope approach

### Minimum Modifications Needed
Move from one export path to multiple canonical payload types.

#### Required Export Modes
- workflow-definition export
- AP configuration export
- invoice queue export
- audit export
- integration package export

#### Current Assumption to Remove
- Export is currently centered on M-Files COM consumption.
- That must become one connector output, not the core payload model.

#### New Canonical Payload Shapes Needed
- workflowDefinition
- invoiceRecord
- exceptionRecord
- integrationEvent
- postingJob
- reconciliationResult

### Recommendation
Keep this hook, but reposition it around AI Proviso canonical data first and connector-specific transforms second.

---

## 5.5 Diagram and Workflow Modeling

### File
src/hooks/useMermaid.js

### Current Role
- Workflow-to-diagram conversion

### Keep
- Mermaid rendering strategy
- Diagram generation pipeline

### Minimum Modifications Needed
- Support richer node metadata for AP states such as pending, exception, approved, posted, reconciled.
- Support visual emphasis for SLA risk, queue hold, and exception severity.
- Support workflow templates for AP document lifecycles.

### Recommendation
Keep Mermaid early.
Do not replace it until AP workflow semantics are proven.

---

## 5.6 Electron Bridge and Native Runtime

### File
electron/main.cjs

### Current Role
- Desktop app shell
- IPC bridge
- M-Files PowerShell orchestration
- Save dialog
- Claude and Cacoo bridge helpers

### Keep
- Electron main-process IPC structure
- Native save behavior
- Pattern of delegating risky operations to main process
- Pattern of external integration orchestration via IPC

### Minimum Modifications Needed
Add new IPC channels for AP platform capabilities.

#### New IPC Contracts Needed
- intake:import-files
- ocr:submit-document
- ai:extract-fields
- queue:route-invoice
- queue:update-status
- n8n:run-workflow
- n8n:get-execution-status
- erp:post-invoice
- erp:get-post-status
- reconciliation:retry-job
- audit:export-log

#### M-Files Strategy
- Keep existing M-Files handlers for migration and compatibility scenarios.
- Reclassify them as a connector surface, not the primary path.

### Recommendation
This file remains a strong place for secure orchestration and Windows-specific operations.
Do not remove it when backend APIs are introduced.
Use it as the desktop integration broker.

---

### File
electron/preload.cjs

### Current Role
- Safe renderer exposure for IPC methods

### Keep
- Context isolation pattern
- Clear bridge namespaces

### Minimum Modifications Needed
Add namespaces for new AP modules:
- intake
- queue
- ocr
- ai
- erp
- orchestration
- audit

### Recommendation
Preserve strict separation between renderer and privileged capabilities.
This becomes more important once invoice files and ERP secrets are involved.

---

## 5.7 Existing Backend Surface

### File
backend/app.py

### Current Role
- Flask proxy and parser for Cacoo import

### Keep
- General idea of a helper service

### Minimum Modifications Needed
- Do not expand this file into the long-term AP backend.
- Keep it as a temporary helper or retire it after equivalent Node/Fastify services exist.
- If reused short term, only use it for non-core utilities such as parsing experiments or migration helpers.

### Recommendation
This file is not the right anchor for the AP platform backend.
Do not build the core AP runtime around it.

---

## 5.8 Packaging and Dependency Direction

### File
package.json

### Current Role
- App metadata
- Frontend and Electron dependencies
- Build scripts

### Keep
- Electron build setup
- Vite entry points

### Minimum Modifications Needed
- Update description and product identity from M-Files workflow ingestion toward AP automation platform.
- Add dependencies only in phases:
  - first for routing, table/grid, and integration clients
  - later for drag-drop builders and workflow visualization improvements
- Keep dependency additions minimal until the domain model is stable.

### Recommendation
Avoid dependency sprawl before refactoring CommandCenter and the store.

---

## 5.9 Existing Connector Scripts

### Files
scripts/push-to-vault.ps1
scripts/pull-from-vault.ps1
scripts/test-connection.ps1
scripts/verify-vault.ps1

### Current Role
- M-Files connector operations

### Keep
- Windows enterprise integration pattern
- External connector implementation approach

### Minimum Modifications Needed
- Keep these scripts intact as legacy connector layer.
- Rename their product role in docs from core platform behavior to compatibility connector behavior.
- Use their design as a template for future connector modules if PowerShell is appropriate.

### Recommendation
These remain useful if AI Proviso needs M-Files coexistence or migration support.
They should not drive the core AP architecture.

---

## 6. PRD V4 Requirement Mapping to Existing Files

| PRD V4 Capability | Primary Existing Files to Modify | Modification Type |
|:---|:---|:---|
| Drag-and-drop workflow builder | src/components/CommandCenter.jsx, src/store/useWorkflowStore.js, src/hooks/useMermaid.js | Extend and refactor |
| Drag-and-drop form builder | src/components/CommandCenter.jsx, src/store/useWorkflowStore.js | Add module beside current workflow editor |
| Drag-and-drop menu/app builder | src/components/CommandCenter.jsx, src/store/useWorkflowStore.js | Add module beside current workflow editor |
| AP invoice model | src/store/useWorkflowStore.js, src/validation/schema.js | Extend domain model |
| Vendor account number logic | src/store/useWorkflowStore.js, src/validation/schema.js | Add validation and matching state |
| OCR and AI extraction | electron/main.cjs, electron/preload.cjs, src/components/CommandCenter.jsx | Add integration contracts and UI panels |
| Missing vendor and PO routing | src/validation/schema.js, src/store/useWorkflowStore.js, src/components/CommandCenter.jsx | Add policy engine and queue UI |
| Exception workbench | src/components/CommandCenter.jsx, src/store/useWorkflowStore.js | Add queue operations panel |
| Spreadsheet-like workbench | src/components/CommandCenter.jsx, src/store/useWorkflowStore.js, src/validation/schema.js | Extend existing grid pattern |
| Workflow integrity controls | src/validation/schema.js, src/store/useWorkflowStore.js, src/components/CommandCenter.jsx | Strengthen existing validation path |
| Bidirectional n8n orchestration | electron/main.cjs, electron/preload.cjs, src/store/useWorkflowStore.js | Add orchestration bridge |
| ERP posting and reconciliation | electron/main.cjs, electron/preload.cjs, src/store/useWorkflowStore.js, src/components/CommandCenter.jsx | Add integration and status model |
| Audit and traceability | src/store/useWorkflowStore.js, src/validation/schema.js, src/hooks/useExport.js | Extend event and export model |
| M-Files compatibility | electron/main.cjs, electron/preload.cjs, scripts/*.ps1 | Preserve as connector |

---

## 7. Recommended Implementation Order Without Rewrite

## Stage 1: Stabilize Existing Surfaces
Focus on refactoring the most overloaded files before major AP features.

### First Targets
- src/components/CommandCenter.jsx
- src/store/useWorkflowStore.js
- src/validation/schema.js

### Goal
Create clean extension points without changing product behavior yet.

---

## Stage 2: Introduce AP Domain Model
Add invoice, vendor, PO, receipt, approval, and exception entities into the existing store and validation system.

### Primary Files
- src/store/useWorkflowStore.js
- src/validation/schema.js
- src/components/CommandCenter.jsx

### Goal
Make the current app understand AP entities before adding OCR or ERP.

---

## Stage 3: Add Exception and Queue Behavior
Build pending routing, SLA state, ownership, and exception queue UI using the current grid and panel patterns.

### Primary Files
- src/components/CommandCenter.jsx
- src/store/useWorkflowStore.js
- src/validation/schema.js

### Goal
Make workflow integrity and exception routing operational.

---

## Stage 4: Add Integration Contracts
Introduce IPC contracts for OCR, AI extraction, n8n orchestration, ERP posting, and reconciliation.

### Primary Files
- electron/main.cjs
- electron/preload.cjs
- src/components/CommandCenter.jsx
- src/store/useWorkflowStore.js

### Goal
Connect the product to external AP runtime services without replacing the app shell.

---

## Stage 5: Expand Builder Experience
Add form builder and menu/app builder beside the existing workflow designer.

### Primary Files
- src/components/CommandCenter.jsx
- src/store/useWorkflowStore.js
- src/App.jsx

### Goal
Deliver the no-code platform promise from PRD V4.

---

## 8. Do-Not-Do List

- Do not replace Electron early.
- Do not move all logic into backend/app.py.
- Do not keep adding AP logic directly into CommandCenter without first carving out subcomponents.
- Do not bind the future data model to M-Files payload shape.
- Do not implement ERP posting before invoice and exception state rules exist.
- Do not implement spreadsheet bulk actions before validation and audit rules are defined.

---

## 9. Minimum New Files Only After Existing Surfaces Are Extended

The following should only be added after the existing files above have been stretched to their practical limit:
- src/components/ap/InvoiceWorkbench.jsx
- src/components/ap/ExceptionQueuePanel.jsx
- src/components/ap/IntegrationMonitor.jsx
- src/components/builders/FormBuilder.jsx
- src/components/builders/MenuBuilder.jsx
- src/store/slices/invoiceSlice.js
- src/store/slices/exceptionSlice.js
- src/store/slices/integrationSlice.js
- src/integrations/contracts/*.js

These are not rewrite triggers.
They are cleanup steps after the first extension phase.

---

## 10. Final Recommendation

The current AIproviso application should be treated as the foundation for AI Proviso, not as a prototype to discard.

The best path is:
1. Refactor the overloaded workflow surfaces.
2. Extend the state and validation model into AP.
3. Add exception routing and spreadsheet integrity.
4. Add n8n and ERP contracts.
5. Expand into form/menu builders.

This preserves momentum, reduces rewrite risk, and keeps the existing workflow-builder strengths that already align with the PRD V4 direction.

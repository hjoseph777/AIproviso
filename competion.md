# AP Automation Competition and Workflow Stack Recommendation

Prepared for Michel LeBrun.

## Executive Position

AI Proviso should move toward a split workflow architecture:

- `n8n` remains the event router, notification layer, and external integration layer
- `XState` becomes the workflow and state-machine evaluator
- `PostgreSQL` remains the system of record for invoice state, workflow snapshots, audit records, and timer metadata
- `Redis` plus BullMQ remains the reliable queue and delayed-job layer

This is the right direction if the goal is an AP workflow engine as rich as M-Files, but without proprietary lock-in.

The important boundary is this:

`n8n` is not the workflow state machine.

`n8n` is the transport and orchestration layer around the workflow state machine.

That distinction matters because AP automation needs long-lived states, human pauses, approval waits, retries, SLA timers, and audit-safe transitions. Those capabilities need persisted workflow state, not only visual automation flows.

## Current Repo Reality

The current repository already points in the correct direction:

- the PRD treats `n8n` as the event spine
- PostgreSQL is already the development truth path for transactions and workflow state
- the live Docker stack is already validating persisted invoice, extraction, and audit data
- the current backend is still a Flask sandbox, not yet the final workflow engine

That means adding `XState` is a good idea, but it should be added to the future backend workflow service, not treated as a frontend-only library and not used as an in-memory source of truth.

## Recommendation on XState

I agree with adopting `XState`, with one condition:

Use it as the workflow interpreter inside the target backend service, not as the persistent runtime itself.

Why it fits:

- supports named states and guarded transitions
- supports entry and exit actions
- supports nested states and parallel branches
- supports history states
- supports invoked async actions
- supports a clean JSON-like machine definition that maps well to your workflow designer

Why it should not own persistence:

- `XState` runs in memory
- AP invoices may sit in approval or exception states for hours or days
- server restarts must not lose workflow position
- delayed transitions cannot depend on process memory alone

The right pattern is:

1. load the workflow snapshot from PostgreSQL
2. reconstruct the machine for that invoice
3. send the event into `XState`
4. get the new snapshot and state
5. save the new snapshot back to PostgreSQL in one transaction with history and audit
6. notify `n8n` after commit

That gives you the power of `XState` without the operational weakness of in-memory state.

## Recommendation on n8n

`n8n` is still the right tool in this stack, but its role should be explicitly limited.

Keep `n8n` for:

- webhook intake
- event routing between modules
- approval email dispatch
- vendor notification dispatch
- ERP webhook and API calls
- retryable external calls
- SLA reminder and escalation dispatch
- imported automation patterns and reusable routing templates

Do not use `n8n` as the core AP state engine for:

- holding current invoice state
- deciding guarded transitions
- enforcing database-safe approval rules
- synchronously running pre-commit transition actions
- atomically writing state plus audit plus timer records

If that boundary is held, `n8n` becomes a strength instead of a stability risk.

## Recommended New AP Workflow Stack

### Workflow Logic Layer

- `XState` in the target backend workflow service
- workflow JSON stored in PostgreSQL
- workflow transitions evaluated server-side
- state snapshots serialized and persisted per invoice

### Persistence Layer

- `PostgreSQL` as system of record
- one active workflow snapshot row per invoice
- append-only transition history table
- append-only audit trail table
- timer registry table for delayed transitions and escalations
- optimistic locking on every state update

### Event and Integration Layer

- `n8n` as event router and notification dispatcher
- BullMQ plus Redis for reliable queues and delayed jobs
- post-commit delivery from backend to `n8n`

### UI Layer

- React and Electron for consultant and AP operator surfaces
- workflow designer serializes state and transition configuration
- inspector panels expose state properties and transition properties

## How Competitors Handle AP Automation

### Stampli

What they do well:

- strong invoice-centric collaboration
- good in-context communication across AP and approvers
- dynamic approval routing
- strong user-facing audit visibility on the invoice

What they do not offer:

- no consultant-grade workflow canvas
- no reusable workflow templates across deployments
- no local deployment model
- no cross-client workflow learning

Takeaway for AI Proviso:

Borrow the invoice-centric collaboration idea, but implement it as a workflow property with audit immutability and field-level traceability.

### Tipalti

What they do well:

- strong supplier management
- strong payment operations and global payout handling
- configurable routing around approvals and finance operations

What they do not offer:

- no real workflow designer as a first-class product surface
- no reusable consultant workflow model
- heavy implementation burden for many customers

Takeaway for AI Proviso:

Borrow the low-friction vendor interaction pattern, but do it with tokenized reply flows rather than a heavyweight portal-first model.

### Coupa

What they do well:

- enterprise-scale spend visibility
- anomaly detection and decision support
- strong procurement and AP breadth

What they do not offer:

- heavy UI and configuration overhead
- workflow changes often feel IT-led instead of consultant-led
- not designed for self-hosted, local-first AP automation

Takeaway for AI Proviso:

Borrow anomaly detection and explainability, but keep it tied directly to workflow routing and exception handling.

### Basware

What they do well:

- high-volume AP operations
- strong PO and non-PO handling
- automated coding for repeat invoice patterns

What they do not offer:

- less differentiation on workflow intelligence
- weaker explainability and customization in some environments
- no cross-deployment learning moat

Takeaway for AI Proviso:

Borrow machine-assisted coding and repeat-vendor learning, but make it part of the Proviso learning loop instead of a siloed feature.

## M-Files vs XState Capability Snapshot

Three workflow capabilities matter most in this comparison.

1. M-Files capability: standard named states, transitions, assignments, and event-driven workflow actions.
   XState native capability: named states, guarded transitions, entry and exit actions, and explicit event handling with stronger modeling flexibility.

2. M-Files capability: pause and approval-oriented lifecycle control with server-managed workflow persistence.
   XState native capability: wait states, delayed transitions, invoked async actions, parallel branches, and history states, but persistence must be supplied by PostgreSQL and the backend workflow engine.

3. M-Files capability: production-ready enterprise workflow behavior tightly coupled to metadata, permissions, and document lifecycle.
   XState native capability: richer pure workflow logic than M-Files, including hierarchical and parallel statecharts, but governance, audit immutability, timer durability, and admin safety rails must be built around it.

## Market Gap AI Proviso Can Own

The strongest market gap is still the same:

No mainstream AP automation vendor offers consultant-first workflow design plus cross-deployment workflow reuse plus local deployment plus local-model support.

That is the real moat.

The message for Michel should be:

- competitors automate invoices inside their own cloud products
- AI Proviso automates workflow design, deployment, and learning across clients
- competitors improve within one tenant
- AI Proviso can improve future deployments from sanitized prior deployments

## Best Competitive Ideas Worth Adopting

These are worth adopting, but only if they are represented as workflow properties rather than standalone silo features.

### 1. Inline Invoice Collaboration

Keep the strong idea from Stampli, but improve it:

- comments tied to invoice or field context
- comments written into immutable audit records
- vendor replies can become structured correction signals
- workflow states can turn collaboration on or off by configuration

### 2. Vendor Response Without Heavy Portal Friction

Keep the strong idea from Tipalti, but improve it:

- tokenized vendor reply links
- limited-scope response forms
- no full account requirement for one-off interactions
- workflow transitions can decide when vendor contact is required

### 3. GL and Coding Suggestions

Keep the strong idea from Stampli and Basware, but improve it:

- suggestions tied to workflow transition actions
- profile learning based on corrected outcomes
- future option for cross-deployment pattern reuse where policy allows

### 4. Anomaly Detection

Keep the strong idea from Coupa, but improve it:

- anomaly flags must carry a reason code
- anomaly results must feed routing decisions directly
- anomaly handling must be visible in queues and audit history

### 5. One-Tap Approval

This is worth adding early because it is both useful and demo-friendly:

- tokenized approval links
- clean mobile web confirmation
- audit-safe server-side confirmation
- approval state decides whether email approval is allowed

## Why These Should Be State and Transition Properties

This is the key design choice.

The best competitive features should not become detached modules.

They should be optional state or transition properties in the workflow definition.

Examples:

- `comments_enabled` on a state
- `email_approval_enabled` on a state
- `approval_token_expiry_hours` on a state
- `fires_vendor_notification` on a transition
- `run_gl_suggestion` on a transition
- `run_anomaly_check` on a transition
- `on_missing_po` on a state

This is better than how competitors implement similar features because:

- it keeps configuration in the workflow designer
- it avoids feature silos
- it makes behavior tenant-configurable without code changes
- it keeps the canvas meaningful for consultants

## Microsoft Option: What Microsoft Has and Why It Still Does Not Fit Best

Microsoft has strong workflow tooling, mainly through Power Automate and Business Process Flows.

Strengths:

- rich enterprise connectors
- stage-driven business process support
- wait and approval constructs
- broad Microsoft ecosystem integration

Limitations for this product direction:

- Dataverse and Microsoft platform dependency
- licensing and tenant coupling
- weak fit for Docker-first self-hosted deployment
- weak fit for local LLM and local AI requirements
- weaker fit for your consultant-first reusable workflow model

Conclusion:

Microsoft has workflow tooling, but it does not fit the product thesis as well as `XState` plus PostgreSQL plus `n8n`.

## Database Tightening Plan

This is the most important stability requirement before workflow logic expands.

### Source of Truth Rule

Workflow state must live in PostgreSQL, not in memory and not only inside `n8n` execution state.

Recommended tables:

- `workflow_state` for one active row per invoice
- `workflow_state_history` for append-only transition history
- `workflow_timers` for delayed transition and SLA records

### Update Rule

Every state change must happen in one transaction that includes:

- state snapshot update
- state history insert
- audit event insert
- timer cancellation or creation
- token creation when needed

`n8n` notification must happen after commit, never before commit.

### Concurrency Rule

Every workflow update must use optimistic locking.

Required pattern:

- load current version
- update with `WHERE version = expected_version`
- if zero rows are updated, retry with the newer snapshot

This prevents split-brain state when a user action and a timer action arrive at the same time.

### Timer Rule

Do not rely on in-memory delayed transitions for long-lived AP workflow timing.

Use:

- BullMQ delayed jobs for execution
- PostgreSQL timer records for truth and auditability

### Retention Rule

Active workflow rows are never deleted during processing.

Terminal workflow rows are retained for the financial retention window and then archived, not immediately deleted.

## Stability Best Practices

Before implementing the workflow engine, lock these rules in writing:

- no direct state updates outside one workflow engine service
- no delete operations on active workflow state tables
- no `n8n` call inside the main transaction
- no transition on terminal invoices
- no delayed workflow behavior that depends on process memory alone
- every transition produces audit and history records
- every timer has both a queue job and a database record

## Practical Stack Feedback

The stack update is directionally correct, with two cautions.

### What I Agree With

- adding `XState` for workflow richness
- keeping `n8n` for routing, notifications, and integrations
- tightening PostgreSQL as the workflow source of truth
- keeping Redis and BullMQ for durable timing and retry behavior
- exposing workflow behaviors through state and transition properties

### What I Would Avoid

- treating `n8n` as the authoritative workflow engine
- treating `XState` memory as the persisted workflow runtime
- spreading transition logic across multiple tools without a single backend owner
- adding competitive features as ad hoc modules instead of workflow properties

### Recommended Next Architecture Step

Implement a dedicated workflow engine layer in the target backend service with this contract:

1. receive an invoice event
2. load workflow snapshot from PostgreSQL
3. evaluate transition through `XState`
4. write state, history, audit, and timers atomically
5. emit the completed event to `n8n`

That gives you M-Files-level workflow control with a cleaner, portable, self-hosted architecture.

## Final Recommendation to Michel

Proceed with the stack update.

Adopt `XState`, but only as the backend workflow interpreter.

Keep `n8n`, but keep it in the event-router and notification lane.

Make PostgreSQL the explicit persisted source of truth for workflow state, timers, and audit.

This gives AI Proviso the best chance of delivering:

- rich AP workflow behavior
- consultant-grade workflow configurability
- reliable pause and resume behavior
- audit-safe human approvals
- future reusable workflow intelligence across deployments

That combination is stronger than what the current AP automation market offers.

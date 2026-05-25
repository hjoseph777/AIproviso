# AI Proviso PRD V4
## Final - AP-First, Simple, AI-Native, Docker-Based, Workflow-Integrity-Driven

---

## 1. Vision

AI Proviso is a next-generation AP automation platform designed to deliver enterprise-grade outcomes with a business-user-first experience.

The platform will:
- Deliver value in days, not months.
- Replace M-Files-style complexity with simple configuration.
- Provide drag-and-drop builders for forms, menus, and workflows.
- Preserve strict workflow integrity, auditability, and compliance.
- Scale across entities, vendors, and invoice volume without engineering-heavy redesign.

---

## 2. Product Strategy

### Positioning
- AP Automation FIRST
- Workflow + DMS SECOND

### Target Market
- SMB and mid-market organizations
- Finance and accounting teams
- ERP-integrated operating environments

### Core Strategy
Faster value first, then feature parity.

### Strategic Promise
- Easy to use
- Easy to onboard
- Fast to value
- Strong and scalable
- No unnecessary complexity

---

## 3. Scope and Phasing

## 3.1 Phase 1 (Critical MVP)

### Invoice Intake
- Email ingestion
- File upload
- Scanner and OCR-enabled PDF intake

### OCR and AI Extraction
- Extract vendor name, vendor account number (if present), invoice number, invoice date, due date, amount, tax, currency, PO number (if present).
- Provide confidence score per extracted field.
- Highlight low-confidence fields for review and correction.
- Support vendor-aware extraction profiles.

### Matching
- 2-way matching: invoice vs PO
- 3-way matching: invoice vs PO vs receipt
- Tolerance rules for quantity and amount variances

### Approval Workflow
Routing based on:
- Amount
- Cost center
- Vendor
- Exception type
- Legal entity policy

### ERP Integration
- API-based posting
- Retry logic with backoff
- Reconciliation queue for failures
- Idempotent posting controls

### Audit Trail
- Field-level change tracking
- Decision tracking
- Full history and exportable trace

### Exception Management
- Exception workbench
- Suggested fixes
- Duplicate invoice detection
- Fraud flags

### No-Code Platform
- Drag-and-drop workflow builder
- Drag-and-drop form builder
- Drag-and-drop menu/app builder

### Security
- Role-based access control
- Segregation of duties

## 3.2 Phase 2+
- SLA timers and escalations
- Month-end AP dashboard
- Vendor-specific AI tuning
- Workflow and form template library
- Broader workflow and DMS capabilities

---

## 4. Metadata and AP Data Model

### Core Structure
Class -> Properties -> Value Lists

### AP Core Entities
- Invoice
- Vendor
- Purchase Order
- Receipt
- Approval Task
- Exception Case
- ERP Posting Event
- Audit Event

### Vendor Identity Requirements
Every vendor must include:
- Internal vendor ID
- ERP vendor number
- Vendor account number

Optional identifiers for fallback matching:
- Tax or VAT ID
- Bank account fingerprint (masked/hashed)
- Sender email/domain
- Historical template signature

### Invoice Minimum Properties
- Vendor reference set
- Invoice number
- Invoice and due dates
- Currency, subtotal, tax, total
- PO reference when available
- Cost center and coding fields
- Confidence metrics
- Exception status and reason

### Storage Tier Model
- Local Client Cache: lightweight SQLite cache in the desktop client for session continuity, workspace drafts, and offline scratch state.
- Platform Database: PostgreSQL 16 as the master system for workflows, queue state, audit logs, user access, OCR metadata, and integration state.
- Design rule: local cache is never the system of record for AP transactions.

---

## 5. Workflow Model

- State-based lifecycle
- Rule-based transitions
- Approve, reject, return actions
- Multi-step reviews
- Escalation paths
- Deterministic policy checks before posting

---

## 6. Pending and Exception Routing Standard

Invoices missing critical information must never remain in passive pending state. They must be routed to structured queues with ownership, SLA, escalation, and audit.

### Exception Queues
- Missing Vendor Reference
- Missing PO Reference
- Missing Vendor and PO
- Low Confidence Extraction
- Duplicate Suspected
- Policy Violation
- ERP Reconciliation Failure

### Auto-Routing Rules
- Missing vendor identifier with low match confidence -> Missing Vendor Reference queue
- Missing PO where PO is required -> Missing PO Reference queue
- Missing both -> Missing Vendor and PO queue (high priority)
- Confidence below threshold -> Low Confidence queue
- Duplicate risk above threshold -> Duplicate queue and post-block

### Ownership
- AP Data Validation Team
- AP Matching Team
- AP Compliance Lead
- AP Integration Team

### SLA and Escalation
- Missing vendor: 4 business hours
- Missing PO: 8 business hours
- Missing vendor + PO: 4 business hours
- Duplicate suspected: 2 business hours
- ERP reconciliation: 4 business hours

Escalations:
1. Queue owner and AP manager
2. Controller
3. Finance operations lead and payment hold

### Resolution Outcomes
- Auto-resolved by enrichment
- Manually resolved by AP user
- Returned to vendor for correction
- Approved as non-PO exception by policy
- Rejected and closed with reason

### Mandatory Audit Data
- Exception type and reason code
- Assignee and assignment time
- SLA due time and breach count
- Signals used for inference
- Override details
- Final disposition

---

## 7. Missing Vendor Number and PO Best Practice

When invoices do not include vendor number or PO:

1. Attempt vendor resolution using:
- Vendor account number
- Vendor name similarity
- Tax ID
- Email domain
- Historical invoice fingerprint

2. Apply confidence policy:
- High confidence: auto-link vendor
- Medium confidence: suggest top candidates
- Low confidence: route to exception queue

3. Apply PO policy:
- PO required: hold and route to missing PO queue
- PO optional: continue as non-PO with approval controls

4. Preserve full trace:
- Signals
- Score
- User overrides
- Final decision path

---

## 8. Bidirectional Workflow Standard (n8n)

AI Proviso uses n8n as bidirectional process orchestration layer.

### Inbound to AI Proviso
- Invoice intake payloads
- PO and receipt updates
- Vendor master updates
- ERP status callbacks

### Outbound from AI Proviso
- Approved posting requests to ERP
- Status updates and exception notifications
- Supplier correction requests
- Audit and observability events

### n8n Workflow Patterns

1. Trigger Layer
- Webhooks for push
- Schedules for polling
- Manual reprocess triggers

2. Validation Layer
- Schema validation
- Required field checks
- Policy gate checks

3. Idempotency Layer
- Deterministic idempotency key
- Duplicate-safe behavior
- Exactly-once business effect

4. Orchestration Layer
- Parent invoice lifecycle workflow
- Child subflows for OCR, AI extraction, matching, approval, posting

5. Error Handling Layer
- Retries with backoff
- Dead-letter queue
- Reconciliation queue

6. Acknowledgment Layer
- ACK or NACK where supported
- Correlation IDs across all steps

7. Observability Layer
- Structured logs
- Workflow metrics
- Alerting on stuck or failed flows

### State Synchronization
Canonical states:
- Received
- Extracted
- Matched
- Pending Approval
- Approved
- Exception
- Posted
- Reconciled
- Failed

### Security Controls
- Signed webhooks
- Least-privilege connector credentials
- Secure secrets handling
- PII-safe logs

### AI Runtime Boundary
- LLM execution uses Ollama over API and is not embedded inside the desktop executable.
- AI workflow orchestration runs in Flowise and calls Ollama through configured endpoint URLs.
- Agent memory and retrieval metadata are persisted in platform data stores, not in transient process memory.

---

## 9. Architecture and Stack Layers

### Technology Stack
- Frontend: React + Vite
- Backend API Gateway: service API layer (current bridge implementation may be Flask; target platform implementation Fastify)
- Data Layer: PostgreSQL
- Workflow Orchestration: n8n
- OCR and DMS: Paperless-ngx
- AI Orchestration: Flowise
- LLM Runtime Service: Ollama API endpoint (external by default, optional local profile)
- Runtime and deployment: Docker and Docker Compose

### Runtime Separation Rules
- Electron desktop client remains host-native.
- Windows COM bridge remains host-native and is never containerized.
- Docker stack hosts platform services only.
- M-Files COM operations are executed by host process utilities and invoked by the desktop client.

### Integration Topology
- Windows Host Boundary:
- Electron desktop client UI and local workspace.
- COM bridge utility for win32/PowerShell M-Files calls.
- M-Files Desktop/Server COM access.
- Docker Service Boundary:
- Backend API gateway.
- PostgreSQL and Redis.
- n8n orchestration runtime.
- Paperless-ngx OCR and document services.
- Flowise AI orchestration.
- Optional local Ollama profile.

### Port and Environment Governance
- All service endpoints must be environment-driven through .env configuration.
- Recommended default service ports:
- PostgreSQL 5432
- Redis 6379
- n8n 5678
- Paperless-ngx 8000
- Flowise 3001
- Ollama 11434 (when local profile is enabled)
- Backend API 5000
- Use a single gateway endpoint from the desktop client for downstream service access when feasible.

### Layered Architecture
1. Infrastructure Layer -> Docker
2. Data Layer -> PostgreSQL
3. DMS and OCR Layer -> Paperless-ngx
4. Workflow Layer -> n8n
5. AI Layer -> Flowise + Ollama
6. Backend Service Layer -> Fastify
7. Client Experience Layer -> React drag-and-drop builders

### Event Flow
Invoice -> OCR -> AI extraction -> validation -> DB/state -> n8n orchestration -> ERP -> reconciliation -> audit

---

## 10. Client Experience Requirements

AI Proviso must be a no-code, drag-and-drop client platform.

### Core Builders
- Form Builder (drag and drop)
- Menu and App Builder (drag and drop)
- Workflow Designer (drag and drop)

### Spreadsheet-Like AP Workbench
The system may provide an Excel-like interface for speed, but workflow integrity is mandatory.

#### Integrity Controls
- Grid edits cannot bypass workflow states
- No invalid state jumps
- Approval-required fields become controlled post-submission
- Posting is blocked outside approved states
- Bulk edits run full validation and policy checks

#### Concurrency and Consistency
- Optimistic locking
- Conflict detection and merge/reload flow
- Active editor visibility

#### Audit Controls
- Cell-level old/new value tracking
- User, time, reason capture
- Itemized audit on bulk updates

#### Security in Grid Mode
- Role-based field masking and edit rights
- Segregation of duties enforced in all interfaces

### First-Run Wizard
- Connect ERP
- Define approval matrix
- Map top vendors and references
- Validate workflow rules
- Go live target under 7 days

---

## 11. Testing and Workflow Integrity Engine

- Workflow simulation before activation
- Step-by-step execution trace
- Error highlighting and guidance
- Replay failed runs safely
- Rule and integration test packs
- Versioned workflow deployment gates

---

## 12. Non-Functional Requirements

### Performance
- Fast intake acknowledgment
- SLA-bound extraction and posting pipeline

### Scalability
- Horizontal scaling of workers and APIs
- Queue-based load leveling for peak volume

### Reliability
- Retry policies and graceful degradation
- Backup and restore procedures

### Offline and Air-Gapped Consistency
- Docker compose configuration must mount persistent local volumes for PostgreSQL, OCR artifacts, and optional local model storage.
- Platform must support consultant operation when internet is unavailable, assuming required local services are already provisioned.
- Service startup profiles should support both core stack mode and optional local AI mode.

### Security and Compliance
- RBAC and SoD
- Encryption in transit and at rest
- SSO-ready identity integration
- Immutable audit records

---

## 13. Success Metrics

### Time to Value
- Deployment in under 7 days for AP starter setup

### Automation and Accuracy
- Touchless rate progression: 40 percent -> 70 percent+
- OCR and extraction accuracy: 95 percent+
- Vendor auto-identification accuracy

### Operational Quality
- Approval cycle reduction: 50 percent+
- Exception resolution time by queue
- SLA breach rate
- ERP posting success and reconciliation resolution time
- Percentage processed without explicit vendor number or PO

---

## 14. Risks and Mitigation

### Risks
- Overbuilding too early
- AI hallucination or low-confidence extraction
- ERP integration edge cases
- User bypass attempts in spreadsheet-like UI

### Mitigations
- Strict phased scope gates
- Confidence thresholds with mandatory review
- Idempotent integration with retry and reconciliation queues
- Workflow integrity controls across all interfaces

---

## 15. Implementation Timeline

### Phase 1 (Weeks 1-2)
- Intake and OCR
- Basic lifecycle and queue setup

### Phase 2 (Weeks 3-4)
- AI extraction and confidence routing
- Approval workflows and exception handling

### Phase 3 (Weeks 5-6)
- ERP bidirectional integration via n8n
- Reconciliation and full audit trail

### Phase 4 (Weeks 7-8)
- Drag-and-drop builders hardening
- Spreadsheet-like workbench integrity controls
- Simulation and testing engine hardening

Note: 8 weeks is pilot target. Production hardening may require 12-16 weeks depending on security, compliance, and ERP complexity.

---

## 16. Final Strategy

AI Proviso wins with:
- Simplicity
- Speed
- Usability
- Strong workflow integrity
- AI augmentation with policy control
- Scalable architecture without M-Files complexity

This product must feel as easy as a modern business app while operating with enterprise-grade AP discipline.

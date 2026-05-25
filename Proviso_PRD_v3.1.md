# Proviso
## *From Scenario to Vault — Automatically*
### Product Requirements Document · Version 3.1

> Legacy PRD snapshot.
> Superseded by `Proviso_PRD_v4.md`.
> Keep for architecture history and transition planning only.

---

| Field | Detail |
| :--- | :--- |
| **Product** | Proviso — Workflow Ingestion Platform |
| **Version** | 3.1 — Conformity Layer + Cross-Workflow Architecture |
| **Author** | Harry Joseph · scriptdotnet |
| **Date** | May 2026 |
| **Status** | Active Development |
| **Audience** | Michel LeBrun — Xerox Canada · Development Team |
| **Confidentiality** | Confidential — scriptdotnet |

---

**Changelog:**

| Version | Changes |
| :--- | :--- |
| 0.6 | Original PRD — COM API provisioning, markdown parser, spaCy NLP, single workflow |
| 2.0 | Architecture overhaul — rich JSON, multi-tab, bidirectional sync |
| 3.0 | Full rewrite — SQLite dataset, RAG, llama.cpp, MemOS agent memory, clean vault strategy, self-improving intelligence layer |
| **3.1** | **Conformity layer clarified as test/compliance enforcement infrastructure. Named workflow catalog added (Service Agreement, NDA, Approbation, BonCommande, Statement). Two-tier import strategy. Cross-workflow connection mapping via ConformityApp ChangeWorkflow. Protected field registry. Known unknowns section. Real vault import elevated to immediate Phase I priority. Obsidian deferred to Phase III+.** |

---

> **PRD Confidence Status — May 2026**
>
> | Section | Confidence | Basis |
> | :--- | :--- | :--- |
> | Architecture decisions | 95% | Confirmed by POC |
> | Technology stack | 95% | Confirmed by POC |
> | Phase roadmap | 90% | Confirmed |
> | Rich JSON schema | 70% | Assumptions — pending real vault import |
> | Conformity handling | 60% | Partially confirmed — real JSON will clarify |
> | Cross-workflow connection storage | 65% | Architectural estimate — pending real vault |
> | Dataset record design | 80% | Structure correct — fields may change |
> | ConformityApp ChangeWorkflow format | 50% | Completely unknown — real export required |
>
> **The 25% that remains open will be answered by importing a real production vault (Approbation vault) and examining the rich JSON output. Do not finalise those sections until that import is complete. The correct engineering approach is: import reality first, then update the PRD based on facts.**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem We Are Solving](#2-the-problem-we-are-solving)
3. [The Solution — Proviso](#3-the-solution--proviso)
4. [Architecture Overview v3.1](#4-architecture-overview-v31)
5. [Vault Anatomy — What Proviso Imports](#5-vault-anatomy--what-proviso-imports)
6. [Rich JSON — The Missing Ingredient](#6-rich-json--the-missing-ingredient)
7. [Dataset Architecture](#7-dataset-architecture)
8. [AI & LLM Architecture](#8-ai--llm-architecture)
9. [MemOS — Agent Memory Layer](#9-memos--agent-memory-layer)
10. [M-Files Bidirectional Integration](#10-m-files-bidirectional-integration)
11. [UI Architecture — Beta III Command Center](#11-ui-architecture--beta-iii-command-center)
12. [Phase Roadmap](#12-phase-roadmap)
13. [Build Estimate](#13-build-estimate)
14. [Commercial Opportunity](#14-commercial-opportunity)
15. [Appendix — Rich JSON Schema Reference](#15-appendix--rich-json-schema-reference)

---

## 1. Executive Summary

Proviso is an institutional knowledge platform for DMS implementations.

Version 3.1 refines v3.0 with a critical architectural clarification: a real M-Files vault contains two fundamentally different layers — the **Conformity layer** (compliance enforcement infrastructure that rarely changes and is never customised per client) and the **named workflows** (Service Agreement, NDA, Approbation, BonCommande, Statement — the business logic that Proviso captures, adapts, and exports for each new client engagement).

These two layers require completely different import and dataset strategies.

Additionally, v3.1 introduces the **cross-workflow connection model**: named workflows are not always independent. A Service Agreement workflow can trigger an Approbation workflow at a specific state transition via ConformityApp ChangeWorkflow rules. Proviso must understand, store, and reproduce these connections.

The five core v3.0 insights remain unchanged and confirmed:

1. The M-Files COM API supports full bidirectional rich import/export — capturing every state, transition, permission, condition, VBScript, and notification in one call
2. Workflow JSON should be stored in a queryable SQLite dataset with RAG-based retrieval
3. A small local LLM (3B–8B parameters) running via llama.cpp handles all workflow modification tasks offline at zero cost
4. MemOS provides persistent agent memory — the AI remembers consultant decisions across sessions and projects
5. The complete round-trip — import live vault → AI adapts via natural language → export to clean empty vault — reduces implementation from 2–3 days to under one hour

**One addition in v3.1:** the real vault import is not just a helpful step — it is the prerequisite for finalising the 25% of the PRD that depends on seeing actual Conformity and ConformityApp ChangeWorkflow JSON structures.

> *"Describe what the client needs. AI finds the closest named workflow in your dataset, customises it for the new scenario, maps any cross-workflow connections, shows you the diff, and exports a fully configured vault to the GUID you provide. Three interactions. Zero manual entry."*

---

## 2. The Problem We Are Solving

### 2.1 The Triple Entry Problem

Every M-Files implementation follows the same manual sequence:

```
Entry 1 — Write the scenario (Word, email, PDF)
Entry 2 — Draw workflow in Cacoo by hand
Entry 3 — Redraw in M-Files Admin by hand
           (M-Files uses a proprietary format —
            no external tool can import into it)
Entry 4 — Write the SOW manually
Entry 5 — Write the PRD manually
```

The same information — states, transitions, permissions, conditions, VBScript, users — is entered manually four to five times per project. Every re-entry introduces risk. Every error requires rework.

### 2.2 The Template Reuse Trap

Copying a vault from a previous client appears to save time. In reality it transfers technical debt. Inherited workflows carry another client's logic. States are disabled rather than removed. Old VBScript references clients that no longer exist. Aliases point to renamed workflows. The result is a **spaghetti diagram nobody fully understands** — fragile under change, error-prone in production.

### 2.3 The Synchronisation Problem

When a client requests a change after deployment, the consultant updates M-Files Admin. But Cacoo now shows the old diagram. The SOW is outdated. The PRD no longer matches. There is no single source of truth. Documentation drift is guaranteed.

### 2.4 The Knowledge Loss Problem

When a senior consultant builds a complex vault — every permission decision, every VBScript pattern, every threshold condition, every cross-workflow connection — that knowledge lives in their head. When they leave, it leaves with them. Proviso makes it permanent.

### 2.5 The Cross-Workflow Blind Spot

The previous approach treated each workflow as an isolated unit. In reality, workflows are connected. A Service Agreement workflow at a specific state triggers an Approbation workflow. A BonCommande workflow connects to a Statement workflow at fulfilment. These connections are stored in ConformityApp ChangeWorkflow rules — invisible unless you know to look for them. Proviso makes these connections visible, storable, and reproducible.

### 2.6 Time Cost

| Task | Manual today | With Proviso |
| :--- | ---: | ---: |
| Draw workflow in Cacoo | 1–2 hrs | 0 min · auto |
| Redraw in M-Files Admin | 2–3 hrs | 0 min · auto |
| Configure permissions + conditions | 2–4 hrs | 0 min · imported |
| Write VBScript actions | 2–4 hrs | 0 min · imported |
| Write SOW | 2–4 hrs | 0 min · auto |
| Write PRD | 3–5 hrs | 0 min · auto |
| Fix sync errors between tools | 1–3 hrs | 0 min · 1 source |
| Reconfigure reused template | 2–4 hrs | 0 min · clean dataset |
| Map cross-workflow connections | 1–2 hrs | 0 min · stored in JSON |
| **Total per project** | **16–31 hrs** | **~45 min** |

---

## 3. The Solution — Proviso

### 3.1 Describe. AI Finds. AI Customises. Export.

The consultant does not build a workflow from scratch. They describe what the new client needs. AI searches the dataset for the closest matching named workflow, customises it, maps any cross-workflow connections, shows a diff for approval, and exports a fully configured vault.

**Three interactions. Zero manual entry.**

```
Interaction 1 — Consultant describes the scenario
  "New client — healthcare company,
   invoice approval, no ERP yet,
   simple two-step approval,
   English only, €75k threshold"
        │
        ▼
  AI searches dataset via RAG
  Finds top 3 closest named workflows:

    1. Approbation_v2    94% match
       Manufacturing · SAP · 34 states
       Changes needed: remove Maestro,
       add HIPAA review, threshold → €75k

    2. Contract_Lifecycle  87% match
       Legal · Dynamics · 12 states
       Changes: expand approval path,
       update threshold

    3. Invoice_Simple    71% match
       Retail · no ERP · 8 states
       Changes: add HIPAA review,
       expand approval path

  Note: Conformity is NOT shown here —
  it is infrastructure, not a match candidate

  AI: "Which would you like me to use as the base?"

Interaction 2 — Consultant confirms
  "Use Approbation_v2"
        │
        ▼
  AI customises the selected workflow:
    Removes Maestro states              ✓
    Removes Maestro transitions         ✓
    Removes Maestro VBScript references ✓
    Removes Maestro ConformityApp rules ✓
    Updates threshold 50000 → 75000     ✓
    Adds HIPAA Review state             ✓
    Updates permissions for healthcare  ✓
    Renames French states to English    ✓
    Checks: does this workflow connect
    to any other via ChangeWorkflow?    ✓
      → Yes: connected to ServiceAgreement
        at state "Approved for Signature"
        → Preserved in exported JSON

  Diff shown — every change visible
  "Here is what I changed. Review and approve."

Interaction 3 — Consultant approves diff
        │
        ▼
  ┌──► Live diagram draws itself
  ├──► Cross-workflow connections shown as arrows
  ├──► SOW generated automatically
  ├──► PRD generated automatically
  └──► Export to empty vault GUID
       Workflow already drawn
       Permissions already set
       Scripts already embedded
       Cross-workflow transitions mapped
       No redrawing. No re-entry.
```

### 3.2 The Four Input Paths

| Tab | Input | Engine | Best for |
| :--- | :--- | :--- | :--- |
| ✦ AI (primary) | Describe scenario in plain English | RAG + local LLM | All new client projects |
| ⊞ Manual | Direct spreadsheet entry | No AI needed | Complete control, simple workflows |
| ◈ NLP | Paste structured scenario document | regex + spaCy + RAG | Existing SOW document |
| ⬡ Cacoo | Diagram ID + API key | Cacoo REST API | Team already has approved Cacoo diagram |

All four paths produce the same `workflow.json`. All four populate the same spreadsheet. All four render the same live diagram. All four export to M-Files the same way.

### 3.3 Why the Dataset is the Core Product

```
After 5 projects:
  5 clean named workflow records
  Conformity stored once as reference
  AI finds ~80% match for new clients
  Customisation takes 10–15 minutes

After 20 projects:
  20 records across industries
  Cross-workflow patterns understood
  AI finds 90%+ match for almost every client
  Customisation takes 5 minutes

After 50 projects:
  50 records — every industry, every complexity
  AI matches instantly and customises precisely
  New client fully configured in under 15 minutes

The dataset IS the intelligence.
No competitor can replicate it without
the same 50 projects. This is the moat.
```

### 3.4 The Core Design Principles

- **Describe, don't build** — consultant describes what the client needs, AI does the building
- **Dataset-first** — every new project starts from a proven past named workflow, not from scratch
- **Two-tier vault model** — Conformity (infrastructure) vs Named Workflows (content) — treated differently throughout
- **JSON is the canonical format** — stays JSON until the last moment of export
- **AI proposes, consultant approves** — diff review before any change is applied
- **Rich import** — captures full vault intelligence including cross-workflow connections
- **Clean records** — no disabled states, no inherited client logic, purpose-built dataset entries
- **Local-first AI** — runs offline via llama.cpp, no cloud dependency required
- **Protected fields** — states/transitions relied on by add-ons cannot be silently deleted by AI

---

## 4. Architecture Overview v3.1

### 4.1 Technology Stack

| Layer | Technology | Purpose | Phase |
| :--- | :--- | :--- | :--- |
| Frontend | React + Electron | Desktop app, three-column UI | All |
| Diagram | Mermaid.js | Live workflow rendering + cross-workflow connection arrows | All |
| COM Bridge | Python + pywin32 | M-Files bidirectional sync | All |
| Local Storage | SQLite + sqlite-vec | Dataset, RAG vectors, conversations, Conformity ref | I |
| Production DB | MongoDB Atlas / Supabase | Shared dataset, multi-consultant | III |
| Embedding | nomic-embed-text (local) | RAG vector generation | II |
| Agent Memory | MemOS (local SQLite mode) | Cross-session AI memory, skill evolution | II |
| LLM — default | SmolLM3 3B Q4 via llama.cpp | Fast workflow edits, ~1.8 GB disk | II |
| LLM — balanced | Phi-4-mini 3.8B Q4 via llama.cpp | Better reasoning, French vault names | II |
| LLM — power | Qwen3 8B Q4 via llama.cpp | Complex multi-step + cross-workflow mapping | II |
| LLM — reasoning | DeepSeek-R1 7B Q4 via llama.cpp | Chain-of-thought, shows reasoning | II |
| LLM — cloud | Claude API Sonnet 4 | Maximum quality, requires internet | All |
| SOW/PRD | NLP regex + Claude API | Document generation | All |
| Companion (Phase III+) | Obsidian | Local knowledge browser on proviso_master/ folder | III+ |
| Packaging | Electron Builder | proviso.exe installer | III |

### 4.2 The Three-Column Command Center

```
┌─────────────────┬──────────────────────────┬───────────────────┐
│  INPUT (left)   │  LIVE DIAGRAM (centre)   │  AI STUDIO (right)│
│  Resizable      │  Mermaid renders live    │  Hidden by default│
│  Hideable       │  Click node → highlights │  Toggle to reveal │
│                 │  Cross-workflow arrows   │                   │
│  4 tabs:        │  AI prompt bar below     │  3 tabs:          │
│  Manual         │  Conversation history    │  AI Studio        │
│  NLP            │  Context chips           │  Deliver          │
│  AI             │  Stats bar               │  Library          │
│  Cacoo          │                          │                   │
└─────────────────┴──────────────────────────┴───────────────────┘
```

---

## 5. Vault Anatomy — What Proviso Imports

> **v3.1 Addition.** This section is new. It clarifies what a real production vault actually contains and how Proviso treats each component. This section will be refined after the real vault import.

### 5.1 The Two-Layer Vault Model

A real M-Files production vault does not contain only named workflows. It contains two fundamentally different types of content that must be treated differently.

```
A Real Production Vault
─────────────────────────────────────────────

LAYER 1 — CONFORMITY
  What it is:
    The compliance enforcement layer
    Validates that states and transitions
    behave correctly per business rules
    Checks documents against workflow rules
    Ensures correct lifecycle progression

  Characteristics:
    Rarely changes once configured
    Not the workflow being built
    More like infrastructure than content
    Always present — relied on by named workflows
    Used to TEST the workflow
    Never customised per client

  Examples:
    ConformityApp ChangeWorkflow rules
    Compliance Kit enforcement modules
    State validation triggers

LAYER 2 — NAMED WORKFLOWS
  What they are:
    The actual business workflows
    Service Agreement
    NDA
    Approbation
    BonCommande
    Statement
    (and others per client)

  Characteristics:
    Change per client
    Customised per industry, language, ERP
    These are what AI adapts
    These populate the dataset
    These are the product Proviso delivers
```

### 5.2 Named Workflow Catalog

The following workflow names are confirmed from real vault observations. This is a starting catalog — the real vault import will expand it:

| Workflow Name | Domain | Typical states | Cross-connects to | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Service Agreement | Contracts | 8–15 | Approbation | Triggers Approbation at approval stage |
| NDA | Legal | 6–10 | — | Often standalone |
| Approbation | Approvals | 10–34 | Service Agreement, BonCommande | Core approval engine |
| BonCommande | Purchasing | 8–20 | Approbation | PO approval chain |
| Statement | Finance | 6–12 | — | Often terminal workflow |
| BL (Bill of Lading) | Logistics | TBD | TBD | Seen in vault screenshots |
| Invoice in Archive | AP | TBD | TBD | Seen in vault screenshots |
| Statement_Line | Finance | TBD | TBD | Sub-workflow of Statement |

> **NOTE:** State counts, cross-connections, and trigger conditions for this table are partially confirmed. The real vault import will populate all TBD fields with actual values.

### 5.3 The Conformity Import Strategy

Conformity is **not** a workflow Proviso customises. It is infrastructure Proviso preserves.

```
Conformity Import Rule
─────────────────────────────────────────────

Import:   Once per vault type
          On first import of that vault family

Store:    In a separate conformity_refs table
          NOT in the workflows dataset
          Flagged as type = "conformity_layer"
          Flagged as mutable = false

Modify:   Never modified by AI
          Never shown as a customisation candidate
          Never included in RAG similarity search
          Never adapted per client

Export:   Written back verbatim on export
          Exactly as imported — no changes
          Required for vault to function correctly

Reason:   Conformity validates all the named
          workflows at runtime. If Conformity
          is broken, all workflows break.
          It is infrastructure, not content.
```

### 5.4 Cross-Workflow Connections

Named workflows can connect to each other depending on the scenario. These connections are not optional decoration — they are required business logic.

**Confirmed example:**
```
Service Agreement workflow
  │
  At state: "Approved for Signature"
  │
  Triggers: Approbation workflow
  Via: ConformityApp ChangeWorkflow rule
  
Result:
  Document in Service Agreement moves to "Approved"
  ConformityApp fires the ChangeWorkflow rule
  Document simultaneously enters Approbation
  at the designated entry state
```

**What this means for Proviso:**
```
When a consultant imports a vault that contains
Service Agreement AND Approbation:

  Proviso detects the ChangeWorkflow rule
  Proviso stores the connection in rich JSON:
    "cross_workflow_connections": [
      {
        "source_workflow":    "Service Agreement",
        "source_state":       "Approved for Signature",
        "target_workflow":    "Approbation",
        "target_entry_state": "Pending Approval",
        "trigger_type":       "conformityapp_change_workflow",
        "rule_id":            "TBD — from real JSON",
        "conditions":         "TBD — from real JSON"
      }
    ]

When consultant says:
  "Service Agreement connects to Approbation
   at the approval stage"

  Proviso already has this mapped.
  AI understands the dependency.
  Diff shows the connection before export.
  Export writes both workflows plus the
  ChangeWorkflow rule that links them.
```

> **Open question:** Can cross-workflow connections also be triggered by VBScript in a state action rather than exclusively via ConformityApp ChangeWorkflow rules? Answer pending real vault import. Both mechanisms will be supported once confirmed.

### 5.5 The Protected Field Registry

Some states and transitions are relied upon by add-ons (SQL Query, HTTP Caller, Replication). If AI silently renames or deletes these states, the add-on integrations break.

**Rule: AI cannot delete or rename a protected state without explicit consultant confirmation.**

```
Protected Field Registry (Phase I)
─────────────────────────────────────────────

Add-on: SQL Query
  Risk level: Low
  Protected states: states referenced in
  vault extension method queries
  What breaks: ERP read queries fail silently

Add-on: HTTP Caller
  Risk level: Low
  Protected states: states that trigger
  outbound webhook calls
  What breaks: External system not notified

Add-on: Replication
  Risk level: Low
  Protected states: states that trigger
  vault replication events
  What breaks: Mirror vault goes stale

Add-on: ConformityApp
  Risk level: HIGH
  Protected: ALL states and transitions
  that appear in ChangeWorkflow rules
  What breaks: Cross-workflow connections
  fail — documents stranded between workflows
```

**Phase I implementation:** Proviso flags protected states with a ⛓ icon on the spreadsheet row. AI checks the registry before proposing any deletion or rename. Warning shown: *"This state is referenced by [add-on]. Deleting it may break [specific function]. Confirm?"*

---

## 6. Rich JSON — The Missing Ingredient

### 6.1 Why Rich JSON Changes Everything

The M-Files COM API `GetWorkflowAdmin()` returns a complete deep object tree in a single call. Every property of every state and every transition is readable and writable. Proviso captures this entirely — including Conformity rules and cross-workflow connections.

**Without rich JSON — AI modifies blindly:**
Remove a state from the diagram — but VBScript still references it, notifications still fire to it, ConformityApp ChangeWorkflow rules still cross into it. Vault exports broken.

**With rich JSON — AI modifies completely:**
Every reference is visible across every layer simultaneously. Removed consistently. Cross-workflow connections re-evaluated. Vault exports clean.

### 6.2 What GetWorkflowAdmin() Returns — Phase Coverage

| JSON field | COM API source | Phase | Status |
| :--- | :--- | :--- | :--- |
| `states[].name` | `StateAdmin.Name` | Phase I | ✅ Confirmed |
| `states[].initial` | `StateAdmin.Initial` | Phase I | ✅ Confirmed |
| `states[].alias` | `StateAdmin.SemanticAliases` | Phase I | ✅ Confirmed |
| `states[].icon_type` | `StateAdmin.StateType` (enum) | Phase I | ✅ Confirmed |
| `states[].description` | `StateAdmin.Description` | Phase I | ✅ Confirmed |
| `transitions[].from/to` | `StateTransition.FromState / ToState` | Phase I | ✅ Confirmed |
| `transitions[].name` | `StateTransition.Name` | Phase I | ✅ Confirmed |
| `states[].preconditions` | `StateAdmin.Preconditions` | Phase II | Stored |
| `states[].postconditions` | `StateAdmin.Postconditions` | Phase II | Stored |
| `states[].permissions` | `StateAdmin.InOutPermissions` | Phase II | Stored |
| `states[].actions.vbscript` | `StateAdmin.ActionRunVBScriptDefinition` | Phase II | Stored |
| `states[].actions.pdf` | `StateAdmin.ActionConvertToPDF` | Phase II | Stored |
| `states[].actions.notify` | `StateAdmin.ActionSendNotificationDefinition` | Phase II | Stored |
| `states[].actions.set_props` | `StateAdmin.ActionSetPropertiesDefinition` | Phase II | Stored |
| `transitions[].permissions` | `StateTransition.AccessControlList` | Phase II | Stored |
| `transitions[].conditions` | `StateTransition.TriggerConditions` | Phase II | Stored |
| `transitions[].trigger_script` | `StateTransition.TriggerScript` | Phase II | Stored |
| `addons.conformity` | ConformityVaultApplication config | Phase III | **Partially unknown — real import needed** |
| `cross_workflow_connections` | ConformityApp ChangeWorkflow rules | Phase III | **Unknown structure — real import needed** |
| `addons.sql_queries` | VaultExtensionMethodOperations | Phase III | Stored |
| `addons.compliance_kit` | Compliance Kit module config | Phase III | Stored |

### 6.3 The Round-Trip Guarantee

The JSON is always the source of truth. Every state is created on import — nothing is skipped. Phase II/III properties not yet in the GUI are stored verbatim and written back exactly on export. Export is lossless across all phases.

### 6.4 The Real Vault Import Script

The following script should be run against the production Approbation vault to capture the full JSON reality and answer the open questions in this PRD:

```python
# Run this against the real production vault
# Save the output to vault_reality.json
# Examine it to update this PRD

import json
import win32com.client

mf = win32com.client.Dispatch("MFilesAPI.MFilesClientApplication")
vault = mf.BindToVault(server, guid, user, password)

workflows = vault.WorkflowOperations.GetWorkflows()
all_data = []

for i in range(1, workflows.Count + 1):
    wf = workflows.Item(i)
    wf_admin = vault.WorkflowOperations.GetWorkflowAdmin(wf.ID)

    wf_data = {
        "id":     wf.ID,
        "name":   wf.Name,
        "states": [],
        "raw":    str(wf_admin)
    }

    for j in range(1, wf_admin.States.Count + 1):
        state = wf_admin.States.Item(j)
        wf_data["states"].append({
            "name":      state.Name,
            "type":      state.StateType,
            "all_props": dir(state)  # Show EVERYTHING available
        })

    all_data.append(wf_data)

# Save — examine this file to answer all open PRD questions
with open("vault_reality.json", "w") as f:
    json.dump(all_data, f, indent=2, default=str)

print(f"Exported {len(all_data)} workflows")
print("Workflows found:")
for w in all_data:
    print(f"  {w['id']:4} | {w['name']:30} | {len(w['states'])} states")
```

**This output will answer:**
- What does Conformity actually look like in the COM API?
- How are cross-workflow connections stored — ChangeWorkflow rule structure?
- What exotic StateType enum values exist?
- What does ConformityApp configuration look like in JSON?
- Are there cross-workflow triggers in VBScript state actions in addition to ChangeWorkflow rules?
- What other patterns exist that were not anticipated in this PRD?

### 6.5 Double-Click State/Transition Detail

Double-clicking any state box or transition arrow opens a detail panel showing the complete rich JSON for that element. Every property, every script, every condition, every permission, every cross-workflow connection reference. Read-only unless in edit mode.

### 6.6 Flag Icons on Spreadsheet Rows

| Flag | Meaning |
| :--- | :--- |
| 🔒 | Has permissions/conditions — stored, Phase II |
| ⚡ | Has VBScript action — stored, Phase II |
| 📧 | Has notification — stored, Phase II |
| ⬡ | Has addon dependency — stored, Phase III |
| ⛓ | Protected — relied on by add-on (cannot delete without confirmation) |
| 🔗 | Cross-workflow connection point — ChangeWorkflow rule attached |
| ⚠ | Has unknown properties — stored as raw JSON |
| ✦ | Added by AI this session |
| + | Newly created — not from import |

---

## 7. Dataset Architecture

### 7.1 Dataset Not Templates

Proviso does not maintain templates. It maintains a **dataset of rich JSON records** representing clean, purposeful named workflow implementations. Conformity is stored separately as reference infrastructure — it is not part of the searchable dataset.

### 7.2 Two-Tier Storage Model

```
proviso.db (SQLite)
─────────────────────────────────────────────

TIER 1 — conformity_refs table
  Purpose:  Store Conformity layer verbatim
  Content:  ConformityApp config, ChangeWorkflow
            rule templates, Compliance Kit modules
  Mutable:  No — written once, read many
  AI use:   Reference only — never modified
  RAG:      Not included in similarity search

TIER 2 — workflows table
  Purpose:  Named workflow dataset
            Service Agreement, NDA,
            Approbation, BonCommande,
            Statement, etc.
  Content:  Full rich JSON, clean,
            client values replaced with
            {{placeholders}}
  Mutable:  Yes — AI adapts per client
  AI use:   Primary — RAG retrieval,
            similarity search, customisation
  RAG:      Full — embeddings, similarity,
            scenario matching
```

### 7.3 SQLite Schema — Phase I

SQLite is the correct choice for Phase I. Zero setup, ships inside Electron, works completely offline. Migration to MongoDB Atlas requires one connection string change.

```sql
-- Conformity reference storage (TIER 1 — never modified)
CREATE TABLE conformity_refs (
  id              TEXT PRIMARY KEY,
  vault_family    TEXT,       -- e.g., "approbation_vault_family"
  conformity_type TEXT,       -- "conformityapp" | "compliance_kit" | "other"
  config          TEXT,       -- Full raw JSON from import
  imported_at     TEXT,
  vault_guid      TEXT,
  notes           TEXT        -- Human note about this Conformity config
);

-- Named workflow dataset (TIER 2 — AI adapts these)
CREATE TABLE workflows (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  industry                  TEXT,
  complexity                TEXT,  -- low/medium/high/enterprise
  erp                       TEXT,
  ocr                       TEXT,
  language                  TEXT,
  state_count               INTEGER,
  features                  TEXT,  -- JSON array of feature tags
  workflow                  TEXT,  -- Full rich JSON
  cross_workflow_connections TEXT, -- JSON array of known connections
  scenario                  TEXT,  -- Plain English description for RAG
  embedding                 BLOB,  -- Vector for similarity search
  conformity_ref_id         TEXT,  -- FK → conformity_refs
  created_at                TEXT,
  version                   TEXT
);

-- Client projects
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  client          TEXT,
  consultant      TEXT,
  workflow_ids    TEXT,  -- JSON array — may include multiple connected workflows
  modifications   TEXT,  -- JSON array of AI changes
  exported_at     TEXT,
  vault_guid      TEXT,
  status          TEXT
);

-- AI conversation history per project tab
CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,
  project_id  TEXT,
  role        TEXT,  -- user | assistant
  content     TEXT,
  created_at  TEXT
);

-- Protected field registry
CREATE TABLE protected_fields (
  id          TEXT PRIMARY KEY,
  workflow_id TEXT,
  state_name  TEXT,
  addon_name  TEXT,  -- "sql_query" | "http_caller" | "replication" | "conformityapp"
  reason      TEXT,  -- Human-readable explanation
  risk_level  TEXT   -- "low" | "medium" | "high"
);

-- Cross-workflow connection map
CREATE TABLE workflow_connections (
  id                  TEXT PRIMARY KEY,
  source_workflow_id  TEXT,
  source_state        TEXT,
  target_workflow_id  TEXT,
  target_entry_state  TEXT,
  trigger_type        TEXT,  -- "conformityapp_change_workflow" | "vbscript" | "tbd"
  rule_json           TEXT,  -- Raw rule from import
  notes               TEXT
);

-- ERP vendor configurations
CREATE TABLE erp_configs (
  id       TEXT PRIMARY KEY,
  vendor   TEXT,
  config   TEXT,
  queries  TEXT
);

-- OCR vendor configurations
CREATE TABLE ocr_configs (
  id       TEXT PRIMARY KEY,
  vendor   TEXT,
  config   TEXT,
  mappings TEXT
);
```

### 7.4 Clean Master Records — No Disabled States

Every record in the `workflows` table is clean and purposeful. Client-specific values are replaced with typed placeholders before saving:

| Client-specific value | Placeholder in dataset record |
| :--- | :--- |
| Bill Ward, Betty Black | `{{CONTRACT_MANAGER}}`, `{{CFO}}` |
| `bill.ward@acme.com` | `{{USER_EMAIL}}` |
| `sap.clientA.com` | `{{ERP_BASE_URL}}` |
| 50000 (threshold) | `{{APPROVAL_THRESHOLD}}` |
| Acme Corporation | `{{CLIENT_NAME}}` |
| `WPS.ClientA.DraftState` | `WPS.{{WORKFLOW_PREFIX}}.DraftState` |

### 7.5 RAG Implementation

| Step | Action | Technology |
| :--- | :--- | :--- |
| 1 — Embed query | Convert consultant scenario to vector | nomic-embed-text (local, free) |
| 2 — Search dataset | Find 3–5 most similar named workflows | sqlite-vec similarity search |
| 3 — Build context | Inject similar records into LLM context | Python context builder |
| 4 — Generate | LLM reasons from proven patterns | llama.cpp local model |
| 5 — Diff review | Show proposed changes before applying | Proviso diff engine |
| 6 — Save record | After approval, save to workflows table | SQLite insert |

**Note:** Conformity records are injected into context as reference data only — the LLM sees them as constraints, not as candidates for modification.

### 7.6 Production Database — Phase III

| Option | Best for | Vector search | Cost |
| :--- | :--- | :--- | :--- |
| SQLite + sqlite-vec | Demo, offline, single consultant | ✅ Built-in | Free |
| Supabase + pgvector | Multi-consultant, web deployment | ✅ Built-in | Free tier |
| MongoDB Atlas Vector | Enterprise, global scale | ✅ Atlas Search | Free tier |
| Qdrant (self-hosted) | Air-gapped secure environments | ✅ Best-in-class | Free |

### 7.7 Obsidian as Phase III+ Companion

Obsidian is a free desktop app that opens a folder of Markdown files and builds a bidirectional knowledge graph from them. The `proviso_master/` folder that Proviso already uses is already Markdown files — Obsidian opens it natively with zero migration.

```
Phase I   → SQLite proves the concept
Phase II  → SQLite + sqlite-vec RAG adds intelligence
Phase III+ → Obsidian opens proviso_master/ as companion
             consultant browses knowledge graph
             same Ollama LLM, same files, same folder
             zero extra infrastructure

One sentence:
SQLite to prove it. Obsidian to enrich it.
Both reading the same folder.
No migration ever needed.
```

---

## 8. AI & LLM Architecture

### 8.1 Design Principles

- AI proposes changes — consultant always approves via diff review
- Local-first — all models run via llama.cpp, no internet required
- One line of code to switch between local and cloud
- Context is everything — RAG injects relevant past named workflows before every call
- Conformity context — injected as constraints, not candidates
- Cross-workflow awareness — AI knows which states are connection points before modifying

### 8.2 Model Comparison

| Model | Params | Disk Q4 | RAM | Speed CPU | JSON | French | Reasoning | License |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SmolLM3 3B | 3B | ~1.8 GB | ~2.5 GB | 30 t/s | ✅ Good | ✅ Native | ⭐⭐½ | Apache 2.0 |
| Phi-4-mini 3.8B | 3.8B | ~2.3 GB | ~3 GB | 22 t/s | ✅ Good | ✅ Good | ⭐⭐⭐ | MIT |
| Qwen3 8B | 8B | ~5 GB | ~6 GB | 16 t/s | ✅ Best | ✅ Best | ⭐⭐⭐⭐ | Apache 2.0 |
| DeepSeek-R1 7B | 7B | ~4.1 GB | ~5 GB | 12 t/s | ✅ Good | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | MIT |
| Claude API | Cloud | 0 GB | 0 GB | Fast | ✅ Best | ✅ Best | ⭐⭐⭐⭐⭐ | Commercial |

### 8.3 Recommended Configuration

| Tier | Model | When to use |
| :--- | :--- | :--- |
| Default (ships in app) | SmolLM3 3B Q4_K_M | Standard edits, fast, minimal footprint |
| Balanced | Phi-4-mini 3.8B Q4_K_M | Better reasoning, French vault names |
| Power (optional download) | Qwen3 8B Q4_K_M | Complex multi-step + cross-workflow mapping |
| Chain-of-thought | DeepSeek-R1 7B Q4_K_M | High-stakes changes — shows reasoning |
| Cloud fallback | Claude API Sonnet 4 | Maximum quality, internet required |

### 8.4 Reusable Prompt Library

| Prompt name | Purpose | Context injected |
| :--- | :--- | :--- |
| `EXTRACT_WORKFLOW` | Parse raw SOW → workflow JSON | Schema definition, field rules |
| `ADAPT_WORKFLOW` | Modify named workflow for new client | Current JSON + RAG results + scenario + Conformity ref |
| `CLEAN_FOR_DATASET` | Remove client specifics → master record | Current JSON + placeholder rules |
| `COMPARE_WORKFLOWS` | Diff two workflow JSONs | Two JSON records |
| `MAP_CROSS_CONNECTIONS` | Identify and map cross-workflow links | Multiple workflow JSONs + Conformity rules |
| `GENERATE_SOW` | Write SOW from workflow JSON | Full rich JSON + client details |
| `GENERATE_PRD` | Write PRD from workflow JSON | Full rich JSON + phases |
| `SUGGEST_TEMPLATE` | Find best matching named workflow | Scenario text + dataset metadata |
| `VALIDATE_WORKFLOW` | Check JSON integrity before export | Current JSON + validation rules + protected registry |
| `CHECK_PROTECTED_FIELDS` | Verify no protected states modified | Current diff + protected field registry |

### 8.5 The Complete AI Flow — Dataset First

```
Step 1 — Consultant describes scenario
        │
        ▼
Step 2 — RAG searches named workflow dataset
  Returns top 3 closest records
  Conformity NOT in search results
  AI presents matches with explanation
        │
        ▼
Step 3 — Consultant selects base record
        │
        ▼
Step 4 — MemOS retrieves consultant preferences
  + Protected field registry loaded
  + Cross-workflow connection map loaded
  + Conformity ref loaded as constraint context
        │
        ▼
Step 5 — AI customises selected named workflow
  Reads COMPLETE rich JSON
  Checks protected field registry FIRST
  Flags any cross-workflow connection states
  Proposes all modifications
        │
        ▼
Step 6 — Diff shown to consultant
  Every change is a checkbox
  Protected field warnings shown
  Cross-workflow connection impacts shown
  "This state is a connection point to
   Approbation — deleting it breaks
   the cross-workflow trigger"
  Consultant approves
        │
        ▼
Step 7 — Everything generates
  Diagram draws with cross-workflow arrows ✓
  SOW written ✓
  PRD written ✓
  Export to empty vault GUID ✓
  New record saved to dataset ✓
  Cross-workflow connections written ✓
```

### 8.6 Self-Improvement Mechanisms

**Mechanism 1 — Passive dataset accumulation (starts now)**
Every export saves a named workflow record. RAG retrieves better matches as dataset grows. Zero extra work.

**Mechanism 2 — Feedback loop (Phase II)**
Every AI response is rated 👍 👎. Every correction is captured. Prompts refined automatically.

**Mechanism 3 — MemOS agent memory (Phase II)**
See Section 9.

**Mechanism 4 — Fine-tuning (Phase IV)**
After 50+ projects: fine-tune Qwen3 8B on M-Files domain data using Unsloth LoRA. Proprietary domain model.

---

## 9. MemOS — Agent Memory Layer

### 9.1 What MemOS Is

MemOS (Memory Operating System) is an open-source self-evolving memory system for LLM agents. Local SQLite mode runs 100% on-device. Persistent memory, hybrid retrieval (FTS5 + vector), skill evolution, 35% token savings. Ships inside Electron.

### 9.2 Three Memory Levels for Proviso

**Level 1 — Consultant memory (cross-session)**
```
MemOS remembers:
  "Harry prefers English state names
   even for French client vaults"
  "Harry always removes Maestro for
   healthcare clients"
  "Harry uses Approbation as the base
   for all manufacturing AP workflows"
  "Client B uses Dynamics 365 with
   Suppliers table naming"
```

**Level 2 — Project memory (within project)**
```
MemOS remembers per project:
  Every AI decision made this session
  Every correction the consultant made
  Every cross-workflow connection mapped
  Why certain states were kept or removed

Next session on same project:
  AI picks up exactly where left off
  No re-explaining context
```

**Level 3 — Skill evolution (across all projects)**
```
MemOS discovers patterns automatically:
  "When vault has Maestro integration
   it always has these 8 states"
  "Healthcare clients always need
   a compliance review state"
  "Service Agreement always connects to
   Approbation via state 'Approved for Signature'"
  "French vaults always use WPS. prefix
   for state aliases"
```

### 9.3 MemOS + RAG — Complementary Roles

```
Proviso RAG:
  Searches the named workflow DATASET
  Finds similar past implementations
  → Returns rich JSON records

MemOS memory:
  Remembers DECISIONS and PATTERNS
  Remembers cross-workflow mappings
  → Returns consultant knowledge

Together:
  RAG finds the right named workflow   ← dataset
  MemOS applies the right patterns     ← memory
  Conformity ref provides constraints  ← infrastructure
  AI combines all three                ← best suggestion
```

---

## 10. M-Files Bidirectional Integration

### 10.1 Two-Tier Import Protocol

```
Phase 1 of import — Conformity Layer
  GetWorkflows() → identify Conformity
  GetWorkflowAdmin() → capture full config
  Store in conformity_refs table
  Flag as type = "conformity_layer"
  Flag as mutable = false
  Never show in dataset search results

Phase 2 of import — Named Workflows
  GetWorkflows() → list remaining workflows
  GetWorkflowAdmin() → capture each one
  Detect cross-workflow connections
  Store in workflows table
  Store connections in workflow_connections
  Flag protected states in protected_fields
  Show in tabs — one per workflow
```

### 10.2 Import Step by Step

1. Connect to vault — server, GUID, username, password
2. Call `GetWorkflows()` — lists all available workflows
3. Proviso categorises: Conformity layer vs Named workflows
4. Import Conformity first — stored as reference
5. Select named workflows to import (up to 6 tabs)
6. Call `GetWorkflowAdmin()` for each named workflow
7. Map StateAdmin tree to Proviso rich JSON
8. Detect and map cross-workflow connection rules
9. Populate protected field registry from add-on dependency scan
10. Create one tab per named workflow
11. Conflict resolution: if name exists → `workflow_name (imported YYYY-MM-DD)`

### 10.3 Export Step by Step

1. Create **empty vault** in M-Files Admin
2. Copy vault GUID from Properties
3. Paste GUID into Proviso connection panel
4. Proviso validates vault is empty
5. Select named workflows to export (up to 6)
6. Export Conformity configuration first (verbatim)
7. Export each named workflow — `AddWorkflowAdmin()`
8. Write cross-workflow connection rules (ChangeWorkflow)
9. Proviso writes fingerprint to vault Custom Data

### 10.4 What Exports in Each Phase

| Property | Phase I | Phase II | Phase III |
| :--- | :--- | :--- | :--- |
| State names + aliases | ✅ | ✅ | ✅ |
| State icons / types | ✅ | ✅ | ✅ |
| Transition connections | ✅ | ✅ | ✅ |
| Preconditions / Postconditions | Stored | ✅ Exported | ✅ |
| Permissions per state | Stored | ✅ Exported | ✅ |
| VBScript actions | Stored | ✅ Exported | ✅ |
| Notifications | Stored | ✅ Exported | ✅ |
| ConformityApp Conformity config | Stored | Stored | ✅ Exported |
| Cross-workflow connections | Stored | Stored | ✅ Exported |
| SQL queries | Stored | Stored | ✅ Exported |

### 10.5 Up to 6 Named Workflows Simultaneously

```
DELIVER PANEL
─────────────────────────────────────────────

EXPORT TO M-FILES
  ☑ Service Agreement
  ☑ NDA
  ☑ Approbation
  ☐ (empty)
  ☐ (empty)
  ☐ (empty)

  Cross-workflow connections detected:
  ⚠ Service Agreement → Approbation
    (connection will be exported)

  [→ Push selected to vault]

─────────────────────────────────────────────

IMPORT FROM M-FILES
  [Fetch available workflows]

  Conformity layer detected:
  ⬡ ConformityApp        [import as reference]

  Named workflows found in vault (8):
  ☑ Approbation
  ☑ Service Agreement
  ☑ BL
  ☐ BonCommande
  ☐ Statement
  ☐ Invoice in Archive
  ☐ Statement_Line
  ☐ NDA

  [← Pull selected into Proviso tabs]
```

---

## 11. UI Architecture — Beta III Command Center

### 11.1 Three-Column Layout

**Column 1 — Input (left, resizable 200–600px, hideable)**
Four tabs: Manual spreadsheet / NLP guided zones / AI extract / Cacoo import.

**Column 2 — Live Diagram (centre, focal point)**
Mermaid renders live as states are entered. Click a node → highlights corresponding row. Cross-workflow connection arrows shown as dashed lines between workflow diagrams. AI prompt bar below. Conversation history above the bar. Context chips showing active model and template.

**Column 3 — AI Studio / Deliver / Library (right, hidden by default)**
- **AI Studio** — context builder, diff drawer, prompt history, protected field inspector
- **Deliver** — M-Files export/import with two-tier display (Conformity + Named), SOW/PRD generation
- **Library** — dataset browser showing proviso_master/ folder, Conformity refs viewer

### 11.2 AI Prompt Bar

```
┌─────────────────────────────────────────────────┐
│ ⚙ Qwen3 8B · local  │ 📚 approbation_v2  │ 🛡 Diff │
├─────────────────────────────────────────────────┤
│ You: Remove Maestro integration                 │
│ AI: Removed 8 states, rewired 4 transitions.   │
│     ⛓ Warning: 2 states are connection points  │
│     to ServiceAgreement — preserved.            │
│     Review diff in AI Studio →                 │
├─────────────────────────────────────────────────┤
│ ✦ Proviso AI  [type your instruction here...  ] │
│                                       [Send ↗]  │
└─────────────────────────────────────────────────┘
```

### 11.3 Diff Drawer

```
┌─ Pending changes ─────────────────── 4 changes ─┐
│ ☑ + add   State: Director Escalation added      │
│ ☑ + add   Transition: Pending → Escalation      │
│ ☑ ~ mod   Condition: days_in_state > 5 (Ph.2)  │
│ ⛓ ! warn  State: "Approved for Signature"       │
│           is a cross-workflow connection point   │
│           to Approbation — not modified          │
│                                                  │
│ ⚠ Verify alias WPS.Approval.escalation          │
│   after export                                   │
├──────────────────────────────────────────────────┤
│ [✗ Reject all]          [✓ Apply selected]       │
└──────────────────────────────────────────────────┘
```

### 11.4 Workflow Tabs

Up to six named workflow tabs across the top. Conformity is NOT shown as a tab — it appears in the Deliver panel as a read-only reference section. Each named workflow tab has its own spreadsheet, diagram, AI conversation, and diff queue.

---

## 12. Phase Roadmap

### Phase I — Foundation · Real Vault Import + Two-Tier Architecture

**Immediate next action (before any other Phase I work):**
Run `GetWorkflowAdmin()` on the production Approbation vault. Save `vault_reality.json`. Examine the output to answer all open questions in Section 6.2 and Section 5.4. Update this PRD with facts from the real JSON.

**Phase I Objectives:** Complete bidirectional M-Files sync with rich JSON. Two-tier import (Conformity + Named). Local SQLite dataset. Demo-quality. Show Michel.

| Feature | Status |
| :--- | :--- |
| Three-column Command Center UI | ✅ Built |
| Four input tabs (Manual/NLP/AI/Cacoo) | ✅ Built |
| Live Mermaid diagram | ✅ Built |
| SOW + PRD auto-generation | ✅ Built |
| Claude API integration | ✅ Built |
| Workflow export to M-Files (skeleton) | ✅ **POC confirmed working** |
| **Real vault import — GetWorkflowAdmin()** | **🔴 IMMEDIATE PRIORITY** |
| Conformity layer detection + separate storage | 📋 Planned |
| Named workflow import (multi-tab) | 🔨 In progress |
| Cross-workflow connection detection | 📋 Planned |
| Protected field registry (Phase I basic) | 📋 Planned |
| Two-tier Deliver panel (Conformity + Named) | 📋 Planned |
| SQLite schema + integration | 📋 Planned |
| Double-click state/transition detail panel | 📋 Planned |
| Flag icons (🔒 ⚡ 📧 ⬡ ⛓ 🔗) on rows | 📋 Planned |
| Conflict resolution on import | 📋 Planned |
| Phase II property storage (read-only) | 📋 Planned |
| Export lossless guarantee | 📋 Planned |
| Dataset record save on export | 📋 Planned |

**Timeline:** 10–12 weeks at 10–15 hrs/week · ~3 months

---

### Phase II — AI Studio · Local LLM + RAG + MemOS

| Feature | Description |
| :--- | :--- |
| llama.cpp integration | SmolLM3 3B embedded in Electron, runs on CPU |
| Model selector | Toggle: SmolLM3 / Phi-4-mini / Qwen3 8B / DeepSeek-R1 / Claude API |
| sqlite-vec RAG | Vector embeddings for named workflows only |
| nomic-embed-text | Local embedding model — offline, free |
| MemOS local plugin | Cross-session agent memory, skill evolution |
| AI prompt bar | Natural language input, conversation history |
| Diff drawer | Checkbox per change, protected field warnings, cross-workflow impact warnings |
| Feedback loop | 👍 👎 rating, correction capture, prompt refinement |
| Reusable prompt library | 10 named prompts including MAP_CROSS_CONNECTIONS + CHECK_PROTECTED_FIELDS |
| Permission + VBScript export | Phase II properties written to M-Files |
| Cross-workflow connection UI | Visual dashed arrows between workflow tabs |

**Timeline:** 18–20 weeks at 10–15 hrs/week · ~5 months

---

### Phase III — Commercial · Electron App + MongoDB + Multi-DMS

| Feature | Description |
| :--- | :--- |
| proviso.exe installer | Electron Builder — includes llama.cpp + SmolLM3 |
| MongoDB Atlas migration | Shared dataset for multi-consultant teams |
| ConformityApp full export | ChangeWorkflow rules and cross-workflow transitions confirmed and exported |
| Protected field auto-detection | Automatic add-on dependency scan on import |
| SharePoint adapter | Same pattern applied to SharePoint |
| OpenText adapter | OpenText Content Server API |
| SQL query export | ERP SQL queries embedded in VBScript |
| Obsidian companion | proviso_master/ folder opened in Obsidian for knowledge graph browsing |
| Air-gapped deployment | Full offline mode |
| Partner licensing | Per-consultant pricing |

**Timeline:** 20–24 weeks at 10–15 hrs/week · ~5–6 months

---

### Phase IV — Intelligence Platform

| Feature | Description |
| :--- | :--- |
| ERP mapper | Import SQL queries and Postman collections, map fields |
| OCR mapper | Import OCR vendor configs, map extracted fields |
| Cross-workflow graph | Visual multi-workflow dependency graph |
| Readiness checklist | Pre-export validation — every green = export |
| Automated test runner | Authenticates as each user persona, validates all transitions |
| Compliance report PDF | Auto-generated test evidence |
| Fine-tuning pipeline | 50+ project records → fine-tune Qwen3 8B on M-Files domain |
| EvolveMem upgrade | MemOS self-evolving retrieval |
| Project lineage | Every implementation traces to source dataset record |

**Timeline:** 16–20 weeks · ~4–5 months

---

## 13. Build Estimate

### Part-Time Solo (10–15 hrs/week)

| Phase | Scope | Hours | Calendar time |
| :--- | :--- | :--- | :--- |
| Phase I | Rich import/export, two-tier architecture, SQLite, multi-tab | 120–150 hrs | 3 months |
| Phase II | llama.cpp, RAG, MemOS, AI prompt bar, cross-workflow UI, diff engine | 200–250 hrs | 5 months |
| Phase III | Electron, MongoDB, Conformity full export, SharePoint adapter | 200–280 hrs | 5–6 months |
| Phase IV | ERP/OCR, fine-tuning, test runner | 160–200 hrs | 4–5 months |
| **Total** | | **680–880 hrs** | **17–19 months** |

### The Critical Near-Term Milestone

**Immediate (this week):** Run `GetWorkflowAdmin()` on production Approbation vault. Examine `vault_reality.json`. Update the open sections of this PRD with real data.

**12 weeks from today — Phase I demo quality:**
- Two-tier import working: Conformity stored as reference, named workflows in tabs
- Cross-workflow connections detected and displayed
- Protected field registry populated
- SQLite saving clean records
- Double-click detail panel working
- Clean polished demo for Michel

---

## 14. Commercial Opportunity

### 14.1 Market

The global DMS market with workflow automation is projected to reach $19.2–24.3 billion by 2032, growing at 9–16% CAGR. No direct competitor to Proviso exists in this market.

### 14.2 Competitive Moat

- No tool automates DMS workflow provisioning bidirectionally with Conformity-aware two-tier architecture
- Cross-workflow connection mapping is a unique capability — no competitor captures ChangeWorkflow dependencies in a reusable dataset
- The dataset grows with every project — after 30 projects the RAG context outperforms any competitor starting fresh
- MemOS skill evolution captures patterns no competitor has without the same project history
- Local LLM + offline mode qualifies for banks, government, healthcare, defence
- Protected field registry prevents AI from breaking add-on integrations — a safety guarantee no competing tool offers

### 14.3 Licensing Model

| Tier | Target | Features | Pricing |
| :--- | :--- | :--- | :--- |
| Solo | Independent consultant | Full app, SQLite, local LLM, 1 user | One-time license |
| Team | Partner firm 2–10 | MongoDB shared dataset, multi-user | Per-seat annual |
| Enterprise | Large SI firms | Air-gapped, fine-tuned model | Enterprise annual |
| Platform | DMS vendors | White-label, embedded in vendor product | Revenue share |

### 14.4 Transferability

Proviso is not an M-Files tool. The knowledge, the dataset, the LLM, the MemOS memory, the RAG pipeline, the two-tier Conformity model — all of it transfers to any DMS with an API. SharePoint, OpenText, Laserfiche. The investment compounds across every DMS.

---

## 15. Appendix — Rich JSON Schema Reference

### 15.1 Complete Named Workflow Record

```json
{
  "schema_version": "3.1",
  "record_type": "named_workflow",
  "name": "Approbation",
  "source_vault": "{C840BE1A-5A3F-4A2E-B9D1-7F3E2C8A9B4D}",
  "imported": "2026-05-16",
  "richness": "phase_1",
  "conformity_ref_id": "conf_001",

  "states": [
    {
      "name": "Pending Approval",
      "initial": false,
      "alias": "WPS.Approbation.PendingApproval",
      "icon_type": 1,
      "description": "Awaiting executive sign-off",
      "_flags": ["🔒", "⚡", "📧"],
      "_protected": false,
      "_cross_workflow_connection": false,
      "_phase": "phase_2_stored",

      "preconditions": [
        {
          "property": "Contract Value",
          "property_id": 1189,
          "operator": ">",
          "value": "{{APPROVAL_THRESHOLD}}"
        }
      ],
      "actions": {
        "convert_to_pdf": false,
        "notify": {
          "users": ["{{CFO}}", "{{CONTRACT_MANAGER}}"],
          "message": "Approval required"
        },
        "set_properties": [
          { "property": "Approval Status", "value": "Pending" }
        ],
        "vbscript": "' VBScript text here — stored verbatim"
      },
      "permissions": {
        "view":   ["All Staff"],
        "edit":   ["{{CONTRACT_MANAGER}}"],
        "delete": ["Administrators"]
      }
    },
    {
      "name": "Approved for Signature",
      "initial": false,
      "alias": "WPS.Approbation.ApprovedForSignature",
      "icon_type": 2,
      "_flags": ["🔗"],
      "_protected": true,
      "_protected_reason": "Cross-workflow connection to ServiceAgreement via ConformityApp ChangeWorkflow",
      "_cross_workflow_connection": true,
      "_phase": "phase_1"
    }
  ],

  "transitions": [
    {
      "from": "Reviewed",
      "to": "Pending Approval",
      "name": "Submit for Approval",
      "alias": "WPT.Approbation.SubmitApproval",
      "permissions": ["{{CONTRACT_MANAGER}}"],
      "conditions": [
        {
          "property": "Contract Value",
          "operator": ">",
          "value": "{{APPROVAL_THRESHOLD}}"
        }
      ],
      "trigger_script": ""
    }
  ],

  "cross_workflow_connections": [
    {
      "source_workflow":    "Approbation",
      "source_state":       "Approved for Signature",
      "target_workflow":    "Service Agreement",
      "target_entry_state": "TBD — pending real vault import",
      "trigger_type":       "conformityapp_change_workflow",
      "rule_id":            "TBD — from real JSON",
      "conditions":         "TBD — from real JSON",
      "_confidence":        "estimated — update after vault_reality.json"
    }
  ],

  "addons": {
    "conformity": {
      "ref_id": "conf_001",
      "change_workflows": "TBD — from real JSON",
      "note": "Verbatim from import — never modified"
    },
    "sql_queries": [],
    "compliance_kit": { "modules": [] }
  },

  "proviso_metadata": {
    "exported_at": "2026-05-16T14:32:00Z",
    "exported_by": "{{CONSULTANT_NAME}}",
    "proviso_version": "3.1",
    "phase_exported": 1
  }
}
```

### 15.2 Conformity Reference Record

```json
{
  "schema_version": "3.1",
  "record_type": "conformity_layer",
  "id": "conf_001",
  "vault_family": "approbation_family",
  "conformity_type": "conformityapp",
  "imported_at": "2026-05-16",
  "vault_guid": "{C840BE1A-5A3F-4A2E-B9D1-7F3E2C8A9B4D}",
  "mutable": false,
  "config": "TBD — verbatim from GetWorkflowAdmin() on real vault",
  "notes": "Compliance enforcement layer. Import once. Never modify. Always export verbatim. Validates state/transition behaviour for all named workflows in this vault family."
}
```

### 15.3 Dataset Record (Searchable Summary)

```json
{
  "id": "wf_001",
  "record_type": "named_workflow",
  "name": "Approbation Full — Manufacturing FR",
  "industry": "Manufacturing",
  "complexity": "high",
  "erp": "SAP",
  "ocr": "ABBYY",
  "language": "French",
  "state_count": 34,
  "features": [
    "dual_approval",
    "maestro_integration",
    "pdf_stamping",
    "vendor_notification",
    "cross_workflow_to_service_agreement"
  ],
  "cross_workflow_connections": [
    {
      "connects_to": "Service Agreement",
      "at_state": "Approved for Signature",
      "trigger": "conformityapp_change_workflow"
    }
  ],
  "conformity_ref_id": "conf_001",
  "workflow": "{ ...full rich JSON... }",
  "scenario": "Manufacturing company AP invoice approval with Maestro ERP integration, dual approval over €50,000, French state names, connects to Service Agreement workflow at approval stage...",
  "embedding": [0.234, 0.891, 0.445, "..."],
  "created_at": "2026-05-16",
  "version": "1.0"
}
```

### 15.4 Confidence Score Convention

| Range | Source | Action |
| :--- | :--- | :--- |
| 1.00 | Confirmed from real vault JSON | Auto-apply |
| 0.90–0.99 | Clearly structured prose | Auto-apply, no review |
| 0.70–0.89 | Semi-structured prose | Show diff, consultant confirms |
| 0.00–0.69 | Assumption or unknown | Pause — require manual correction |

### 15.5 Open Questions — To Be Answered by Real Vault Import

| Question | Section affected | Priority |
| :--- | :--- | :--- |
| What does Conformity look like in `GetWorkflowAdmin()` COM output? | 5.3, 6.2, Appendix 15.2 | Critical |
| What is the exact JSON structure of a ConformityApp ChangeWorkflow rule? | 5.4, 15.1 | Critical |
| Can cross-workflow connections be triggered via VBScript as well as ChangeWorkflow? | 5.4 | High |
| What exotic StateType enum values exist beyond those already seen? | 6.2 | High |
| What does `dir(state)` reveal — are there properties not yet captured? | 6.2 | High |
| Are there patterns in the production vault not anticipated in this PRD? | All | High |
| What is the correct target_entry_state for each cross-workflow connection? | 15.1 | Medium |

---

*Proviso is a scriptdotnet initiative.*
*Harry Joseph · harry.joseph@xerox.com · scriptdotnet*
*M-Files Certified Solution Engineer — 100/100*
*May 2026 · Version 3.1*

---

*© 2026 scriptdotnet. All rights reserved.*
*From scenario to vault — automatically.*

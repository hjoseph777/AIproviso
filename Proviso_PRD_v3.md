# Proviso
## *From Scenario to Vault — Automatically*
### Product Requirements Document · Version 3.0

> Legacy PRD snapshot.
> Superseded by `Proviso_PRD_v4.md`.
> Keep for architecture history and earlier M-Files-centric direction only.

---

| Field | Detail |
| :--- | :--- |
| **Product** | Proviso — Workflow Ingestion Platform |
| **Version** | 3.0 — Complete Architecture Overhaul |
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
| **3.0** | **Full rewrite — SQLite dataset, RAG, llama.cpp, MemOS agent memory, clean vault strategy, self-improving intelligence layer** |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem We Are Solving](#2-the-problem-we-are-solving)
3. [The Solution — Proviso](#3-the-solution--proviso)
4. [Architecture Overview v3.0](#4-architecture-overview-v30)
5. [Rich JSON — The Missing Ingredient](#5-rich-json--the-missing-ingredient)
6. [Dataset Architecture](#6-dataset-architecture)
7. [AI & LLM Architecture](#7-ai--llm-architecture)
8. [MemOS — Agent Memory Layer](#8-memos--agent-memory-layer)
9. [M-Files Bidirectional Integration](#9-m-files-bidirectional-integration)
10. [UI Architecture — Beta III Command Center](#10-ui-architecture--beta-iii-command-center)
11. [Phase Roadmap](#11-phase-roadmap)
12. [Build Estimate](#12-build-estimate)
13. [Commercial Opportunity](#13-commercial-opportunity)
14. [Appendix — Rich JSON Schema Reference](#14-appendix--rich-json-schema-reference)

---

## 1. Executive Summary

Proviso is an institutional knowledge platform for DMS implementations.

The previous architecture (v0.6–v2.0) focused on single-workflow editing with a manual spreadsheet interface, markdown parsing, and basic COM API export. Version 3.0 is a complete architectural overhaul driven by five key insights:

1. The M-Files COM API supports full bidirectional rich import/export — capturing every state, transition, permission, condition, VBScript, and notification in one call
2. Workflow JSON should be stored in a queryable SQLite dataset with RAG-based retrieval — not as static templates
3. A small local LLM (3B–8B parameters) running via llama.cpp handles all workflow modification tasks offline at zero cost
4. MemOS provides persistent agent memory — the AI remembers consultant decisions across sessions and projects, compounding intelligence over time
5. The complete round-trip — import live vault → AI adapts via natural language → export to clean empty vault — reduces implementation from 2–3 days to under one hour

> *"Describe what the client needs. AI finds the closest match in your dataset, customises it for the new scenario, shows you the diff, and exports a fully configured vault to the GUID you provide. Three interactions. Zero manual entry."*

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

Copying a vault from a previous client appears to save time. In reality it transfers technical debt.

Inherited workflows carry another client's logic. States are disabled rather than removed. Old VBScript references clients that no longer exist. Aliases point to renamed workflows. The result is a **spaghetti diagram nobody fully understands** — fragile under change, error-prone in production. Template reuse does not save time. It borrows it from a future problem.

### 2.3 The Synchronisation Problem

When a client requests a change after deployment, the consultant updates M-Files Admin. But Cacoo now shows the old diagram. The SOW is outdated. The PRD no longer matches. There is no single source of truth. Documentation drift is guaranteed.

### 2.4 The Knowledge Loss Problem

When a senior consultant builds a complex vault — every permission decision, every VBScript pattern, every threshold condition — that knowledge lives in their head. When they leave, it leaves with them. There is no institutional capture mechanism.

### 2.5 Time Cost

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
| **Total per project** | **15–29 hrs** | **~45 min** |

---

## 3. The Solution — Proviso

### 3.1 Describe. AI Finds. AI Customises. Export.

The consultant does not build a workflow from scratch. They describe what the new client needs. AI searches the dataset, finds the closest matching past implementation, customises it for the new scenario, shows a diff for approval, and exports a fully configured vault.

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
  Finds top 3 closest matches:

    1. approbation_v2    94% match
       Manufacturing · SAP · 34 states
       Changes needed: remove Maestro,
       add HIPAA review, threshold → €75k

    2. contract_lifecycle  87% match
       Legal · Dynamics · 12 states
       Changes needed: expand approval path,
       update threshold

    3. invoice_simple    71% match
       Retail · no ERP · 8 states
       Changes needed: add HIPAA review,
       expand approval path

  AI: "Which would you like me to use as the base?"

Interaction 2 — Consultant confirms
  "Use approbation_v2"
        │
        ▼
  AI customises the selected record:
    Removes Maestro states              ✓
    Removes Maestro transitions         ✓
    Removes Maestro VBScript references ✓
    Removes Maestro ConformityApp rules ✓
    Updates threshold 50000 → 75000
      in preconditions                  ✓
      in transition conditions          ✓
      in VBScript code                  ✓
      in notification text              ✓
    Adds HIPAA Review state             ✓
    Updates permissions for healthcare  ✓
    Renames French states to English    ✓

  Diff shown — every change visible
  "Here is what I changed. Review and approve."

Interaction 3 — Consultant approves diff
        │
        ▼
  ┌──► Live diagram draws itself
  ├──► SOW generated automatically
  ├──► PRD generated automatically
  └──► Export to empty vault GUID
       Workflow already drawn
       Permissions already set
       Scripts already embedded
       No redrawing. No re-entry.
```

### 3.2 What Powers Each Step

| Step | What happens | Technology |
| :--- | :--- | :--- |
| Scenario intake | Consultant describes client need | AI prompt bar |
| Dataset search | Find closest matching past implementation | sqlite-vec RAG |
| Match presentation | Top 3 results with explanation of changes needed | LLM + metadata |
| Customisation | AI modifies selected record for new scenario | llama.cpp local LLM |
| Context recall | AI remembers consultant preferences from past projects | MemOS agent memory |
| Diff review | Every change shown as checkbox before applying | Proviso diff engine |
| Diagram | Renders live from approved JSON | Mermaid.js |
| SOW + PRD | Generated from approved JSON | NLP + Claude API |
| Export | Writes to empty vault via GUID | Python + pywin32 COM |

### 3.3 Four Input Paths — All Feed the Same Pipeline

The AI-assisted flow above is the primary path. Three additional paths serve specific situations:

| Tab | Input | Engine | Best for |
| :--- | :--- | :--- | :--- |
| ✦ AI (primary) | Describe scenario in plain English | RAG + local LLM | All new client projects |
| ⊞ Manual | Direct spreadsheet entry | No AI needed | Complete control, simple workflows |
| ◈ NLP | Paste structured scenario document | regex + spaCy + RAG | Existing SOW document |
| ⬡ Cacoo | Diagram ID + API key | Cacoo REST API | Team already has approved Cacoo diagram |

All four paths produce the same `workflow.json`. All four populate the same spreadsheet. All four render the same live diagram. All four export to M-Files the same way.

### 3.4 Why the Dataset is the Core Product

```
After 5 projects:
  5 clean records in dataset
  AI finds ~80% match for new clients
  Customisation takes 10–15 minutes

After 20 projects:
  20 records across industries
  AI finds 90%+ match for almost every client
  Customisation takes 5 minutes

After 50 projects:
  50 records — every industry, every complexity
  AI matches instantly and customises precisely
  New client fully configured in under 15 minutes

The dataset IS the intelligence.
No competitor can replicate it
without the same 50 projects.
This is the moat.
```

### 3.5 The Core Design Principles

- **Describe, don't build** — consultant describes what the client needs, AI does the building
- **Dataset-first** — every new project starts from a proven past implementation, not from scratch
- **JSON is the canonical format** — stays JSON until the last moment of export
- **AI proposes, consultant approves** — diff review before any change is applied
- **Rich import** — captures full vault intelligence, not just the drawing
- **Clean records** — no disabled states, no inherited client logic, purpose-built dataset entries
- **Local-first AI** — runs offline via llama.cpp, no cloud dependency required
- **Adapter pattern** — same core engine works for any DMS that exposes an API

---

## 4. Architecture Overview v3.0

### 4.1 Technology Stack

| Layer | Technology | Purpose | Phase |
| :--- | :--- | :--- | :--- |
| Frontend | React + Electron | Desktop app, three-column UI | All |
| Diagram | Mermaid.js | Live workflow rendering | All |
| COM Bridge | Python + pywin32 | M-Files bidirectional sync | All |
| Local Storage | SQLite + sqlite-vec | Dataset, RAG vectors, conversations | I |
| Production DB | MongoDB Atlas / Supabase | Shared dataset, multi-consultant | III |
| Embedding | nomic-embed-text (local) | RAG vector generation | II |
| Agent Memory | MemOS (local SQLite mode) | Cross-session AI memory, skill evolution | II |
| LLM — default | SmolLM3 3B Q4 via llama.cpp | Fast workflow edits, ~1.8 GB disk | II |
| LLM — balanced | Phi-4-mini 3.8B Q4 via llama.cpp | Better reasoning, ~2.3 GB disk | II |
| LLM — power | Qwen3 8B Q4 via llama.cpp | Complex multi-step modifications | II |
| LLM — reasoning | DeepSeek-R1 7B Q4 via llama.cpp | Chain-of-thought, shows reasoning | II |
| LLM — cloud | Claude API Sonnet 4 | Maximum quality, requires internet | All |
| SOW/PRD | NLP regex + Claude API | Document generation | All |
| Packaging | Electron Builder | proviso.exe installer | III |

### 4.2 The Three-Column Command Center

```
┌─────────────────┬──────────────────────────┬───────────────────┐
│  INPUT (left)   │  LIVE DIAGRAM (centre)   │  AI STUDIO (right)│
│  Resizable      │  Mermaid renders live    │  Hidden by default│
│  Hideable       │  Click node → highlights │  Toggle to reveal │
│                 │  AI prompt bar below     │                   │
│  4 tabs:        │  Conversation history    │  3 tabs:          │
│  Manual         │  Context chips           │  AI Studio        │
│  NLP            │  Stats bar               │  Deliver          │
│  AI             │                          │  Library          │
│  Cacoo          │                          │                   │
└─────────────────┴──────────────────────────┴───────────────────┘
```

---

## 5. Rich JSON — The Missing Ingredient

### 5.1 Why Rich JSON Changes Everything

The M-Files COM API `GetWorkflowAdmin()` returns a complete deep object tree in a single call. Every property of every state and every transition is readable and writable. Proviso captures this entirely.

**Without rich JSON — AI modifies blindly:**
Remove Maestro state from diagram — but VBScript still references Maestro, notifications still fire to the Maestro group, ConformityApp rules still cross into the Maestro workflow. Vault exports broken. Consultant finds errors days later.

**With rich JSON — AI modifies completely:**
Every reference to Maestro is visible across every layer simultaneously. Removed consistently. Vault exports clean. Works first time.

The rich JSON is not a file format. It is the first time a complete M-Files implementation — every decision, every permission, every condition, every script — has been captured in a form that AI can read, reason about, and reuse.

### 5.2 What GetWorkflowAdmin() Returns — Confirmed

| JSON field | COM API source | Phase |
| :--- | :--- | :--- |
| `states[].name` | `StateAdmin.Name` | Phase I ✅ |
| `states[].initial` | `StateAdmin.Initial` | Phase I ✅ |
| `states[].alias` | `StateAdmin.SemanticAliases` | Phase I ✅ |
| `states[].icon_type` | `StateAdmin.StateType` (enum) | Phase I ✅ |
| `states[].description` | `StateAdmin.Description` | Phase I ✅ |
| `transitions[].from/to` | `StateTransition.FromState / ToState` | Phase I ✅ |
| `transitions[].name` | `StateTransition.Name` | Phase I ✅ |
| `states[].preconditions` | `StateAdmin.Preconditions` | Phase II |
| `states[].postconditions` | `StateAdmin.Postconditions` | Phase II |
| `states[].permissions` | `StateAdmin.InOutPermissions` | Phase II |
| `states[].actions.vbscript` | `StateAdmin.ActionRunVBScriptDefinition` | Phase II |
| `states[].actions.pdf` | `StateAdmin.ActionConvertToPDF` | Phase II |
| `states[].actions.notify` | `StateAdmin.ActionSendNotificationDefinition` | Phase II |
| `states[].actions.set_props` | `StateAdmin.ActionSetPropertiesDefinition` | Phase II |
| `transitions[].permissions` | `StateTransition.AccessControlList` | Phase II |
| `transitions[].conditions` | `StateTransition.TriggerConditions` | Phase II |
| `transitions[].trigger_script` | `StateTransition.TriggerScript` | Phase II |
| `addons.conformity` | ConformityVaultApplication config | Phase III |
| `addons.sql_queries` | VaultExtensionMethodOperations | Phase III |
| `addons.compliance_kit` | Compliance Kit module config | Phase III |

### 5.3 The Round-Trip Guarantee

The JSON is always the source of truth. The GUI is a partial view into the JSON. A partial view is fine. A lossy view is never acceptable.

**Every state is created on import — nothing is skipped:**

```python
def import_state(state_admin):
    return {
        # Phase I — rendered in GUI, fully editable
        "name":         state_admin.Name,
        "initial":      state_admin.Initial,
        "alias":        state_admin.SemanticAliases,
        "icon_type":    state_admin.StateType,
        "description":  state_admin.Description,

        # Phase II — stored in JSON, read-only in GUI
        "permissions":    extract_permissions(state_admin),
        "preconditions":  extract_preconditions(state_admin),
        "postconditions": extract_postconditions(state_admin),
        "actions": {
            "vbscript":  extract_vbscript(state_admin),
            "pdf":       state_admin.ActionConvertToPDF,
            "notify":    extract_notification(state_admin),
            "set_props": extract_set_properties(state_admin),
        },

        # Unknown — catch-all, stored verbatim
        "raw_properties": extract_unknown(state_admin),

        # Proviso metadata
        "_source":  "mfiles_import",
        "_phase":   classify_phase(state_admin),
        "_flags":   compute_flags(state_admin),
    }
```

**Export is lossless across all phases:**
- Phase I properties → written to vault immediately
- Phase II properties (no GUI yet) → read from JSON, written back exactly as imported
- Phase III properties (raw JSON) → written back verbatim
- Result: export is lossless even without full GUI coverage

### 5.4 Double-Click State/Transition Detail

Double-clicking any state box or transition arrow opens a detail panel showing the complete rich JSON for that element. Every property, every script, every condition, every permission. Read-only unless in edit mode. This is the review interface before export.

### 5.5 Flag Icons on Spreadsheet Rows

| Flag | Meaning |
| :--- | :--- |
| 🔒 | Has permissions/conditions — stored, Phase II |
| ⚡ | Has VBScript action — stored, Phase II |
| 📧 | Has notification — stored, Phase II |
| ⬡ | Has addon dependency — stored, Phase III |
| ⚠ | Has unknown properties — stored as raw JSON |
| ✦ | Added by AI this session |
| + | Newly created — not from import |

---

## 6. Dataset Architecture

### 6.1 Dataset Not Templates

Proviso does not maintain templates. It maintains a **dataset of rich JSON records** — each representing a complete vault implementation.

| Template approach | Dataset approach |
| :--- | :--- |
| One file to copy and modify | Collection of queryable records |
| Static starting point | AI retrieves what is needed from many |
| Carries previous client logic | Clean, purposeful records only |
| Reuse = inherit mess | Reuse = best of everything combined |
| Gets stale over time | Gets smarter with every project |

### 6.2 Clean Master Records — No Disabled States

Every record in the dataset is **clean and purposeful**. No disabled states. No inherited client-specific logic. No spaghetti.

When importing from a live vault, AI strips all client-specific values before saving to the dataset:

| Client-specific value | Placeholder in dataset record |
| :--- | :--- |
| Bill Ward, Betty Black | `{{CONTRACT_MANAGER}}`, `{{CFO}}` |
| `bill.ward@acme.com` | `{{USER_EMAIL}}` |
| `sap.clientA.com` | `{{ERP_BASE_URL}}` |
| 50000 (threshold) | `{{APPROVAL_THRESHOLD}}` |
| Acme Corporation | `{{CLIENT_NAME}}` |
| `WPS.ClientA.DraftState` | `WPS.{{WORKFLOW_PREFIX}}.DraftState` |

The consultant fills the placeholders for the new client. Everything else is reused exactly.

### 6.3 SQLite Schema — Phase I

SQLite is the correct choice for Phase I. Zero setup, zero infrastructure, zero cost. Ships inside the Electron app as a single file (`proviso.db`). Works completely offline. Migration to MongoDB Atlas requires one connection string change.

```sql
-- Core dataset
CREATE TABLE workflows (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  industry     TEXT,
  complexity   TEXT,  -- low/medium/high/enterprise
  erp          TEXT,
  ocr          TEXT,
  language     TEXT,
  state_count  INTEGER,
  features     TEXT,  -- JSON array of feature tags
  workflow     TEXT,  -- Full rich JSON
  scenario     TEXT,  -- Plain English description for RAG
  embedding    BLOB,  -- Vector for similarity search
  created_at   TEXT,
  version      TEXT
);

-- Client projects — links workflows to implementations
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  client          TEXT,
  consultant      TEXT,
  workflow_id     TEXT,
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

-- ERP vendor configurations
CREATE TABLE erp_configs (
  id       TEXT PRIMARY KEY,
  vendor   TEXT,
  config   TEXT,  -- Rich JSON
  queries  TEXT   -- SQL queries JSON
);

-- OCR vendor configurations
CREATE TABLE ocr_configs (
  id       TEXT PRIMARY KEY,
  vendor   TEXT,
  config   TEXT,  -- Rich JSON
  mappings TEXT   -- Field mappings JSON
);
```

### 6.4 RAG Implementation

Retrieval-Augmented Generation ensures AI suggestions are grounded in proven patterns from past implementations — not invented from scratch.

| Step | Action | Technology |
| :--- | :--- | :--- |
| 1 — Embed query | Convert consultant scenario to vector | nomic-embed-text (local, free) |
| 2 — Search dataset | Find 3–5 most similar past workflows | sqlite-vec similarity search |
| 3 — Build context | Inject similar records into LLM context | Python context builder |
| 4 — Generate | LLM reasons from proven patterns | llama.cpp local model |
| 5 — Diff review | Show proposed changes before applying | Proviso diff engine |
| 6 — Save record | After approval, save to dataset | SQLite insert |

**The dataset grows with every project:**

```
Project 1:   1 record  → limited context
Project 5:   5 records → better matches
Project 20: 20 records → strong patterns
Project 50: 50 records → domain expertise

Passive self-improvement — happens automatically
No extra work required
The dataset IS the intelligence
```

### 6.5 Production Database — Phase III

| Option | Best for | Vector search | Cost |
| :--- | :--- | :--- | :--- |
| SQLite + sqlite-vec | Demo, offline, single consultant | ✅ Built-in | Free |
| Supabase + pgvector | Multi-consultant, web deployment | ✅ Built-in | Free tier |
| MongoDB Atlas Vector | Enterprise, global scale | ✅ Atlas Search | Free tier |
| Qdrant (self-hosted) | Air-gapped secure environments | ✅ Best-in-class | Free |

---

## 7. AI & LLM Architecture

### 7.1 Design Principles

- AI proposes changes — consultant always approves via diff review
- Local-first — all models run via llama.cpp, no internet required
- One line of code to switch between local and cloud
- Context is everything — RAG injects relevant past projects before every call
- Conversation memory — MemOS remembers what changed earlier in the session and across sessions

### 7.2 Model Comparison

| Model | Params | Disk Q4 | RAM | Speed CPU | JSON | French | Reasoning | License |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SmolLM3 3B | 3B | ~1.8 GB | ~2.5 GB | 30 t/s | ✅ Good | ✅ Native | ⭐⭐½ | Apache 2.0 |
| Phi-4-mini 3.8B | 3.8B | ~2.3 GB | ~3 GB | 22 t/s | ✅ Good | ✅ Good | ⭐⭐⭐ | MIT |
| Qwen3 8B | 8B | ~5 GB | ~6 GB | 16 t/s | ✅ Best | ✅ Best | ⭐⭐⭐⭐ | Apache 2.0 |
| DeepSeek-R1 7B | 7B | ~4.1 GB | ~5 GB | 12 t/s | ✅ Good | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | MIT |
| Phi-4 14B | 14B | ~8 GB | ~10 GB | 9 t/s | ✅ Best | ✅ Good | ⭐⭐⭐⭐⭐ | MIT |
| Claude API | Cloud | 0 GB | 0 GB | Fast | ✅ Best | ✅ Best | ⭐⭐⭐⭐⭐ | Commercial |

### 7.3 Recommended Configuration

| Tier | Model | When to use |
| :--- | :--- | :--- |
| Default (ships in app) | SmolLM3 3B Q4_K_M | Standard edits, fast, minimal footprint |
| Balanced | Phi-4-mini 3.8B Q4_K_M | Better reasoning, French vault names |
| Power (optional download) | Qwen3 8B Q4_K_M | Complex multi-step modifications |
| Chain-of-thought | DeepSeek-R1 7B Q4_K_M | High-stakes changes — shows reasoning |
| Cloud fallback | Claude API Sonnet 4 | Maximum quality, internet required |

**All models run on CPU. No GPU required. Any modern laptop with 8 GB+ RAM runs SmolLM3 comfortably.**

### 7.4 Reusable Prompt Library

| Prompt name | Purpose | Context injected |
| :--- | :--- | :--- |
| `EXTRACT_WORKFLOW` | Parse raw SOW → workflow JSON | Schema definition, field rules |
| `ADAPT_WORKFLOW` | Modify existing workflow for new client | Current JSON + RAG results + scenario |
| `CLEAN_FOR_DATASET` | Remove client specifics → master record | Current JSON + placeholder rules |
| `COMPARE_WORKFLOWS` | Diff two workflow JSONs | Two JSON records |
| `GENERATE_SOW` | Write SOW from workflow JSON | Full rich JSON + client details |
| `GENERATE_PRD` | Write PRD from workflow JSON | Full rich JSON + phases |
| `SUGGEST_TEMPLATE` | Find best matching dataset record | Scenario text + dataset metadata |
| `VALIDATE_WORKFLOW` | Check JSON integrity before export | Current JSON + validation rules |

### 7.5 The Complete AI Flow — Dataset First

```
Step 1 — Consultant describes scenario
  "Healthcare company, invoice approval,
   no ERP, €75k threshold, English only"
        │
        ▼
Step 2 — RAG searches dataset
  sqlite-vec similarity search
  Returns top 3 closest records
  AI presents matches with explanation
  "approbation_v2 is 94% similar.
   Changes needed: remove Maestro,
   add HIPAA review, threshold → €75k"
        │
        ▼
Step 3 — Consultant selects base record
  "Use approbation_v2"
        │
        ▼
Step 4 — MemOS retrieves consultant preferences
  "Harry prefers English state names"
  "Harry always removes Maestro for healthcare"
  "Harry adds compliance review before signing"
        │
        ▼
Step 5 — AI customises selected record
  Reads COMPLETE rich JSON — every layer:
    Removes Maestro states              ✓
    Removes Maestro VBScript references ✓
    Removes Maestro ConformityApp rules ✓
    Updates threshold 50000 → 75000
      in preconditions                  ✓
      in transition conditions          ✓
      in VBScript code                  ✓
      in notification text              ✓
    Adds HIPAA Review state             ✓
    Renames French states to English    ✓
        │
        ▼
Step 6 — Diff shown to consultant
  Every change is a checkbox
  Add/remove/modify tagged
  Warnings flagged
  Consultant approves
        │
        ▼
Step 7 — Everything generates
  Diagram draws ✓
  SOW written ✓
  PRD written ✓
  Export to empty vault GUID ✓
  New record saved to dataset ✓
```

### 7.6 Self-Improvement Mechanisms

**Mechanism 1 — Passive dataset accumulation (starts now)**
Every export saves a record. RAG retrieves better matches as dataset grows. Zero extra work.

**Mechanism 2 — Feedback loop (Phase II)**
Every AI response is rated 👍 👎. Every correction is captured. Patterns identified. Prompts refined automatically.

**Mechanism 3 — MemOS agent memory (Phase II)**
See Section 8.

**Mechanism 4 — Fine-tuning (Phase IV)**
After 50+ projects: curated dataset of input/output pairs, fine-tune Qwen3 8B on M-Files domain data using Unsloth LoRA. Proprietary domain model. No competitor can replicate without the same project history.

---

## 8. MemOS — Agent Memory Layer

### 8.1 What MemOS Is

MemOS (Memory Operating System) is an open-source self-evolving memory system for LLM agents. It provides ultra-persistent memory, hybrid retrieval, and cross-task skill reuse — with 35% token savings compared to full-context approaches.

MemOS Local Plugin (v1.0.0) runs **100% on-device** with persistent SQLite, hybrid search (FTS5 + vector), task summarization, skill evolution, and a Memory Viewer dashboard. No cloud dependency. Ships inside Electron.

### 8.2 Why MemOS Over Alternatives

| Library | Stars | Local SQLite | Skill evolution | Self-improving | License |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MemOS** | Growing fast | ✅ Native | ✅ Yes | ✅ Yes | Apache 2.0 |
| Mem0 | 55k+ | ✅ Via Chroma | ❌ No | ❌ No | Apache 2.0 |
| SimpleMem | Growing | ✅ Yes | ❌ No | ✅ EvolveMem v3 | Apache 2.0 |
| ReMe | Growing | ✅ File-based | ❌ No | ❌ No | Apache 2.0 |

MemOS is selected because it combines persistent SQLite storage, hybrid retrieval, and skill evolution — the self-improving capability needed for Proviso's compounding intelligence model.

### 8.3 Three Memory Levels for Proviso

**Level 1 — Consultant memory (cross-session)**
```
MemOS remembers across sessions:
  "Harry prefers English state names
   even for French client vaults"
  "Harry always removes Maestro for
   healthcare clients"
  "Harry adds Director Escalation state
   for enterprise clients"
  "Client B uses Dynamics 365 with
   Suppliers table naming"
```

**Level 2 — Project memory (within project)**
```
MemOS remembers per project:
  Every AI decision made this project
  Every correction the consultant made
  Every approach that failed
  Why certain states were kept or removed

Next session on same project:
  AI picks up exactly where left off
  No re-explaining context
  No re-pasting the scenario
```

**Level 3 — Skill evolution (across all projects)**
```
MemOS skill evolution learns patterns:
  "When vault has Maestro integration
   it always has these 8 states"
  "Healthcare clients always need
   a compliance review state"
  "€50k threshold always appears in
   exactly these 3 JSON locations"
  "French vaults always use WPS. prefix
   for state aliases"

These are facts MemOS discovers automatically
from the accumulated project history
```

### 8.4 MemOS Integration

```python
from memos import MemOS

# Initialize with local SQLite — fully offline
memos = MemOS(
    storage="sqlite",
    db_path="./proviso_memory.db",
    embedding_model="nomic-embed-text",  # same as RAG
    llm="ollama/qwen3:8b",              # same as Proviso LLM
    enable_skill_evolution=True
)

# After every AI interaction — save to MemOS
memos.add(
    content=f"Consultant instruction: {scenario}\nAI response: {ai_response}",
    user_id="harry.joseph",
    project_id=current_project,
    metadata={
        "workflow": workflow_name,
        "action": action_type,
        "approved": consultant_approved
    }
)

# Before every AI call — retrieve relevant memories
memories = memos.search(
    query=current_scenario,
    user_id="harry.joseph",
    limit=5
)

# Inject into AI system prompt alongside RAG results
context = build_context(rag_results, memories, current_json)
```

### 8.5 MemOS + RAG — Complementary Roles

```
Proviso RAG:
  Searches the DATASET
  Finds similar WORKFLOWS
  "Find the closest past vault
   to this new client scenario"
  → Returns rich JSON records

MemOS memory:
  Remembers DECISIONS and PATTERNS
  "What did the consultant prefer
   last time a similar situation arose?"
  → Returns consultant knowledge

Together:
  RAG finds the right workflow   ← dataset
  MemOS applies the right patterns ← memory
  AI combines both               ← best suggestion
```

---

## 9. M-Files Bidirectional Integration

### 9.1 The COM API is Fully Bidirectional

The same authenticated Python bridge supports both directions:

```
Export (already working ✅):
  AddWorkflowAdmin() + UpdateWorkflowAdmin()

Import (same bridge, opposite call):
  GetWorkflows() + GetWorkflowAdmin()
  + GetWorkflowStateTransitionsAsJSON()
```

### 9.2 Import from M-Files — Step by Step

1. Connect to vault — server, GUID, username, password
2. Call `GetWorkflows()` — lists all available workflows
3. Select up to 6 workflows to import
4. Call `GetWorkflowAdmin()` for each — deep read returns complete rich object tree
5. Map StateAdmin tree to Proviso rich JSON
6. Create one tab per imported workflow
7. Conflict resolution — if name exists: create new tab named `workflow_name (imported YYYY-MM-DD)`
8. Flag icons appear on rows with Phase II/III properties

### 9.3 Export to M-Files — Step by Step

1. Create **empty vault** in M-Files Admin
2. Copy vault GUID from Properties
3. Paste GUID into Proviso connection panel
4. Proviso validates vault is empty — warns if existing workflows detected
5. Select workflows to export (up to 6)
6. Proviso calls `AddWorkflowAdmin()` for each
7. All Phase I properties written — names, aliases, icons, transitions
8. Phase II properties written if available
9. Proviso writes fingerprint to vault Custom Data — tracks export history

**Why an empty vault:**

A clean empty vault means no conflicts, no existing aliases to overwrite, no existing permissions to corrupt. Proviso writes to a blank canvas. Everything lands exactly as designed. No risk to any live client data.

### 9.4 What Exports in Each Phase

| Property | Phase I | Phase II | Phase III |
| :--- | :--- | :--- | :--- |
| State names + aliases | ✅ | ✅ | ✅ |
| State icons / types | ✅ | ✅ | ✅ |
| Transition connections | ✅ | ✅ | ✅ |
| Preconditions / Postconditions | Stored only | ✅ Exported | ✅ |
| Permissions per state | Stored only | ✅ Exported | ✅ |
| VBScript actions | Stored only | ✅ Exported | ✅ |
| Notifications | Stored only | ✅ Exported | ✅ |
| ConformityApp rules | Stored only | Stored only | ✅ Exported |
| SQL queries | Stored only | Stored only | ✅ Exported |
| Cross-workflow transitions | Stored only | Stored only | ✅ Exported |

### 9.5 Up to 6 Workflows Simultaneously

```
DELIVER PANEL
─────────────────────────────────────────────

EXPORT TO M-FILES
  ☑ Service Agreement
  ☑ NDA Lifecycle
  ☑ Approbation
  ☐ (empty)
  ☐ (empty)
  ☐ (empty)
  [→ Push selected to vault]

─────────────────────────────────────────────

IMPORT FROM M-FILES
  [Fetch available workflows]

  Workflows found in vault (8):
  ☑ Approbation
  ☑ BL
  ☐ Maestro
  ☐ PO_Archive
  ☐ Statement
  ☐ Invoice in Archive
  ☐ Statement_Line
  ☐ BonCommande

  [← Pull selected into Proviso tabs]
```

---

## 10. UI Architecture — Beta III Command Center

### 10.1 Three-Column Layout

**Column 1 — Input (left, resizable 200–600px, hideable)**
Four tabs: Manual spreadsheet / NLP guided zones / AI extract / Cacoo import. Drag the resizer to adjust width. Hide/show toggle in topbar.

**Column 2 — Live Diagram (centre, focal point)**
Mermaid diagram draws live as states are entered. Click a node → highlights the corresponding spreadsheet row. AI prompt bar below. Conversation history above the bar. Context chips showing active model and template. Stats bar at bottom.

**Column 3 — AI Studio / Deliver / Library (right, hidden by default)**
Toggle reveals three tabs:
- **AI Studio** — context builder, diff drawer, prompt history
- **Deliver** — M-Files export/import, SOW/PRD generation
- **Library** — dataset browser showing proviso_master/ folder

### 10.2 AI Prompt Bar

Sits permanently below the diagram. Always visible. Natural language input. Conversation history above it. Three context chips: active model, active template, safety mode (diff required toggle).

```
┌─────────────────────────────────────────────────┐
│ ⚙ Qwen3 8B · local  │ 📚 approbation_v2  │ 🛡 Diff │
├─────────────────────────────────────────────────┤
│ You: Remove Maestro integration                 │
│ AI: Removed 8 states, rewired 4 transitions.   │
│     Review diff in AI Studio →                 │
├─────────────────────────────────────────────────┤
│ ✦ Proviso AI  [type your instruction here...  ] │
│                                       [Send ↗]  │
└─────────────────────────────────────────────────┘
```

### 10.3 Diff Drawer

Every AI-proposed change is a checkbox. Add/remove/modify tagged individually. Warnings shown before applying. Consultant selects which changes to apply. Nothing is applied silently.

```
┌─ Pending changes ─────────────────── 3 changes ─┐
│ ☑ + add   State: Director Escalation added      │
│ ☑ + add   Transition: Pending → Escalation      │
│ ☑ ~ mod   Condition: days_in_state > 5 (Ph.2)  │
│                                                  │
│ ⚠ Verify alias WPS.Approval.escalation          │
│   after export                                   │
├──────────────────────────────────────────────────┤
│ [✗ Reject all]          [✓ Apply selected]       │
└──────────────────────────────────────────────────┘
```

### 10.4 Workflow Tabs

Up to six workflow tabs across the top. Each tab has its own spreadsheet, diagram, AI conversation, and diff queue independently. Multi-workflow vault import creates one tab per workflow automatically.

---

## 11. Phase Roadmap

### Phase I — Foundation · Rich Import/Export + SQLite Dataset

**Objective:** Complete bidirectional M-Files sync with rich JSON. Local SQLite dataset. Demo-quality. Show Michel.

| Feature | Status |
| :--- | :--- |
| Three-column Command Center UI | ✅ Built |
| Four input tabs (Manual/NLP/AI/Cacoo) | ✅ Built |
| Live Mermaid diagram | ✅ Built |
| SOW + PRD auto-generation | ✅ Built |
| Claude API integration | ✅ Built |
| Workflow export to M-Files (skeleton) | ✅ **POC confirmed working** |
| Rich COM API import — deep read | 🔨 In progress |
| Multi-tab architecture (up to 6 workflows) | 🔨 In progress |
| SQLite schema + integration | 📋 Planned |
| Double-click state/transition detail panel | 📋 Planned |
| Flag icons (🔒 ⚡ 📧 ⬡) on rows | 📋 Planned |
| Conflict resolution on import | 📋 Planned |
| Phase II property storage (read-only) | 📋 Planned |
| Export lossless guarantee | 📋 Planned |
| Dataset record save on export | 📋 Planned |

**Timeline:** 10–12 weeks at 10–15 hrs/week · ~3 months

---

### Phase II — AI Studio · Local LLM + RAG + MemOS

**Objective:** Embedded local LLM via llama.cpp. RAG retrieval. MemOS agent memory. AI prompt bar. Full diff review.

| Feature | Description |
| :--- | :--- |
| llama.cpp integration | SmolLM3 3B embedded in Electron, runs on CPU |
| Model selector | Settings toggle: SmolLM3 / Phi-4-mini / Qwen3 8B / DeepSeek-R1 / Claude API |
| sqlite-vec RAG | Vector embeddings in SQLite, similarity search |
| nomic-embed-text | Local embedding model — offline, free |
| MemOS local plugin | Cross-session agent memory, skill evolution, SQLite backend |
| AI prompt bar | Natural language input below diagram, conversation history per tab |
| Diff drawer | Checkbox per change, add/remove/modify tagged, warnings |
| Feedback loop | 👍 👎 rating, correction capture, prompt refinement |
| Reusable prompt library | 8 named prompts for all AI operations |
| Permission + VBScript export | Phase II properties written to M-Files |
| Phase II GUI | Permissions editor, conditions editor, VBScript viewer |
| Dataset save on export | Every implementation saved as record automatically |

**Timeline:** 18–20 weeks at 10–15 hrs/week · ~5 months

---

### Phase III — Commercial · Electron App + MongoDB + Multi-DMS

**Objective:** Packaged `proviso.exe` installer. Shared dataset. SharePoint and OpenText adapters.

| Feature | Description |
| :--- | :--- |
| proviso.exe installer | Electron Builder — includes llama.cpp + SmolLM3 model |
| MongoDB Atlas migration | Shared dataset for multi-consultant teams |
| SharePoint adapter | Same COM pattern applied to SharePoint |
| OpenText adapter | OpenText Content Server API integration |
| ConformityApp export | ChangeWorkflow rules and cross-workflow transitions |
| SQL query export | ERP SQL queries embedded in VBScript actions |
| Air-gapped deployment | Full offline mode — zero internet |
| Partner licensing | Per-consultant pricing for M-Files partner firms |

**Timeline:** 20–24 weeks at 10–15 hrs/week · ~5–6 months

---

### Phase IV — Intelligence Platform · ERP/OCR + Self-Improving

**Objective:** Full ERP and OCR integration. Fine-tuned domain model. Complete SOW-to-go-live automation.

| Feature | Description |
| :--- | :--- |
| ERP mapper | Import SQL queries and Postman collections, map fields to M-Files |
| OCR mapper | Import OCR vendor configs, map extracted fields, confidence thresholds |
| Readiness checklist | Pre-export validation — every green = export, warnings = review |
| Automated test runner | Authenticates as each user persona, validates all transitions |
| Compliance report PDF | Auto-generated test evidence — certification-ready output |
| Fine-tuning pipeline | 50+ project records → fine-tune Qwen3 8B on M-Files domain data |
| EvolveMem upgrade | MemOS self-evolving retrieval — discovers new patterns automatically |
| Project lineage | Every implementation traces back to source dataset record |

**Timeline:** 16–20 weeks · ~4–5 months

---

## 12. Build Estimate

### Part-Time Solo (10–15 hrs/week alongside Xerox)

| Phase | Scope | Hours | Calendar time |
| :--- | :--- | :--- | :--- |
| Phase I | Rich import/export, multi-tab, SQLite, detail panel | 120–150 hrs | 3 months |
| Phase II | llama.cpp, RAG, MemOS, AI prompt bar, diff engine | 200–250 hrs | 5 months |
| Phase III | Electron, MongoDB, SharePoint adapter | 200–280 hrs | 5–6 months |
| Phase IV | ERP/OCR, fine-tuning, test runner | 160–200 hrs | 4–5 months |
| **Total** | | **680–880 hrs** | **17–19 months** |

### With Additional Resource (Philippe or part-time developer)

| Phase | Solo | With help | Saving |
| :--- | :--- | :--- | :--- |
| Phase I | 3 months | 2 months | 1 month |
| Phase II | 5 months | 3 months | 2 months |
| Phase III | 6 months | 3–4 months | 2–3 months |
| Phase IV | 5 months | 3 months | 2 months |
| **Total** | **~18 months** | **~11–12 months** | **~6–7 months** |

### The Critical Near-Term Milestone

**12 weeks from today — Phase I demo quality:**
- Rich import working on real vault
- Multi-tab working
- SQLite saving records
- Double-click detail panel
- Clean polished demo

**This is the demo that changes the conversation with Michel.** Everything else follows from that conversation.

---

## 13. Commercial Opportunity

### 13.1 Market

The global document management system market with workflow automation is projected to reach $19.2–24.3 billion by 2032, growing at 9–16% CAGR. No direct competitor to Proviso exists anywhere in this market.

M-Files itself is investing heavily in AI (Aino — their end-user AI layer). This means more enterprise clients, more complex implementations, more demand for consultants. Proviso is the implementation tool that delivers those AI-ready vaults. M-Files grows the market. Proviso captures the efficiency.

### 13.2 Competitive Moat

- No tool automates DMS workflow provisioning bidirectionally — import live vault, AI adapts, export configured vault
- The dataset grows with every project — after 30 projects the RAG context outperforms any competitor starting fresh
- MemOS skill evolution captures patterns no competitor has unless they have the same project history
- Local LLM + offline mode qualifies for banks, government, healthcare, defence — markets cloud-dependent tools cannot enter
- Adapter pattern means one codebase serves all DMS platforms — M-Files today, SharePoint/OpenText tomorrow
- Institutional knowledge capture — senior expertise becomes reusable by junior consultants permanently

### 13.3 Licensing Model

| Tier | Target | Features | Pricing |
| :--- | :--- | :--- | :--- |
| Solo | Independent consultant | Full app, SQLite, local LLM, 1 user | One-time license |
| Team | Partner firm 2–10 | MongoDB shared dataset, multi-user | Per-seat annual |
| Enterprise | Large SI firms | Air-gapped, fine-tuned model | Enterprise annual |
| Platform | DMS vendors | White-label, embedded in vendor product | Revenue share |

### 13.4 Transferability

Proviso is not an M-Files tool. Proviso is a DMS implementation platform that currently has an M-Files adapter.

The knowledge, the dataset, the LLM, the MemOS memory, the RAG pipeline — all of it transfers to any DMS Xerox or any partner firm chooses to adopt in the future. SharePoint. OpenText. Laserfiche. Any platform with an API.

**The investment is not in M-Files support. It is in the platform architecture. That investment compounds across every DMS anyone ever implements.**

---

## 14. Appendix — Rich JSON Schema Reference

### 14.1 Complete Workflow Record

```json
{
  "schema_version": "3.0",
  "name": "Approbation",
  "source_vault": "{C840BE1A-5A3F-4A2E-B9D1-7F3E2C8A9B4D}",
  "imported": "2026-05-16",
  "richness": "phase_1",

  "states": [
    {
      "name": "Pending Approval",
      "initial": false,
      "alias": "WPS.Approbation.PendingApproval",
      "icon_type": 1,
      "description": "Awaiting executive sign-off",
      "_flags": ["🔒", "⚡", "📧"],
      "_phase": "phase_2_stored",

      "preconditions": [
        {
          "property": "Contract Value",
          "property_id": 1189,
          "operator": ">",
          "value": 50000
        }
      ],
      "actions": {
        "convert_to_pdf": false,
        "notify": {
          "users": ["CEO", "CFO"],
          "message": "Approval required"
        },
        "set_properties": [
          { "property": "Approval Status", "value": "Pending" }
        ],
        "vbscript": "' VBScript text here — stored verbatim"
      },
      "permissions": {
        "view":   ["All Staff"],
        "edit":   ["Contract Managers"],
        "delete": ["Administrators"]
      }
    }
  ],

  "transitions": [
    {
      "from": "Reviewed",
      "to": "Pending Approval",
      "name": "Submit for Approval",
      "alias": "WPT.Approbation.SubmitApproval",
      "permissions": ["Contract Managers"],
      "conditions": [
        {
          "property": "Contract Value",
          "operator": ">",
          "value": 50000
        }
      ],
      "trigger_script": ""
    }
  ],

  "addons": {
    "conformity": {
      "change_workflows": [],
      "change_classes": []
    },
    "sql_queries": [],
    "compliance_kit": { "modules": [] }
  },

  "proviso_metadata": {
    "exported_at": "2026-05-16T14:32:00Z",
    "exported_by": "Harry Joseph",
    "proviso_version": "3.0",
    "phase_exported": 1
  }
}
```

### 14.2 Dataset Record

```json
{
  "id": "wf_001",
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
    "cross_workflow_transitions"
  ],
  "workflow": "{ ...full rich JSON... }",
  "scenario": "Manufacturing company AP invoice approval with
               Maestro ERP integration, dual approval over
               €50,000, French state names throughout...",
  "embedding": [0.234, 0.891, 0.445, "..."],
  "created_at": "2026-05-16",
  "version": "1.0"
}
```

### 14.3 Confidence Score Convention

| Range | Source | Action |
| :--- | :--- | :--- |
| 1.00 | MD table / structured zone | Auto-apply, no review |
| 0.90–0.99 | Clearly structured prose | Auto-apply, no review |
| 0.70–0.89 | Semi-structured prose | Show diff, consultant confirms |
| 0.00–0.69 | Complex conditional prose | Pause — require manual correction |

---

*Proviso is a scriptdotnet initiative.*
*Harry Joseph · harry.joseph@xerox.com · scriptdotnet*
*M-Files Certified Solution Engineer — 100/100*
*May 2026 · Version 3.0*

---

*© 2026 scriptdotnet. All rights reserved.*
*From scenario to vault — automatically.*

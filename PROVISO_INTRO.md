# Proviso — Workflow Ingestion for M-Files

### Phase I · Proof of Concept

**Live Demo:** [provisio-theta.vercel.app](https://provisio-theta.vercel.app/)

---

## The Problem We're Solving

Today, every M-Files workflow deployment requires **triple entry** — the same logic written three times, in three different places, by hand:

| Step | Manual Task | Risk |
|------|------------|------|
| 1 | Write the SOW document | Misinterpretation |
| 2 | Draw a workflow diagram | Drift from SOW |
| 3 | Rebuild it in M-Files Admin | Fat-finger errors |

Each step is disconnected. A change in one doesn't update the others. Mistakes compound. Consultants spend hours clicking through admin screens reproducing what's already on paper.

**Proviso eliminates all three steps and replaces them with one.**

---

## The Solution: SOW-to-Vault Automation

The SOW spreadsheet becomes the **single source of truth**. Everything else — the diagram, the PRD, the vault configuration — is generated automatically from that one input.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   SOW Spreadsheet  ──→  Live Diagram  ──→  PRD Document        │
│        (input)          (auto-generated)   (auto-generated)     │
│            │                                                    │
│            └──────────────→  M-Files Vault                      │
│                              (auto-ingested via COM API)        │
│                                                                 │
│   One input. Four outputs. Zero re-entry.                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
        Spreadsheet (React UI)
              │
              ▼
        workflow.json  ◄── the single source of truth
              │
     ┌────────┼────────────────┐
     ▼        ▼                ▼
  Diagram    PRD (.md)     M-Files Vault
  (Mermaid)  (NLP output)  (COM API)
```

### How It Works (3 Steps)

**Step 1 — SOW Editor**
Define states, transitions, users, and properties in a structured spreadsheet. A live Mermaid diagram renders in real time as you type. If the logic looks wrong in the picture, you fix it in the spreadsheet — immediately.

**Step 2 — Generate PRD**
Local NLP (regex + pattern matching) transforms the technical spreadsheet data into a client-ready Product Requirements Document. An AI-enhanced option via Claude is available for more complex narrative requirements.

**Step 3 — Ingest Workflow**
The COM API takes the workflow JSON and writes the structure directly into the M-Files Vault — states, transitions, and aliases — in seconds. The consultant then opens M-Files Admin and adds only the business rules and conditions.

---

## Why This Is a Game-Changer

### 1. Zero Redundancy
You build the SOW once. The diagram, PRD, JSON, and vault configuration are all **byproducts** of that single effort. No remapping. No re-entry. No copy-paste.

### 2. Zero Drift
The diagram is generated from the SOW. The vault is generated from the SOW. They cannot go out of sync because they share the same source. What the client approved is exactly what gets built.

### 3. Zero Fat-Finger Errors
Manual data entry into M-Files Admin is replaced by automated ingestion. If the SOW says 11 states and 15 transitions, the vault gets exactly 11 states and 15 transitions — no typos, no missed connections, no orphaned states.

### 4. Instant Iteration
Customer changes their mind about a "Review" state? Change one cell in the spreadsheet. The diagram updates. The PRD updates. The vault configuration updates. What used to take an hour takes seconds.

### 5. Client Transparency
Clients see a clean, professional workflow diagram early in the engagement — tied directly to the SOW they signed. There is no gap between what was promised and what gets delivered.

### 6. Consultant Productivity
Consultants stop spending time on mechanical data entry and start spending time on what matters: business rules, permissions, and client-specific logic. Proviso handles the scaffolding — the consultant handles the intelligence.

---

## Time Savings Estimate

| Task | Before (Manual) | After (Proviso) | Saved |
|------|-----------------|-----------------|-------|
| Define workflow states + transitions | 45–60 min | 5 min (spreadsheet) | **~50 min** |
| Draw workflow diagram | 30–45 min | 0 min (auto-generated) | **~35 min** |
| Write PRD documentation | 60–90 min | 1 min (NLP-generated) | **~75 min** |
| Configure M-Files Admin | 60–120 min | 30 sec (COM API) | **~90 min** |
| Rework after client changes | 30–60 min per change | 2 min per change | **~45 min** |
| **Total per workflow** | **4–6 hours** | **~10 minutes** | **~5 hours** |

For a typical project with 2–3 workflows, that's **10–15 hours saved per engagement.**

---

## Phase I Scope

This proof of concept focuses on the **backbone** — ensuring that a state defined in the editor successfully appears as a state in the vault.

| In Scope (Phase I) | Out of Scope (Phase II) |
|--------------------|------------------------|
| ✅ Workflow creation | ❌ Business rules / conditions |
| ✅ State definitions | ❌ Automatic state transitions |
| ✅ Transition mapping | ❌ Permission assignments |
| ✅ Alias assignment | ❌ Script-based triggers |
| ✅ Live diagram preview | ❌ Multi-workflow orchestration |
| ✅ PRD generation (NLP + AI) | ❌ Class/object type creation |

Phase II adds the intelligence layer — conditions, permissions, and automated rules — on top of the proven Phase I scaffold.

---

## Technology

| Component | Stack |
|-----------|-------|
| Frontend | React 18 · Vite · Mermaid.js |
| Data Format | JSON — spreadsheet converts to `workflow.json`, the single data object that drives the diagram, PRD, and vault ingestion |
| PRD Output | Markdown (`.md`) — generated from JSON by the NLP engine |
| PRD Engine | Local NLP (regex + pattern matching) · Claude AI (optional) |
| Vault Ingestion | Python · Flask · pywin32 · M-Files COM API |
| Hosting (demo) | Vercel |

---

**Live Demo → [provisio-theta.vercel.app](https://provisio-theta.vercel.app/)**

*Author: Harry Joseph · Phase I POC · May 2026*

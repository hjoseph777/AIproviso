# proviso

**M-Files Workflow Ingestion — SOW to Vault**

> Phase 1 POC · States + Transitions · No Rules · No Conditions

## What It Does

Proviso lets M-Files consultants define workflow structures in a spreadsheet-style editor, preview them as live diagrams, generate PRD documentation, and ingest the skeleton directly into an M-Files vault via the COM API.

### 3-Step Flow

1. **SOW Editor** — Define states, transitions, users, properties, and business rules in an interactive spreadsheet. Live Mermaid diagram updates as you type.
2. **Generate PRD** — Auto-generate a Product Requirements Document using local NLP (regex + pattern matching) or AI-enhanced mode (Claude API).
3. **Ingest Workflow** — Connect to an M-Files vault and push the workflow skeleton via COM API. The consultant then opens M-Files Admin to add conditions and rules.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Diagram | Mermaid.js (CDN) |
| Fonts | JetBrains Mono + Fraunces |
| Backend (local) | Flask + pywin32 (COM API) |
| Deployment | Vercel (demo) |

## Run Locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
# Push to GitHub, then:
# 1. Import repo on vercel.com
# 2. Framework: Vite
# 3. Deploy
```

## Note

The Vercel deployment is a **frontend demo only**. Real vault ingestion requires:
- Windows machine with M-Files Desktop installed
- Flask backend running locally with pywin32
- COM API access to the target vault

---

*Built by scriptdotnet · © 2026*

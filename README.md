# Proviso — SOW to Vault

**M-Files Workflow Ingestion · Native Electron Desktop App**

> Phase 1 complete · States + Transitions · Zod validated · COM API verified

## What It Does

Proviso lets M-Files consultants define workflow structures in a spreadsheet-style
editor, preview them as live diagrams, generate PRD documentation, and ingest the
workflow skeleton directly into an M-Files vault via the native Windows COM API —
all without touching M-Files Desktop or requiring admin credentials.

### 3-Step Flow

1. **SOW Editor** — Define states, transitions, users, properties, and business
   rules in an interactive spreadsheet. Live Mermaid diagram updates as you type.
   Zod schema validates referential integrity (no dangling transitions, one initial
   state) before allowing push.

2. **Generate PRD** — Auto-generate a Product Requirements Document using local
   NLP (regex + pattern matching) or AI-enhanced mode (Claude API).

3. **Ingest Workflow** — Connect to an M-Files vault via `MFilesServerApplication`
   (server-side COM — works while M-Files Desktop is open) and push the workflow
   skeleton. Open M-Files Admin to configure conditions, ACLs, and rules (Phase 2).

## Tech Stack

| Layer        | Technology                          |
|:-------------|:------------------------------------|
| Shell        | Electron 42 (native Windows app)    |
| Frontend     | React 18 + Vite 6                   |
| State        | Zustand 5 + Zod 4 validation        |
| Diagram      | Mermaid.js (CDN)                    |
| Fonts        | JetBrains Mono + Fraunces           |
| COM Bridge   | PowerShell + MFilesAPI (server-side)|

## Run (Desktop)

```bash
npm install
npm run electron:dev
```

## Build Installer

```bash
npm run electron:build   # outputs NSIS .exe to dist-electron/
```

## Scripts

| Script | Purpose |
|:---|:---|
| `scripts/push-to-vault.ps1` | Push workflow JSON → M-Files vault via COM |
| `scripts/test-connection.ps1` | Test vault connectivity (used by Connect button) |
| `scripts/verify-vault.ps1` | List all workflows in vault (diagnostic) |

## M-Files Requirements

- Windows machine with M-Files Server or Desktop installed
- `MFilesAPI.MFilesServerApplication` COM class registered
- Vault GUID: `{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}` (Acme Corp)
- Authentication: Windows SSO (default) or M-Files credentials

## Phase 2 Roadmap

- [ ] Transition ACLs (`StateTransition.AccessControlList`)
- [ ] State preconditions (`StateAdmin.Preconditions`)
- [ ] Property definitions → vault metadata card
- [ ] User/group → vault login account mapping
- [ ] Cacoo XML diagram import (`backend/app.py`)

---

*Proviso · Xerox · 2026*

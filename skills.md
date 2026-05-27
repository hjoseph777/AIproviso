# Proviso Core — Master Prompt & Architecture Notes

## Reboot Handoff — 2026-05-26

### Session Closeout — Canvas / Semantic Lens Stop Point

- The workflow canvas direction is now settled: the correct visual language is a canvas-level atmospheric starfield and blueprint grid, not node-pinned stars.
- The node-badge "Shiny Stars" experiment was intentionally removed from the live designer after confirming it fought the workflow instead of supporting it.
- The live canvas in [src/App.jsx](c:/Users/Owner/Xerox/AIproviso/src/App.jsx) now carries the merged look from the old mockup:
  - darker integrator-style base gradient
  - subtle dotted/star field integrated into the background
  - clearer blueprint grid structure
  - slightly increased contrast for better separation
- The designer in [src/components/CommandCenter.jsx](c:/Users/Owner/Xerox/AIproviso/src/components/CommandCenter.jsx) still retains the foundational semantic translation slice underneath:
  - canonical workflow IR helper
  - compile projection to XState metadata
  - compile projection to n8n metadata
- Important clarification for tomorrow:
  - "Shiny Stars" should now mean the canvas atmosphere and semantic depth of the surface, not floating badges attached to every node.
  - Runtime/target specificity should surface through overlays, inspectors, and compiled detail panels, not decorative node markers.

### Current Build State

- The AP shell in [src/App.jsx](c:/Users/Owner/Xerox/AIproviso/src/App.jsx) is no longer purely mock-driven.
- The current AP GUI is considered visually solid and acceptable as the working baseline for the next backend validation pass.
- The frontend now calls a shared API client in [src/lib/api.js](c:/Users/Owner/Xerox/AIproviso/src/lib/api.js).
- The workflow designer in [src/components/CommandCenter.jsx](c:/Users/Owner/Xerox/AIproviso/src/components/CommandCenter.jsx) now supports semantic view modes: `Business`, `Runtime`, and `Target`.
- These view modes keep the Proviso-native model as the source of truth while exposing runtime and engine-specific overlays on demand.
- Vite dev proxy support was added in [vite.config.js](c:/Users/Owner/Xerox/AIproviso/vite.config.js) for `/api` and `/health`.
- The legacy Cacoo import path has been removed from the active renderer, Electron bridge, and Flask backend so Proviso remains the single source of truth.
- The Flask backend in [backend/app.py](c:/Users/Owner/Xerox/AIproviso/backend/app.py) now includes:
  - `GET /api/dashboard/summary`
  - `GET /api/invoices`
  - `POST /api/invoices/:id/approve`
  - `POST /api/invoices/:id/review`
- Backend endpoints are designed to use Postgres when available and fall back to dev invoice data when the DB path is unavailable.

### Validation Completed

- [backend/app.py](c:/Users/Owner/Xerox/AIproviso/backend/app.py) passes editor diagnostics.
- `python -m py_compile app.py` passed.
- `npm run build` passed after wiring the frontend to the API.
- `npm run build` passed again after removing the Cacoo mode and bridge.
- `npm run build` passed after adding the initial canonical workflow IR + XState/n8n compile projection helpers in [src/components/CommandCenter.jsx](c:/Users/Owner/Xerox/AIproviso/src/components/CommandCenter.jsx).
- `npm run build` passed after removing node-pinned badge stars and moving the visual treatment back into the shared canvas background in [src/App.jsx](c:/Users/Owner/Xerox/AIproviso/src/App.jsx).
- `npm run build` passed after the final canvas polish pass that increased contrast and reinforced the blueprint grid in [src/App.jsx](c:/Users/Owner/Xerox/AIproviso/src/App.jsx).

### Current Blockers

- Docker is not usable on this Windows machine yet.
- `docker version` shows the CLI is installed, but the Linux engine pipe is missing:
  - `npipe:////./pipe/dockerDesktopLinuxEngine`
- The Windows service `com.docker.service` is running, but Docker Desktop’s Linux backend is not actually available.
- Local Python fallback validation also hit environment issues:
  - `.venv` did not have backend dependencies installed
  - `psycopg2-binary` failed to build because `pg_config` is not available locally
- Because of that, the Flask app must be validated either:
  - with Docker once Docker Desktop is healthy, or
  - in fallback mode after confirming the optional-import branch boots cleanly in the local Python environment

### Important Backend Notes

- [backend/app.py](c:/Users/Owner/Xerox/AIproviso/backend/app.py) was updated so `psycopg2` and `redis` imports are optional.
- The fallback classifier in `should_fallback()` was expanded to include:
  - `psycopg2 is not installed`
  - `redis client is not installed`
- This is intended to let the API serve dev fallback invoice data even when Postgres/Redis drivers are missing.
- Runtime payloads now expose backend-owned `routeHistory`, `ruleDecision`, and `executionTicker` data.
- Native `guard_name` is persisted in workflow history, and `rule_id` persistence was added via `core/migrations/006_workflow_history_rule_id.sql`.

### Remaining Next Steps

1. Re-run local Flask startup and endpoint checks:
   - `source "/c/Users/Owner/Xerox/.venv/bin/activate"`
   - `cd "/c/Users/Owner/Xerox/AIproviso/backend"`
   - `python app.py`
   - `curl -s http://127.0.0.1:5000/api/dashboard/summary`
   - `curl -s "http://127.0.0.1:5000/api/invoices?status=review&search=Ricoh"`
2. If Docker Desktop is healthy after reboot, validate the real stack with:
   - `docker version`
   - `cd "/c/Users/Owner/Xerox/AIproviso"`
   - `docker compose up -d postgres redis backend-api`
3. Once either local fallback or Docker-backed API is responding, run the UI in dev mode and verify:
   - AP table loads from `/api/invoices`
   - metrics row loads from `/api/dashboard/summary`
   - approve/review buttons update backend state
4. After that, update the remaining progress tracker items to completed and continue with exception/audit real-data wiring if needed.
5. Formalize the canonical workflow IR so semantic view modes and target compilers use typed metadata instead of ad hoc projection helpers.
6. Add compile/publish output for XState machine config and n8n orchestration spec from the same canonical workflow model.
7. Extract the IR/compiler helpers out of [src/components/CommandCenter.jsx](c:/Users/Owner/Xerox/AIproviso/src/components/CommandCenter.jsx) into dedicated modules.
8. Replace heuristic state-to-rule derivation with authoritative backend/runtime metadata where available.
9. Add inspector-driven compiled detail for selected states/transitions so runtime/target specifics open in the side panel instead of appearing as node badges.
10. Keep the canvas background direction stable unless explicitly changing the visual language again; do not reintroduce per-node star ornaments.

### Resume Anchor

- Resume from: `AP-CANVAS-IR-HANDOFF-0526`
- Immediate file focus:
  - [backend/app.py](c:/Users/Owner/Xerox/AIproviso/backend/app.py)
  - [src/App.jsx](c:/Users/Owner/Xerox/AIproviso/src/App.jsx)
  - [src/components/CommandCenter.jsx](c:/Users/Owner/Xerox/AIproviso/src/components/CommandCenter.jsx)
  - [workflow-engine/server.mjs](c:/Users/Owner/Xerox/AIproviso/workflow-engine/server.mjs)
  - [src/lib/api.js](c:/Users/Owner/Xerox/AIproviso/src/lib/api.js)
  - [vite.config.js](c:/Users/Owner/Xerox/AIproviso/vite.config.js)
- Tomorrow's first move:
  - keep the canvas visuals as-is
  - extract the canonical workflow IR / XState / n8n projection logic into dedicated modules
  - continue semantic lens work through inspector panels and backend-owned metadata, not node decorations

## Role
Senior Frontend Architect — React, Zustand, Zod, custom spreadsheet grids.

## Core Competency Highlight

- Polymorphic UI state management for hybrid architectures: the workflow canvas is decoupled from underlying runtimes such as XState and n8n, while semantic overlays dynamically map distributed runtime traces back to localized business entities without creating a second authoring surface.

## Tech Stack

| Layer | Choice | Reason |
| :--- | :--- | :--- |
| Grid | **Custom HTML table** | react-spreadsheet v8 crashes when `data` with `DataEditor` changes during edit commit |
| State | Zustand | Single store, all workflows, full referential integrity |
| Validation | Zod | Cross-field rules: self-loops, orphaned transitions, duplicate pairs, missing initial |
| Diagram | Mermaid.js (CDN) | `stateDiagram-v2`, CDN-loaded, no npm package needed |

---

## Layout Architecture — "Command Center"

```
┌─────────────────────────┬──────────────────────────┐
│  LEFT PANE (flex:1)     │  RIGHT PANE (flex:1)     │
│  overflow-y: hidden     │  position: sticky        │
│  ─────────────────────  │  top: 0                  │
│  [States scrollbox]     │  height: 100vh           │
│    max-height: 350px    │                          │
│    overflow-y: auto     │  Live Mermaid Diagram    │
│  ─────────────────────  │  (never scrolls away)    │
│  [Transitions scrollbox]│                          │
│    max-height: 450px    │                          │
│    overflow-y: auto     │                          │
└─────────────────────────┴──────────────────────────┘
```

**Rules:**
- Left pane has two independent scroll areas (States + Transitions) — each has its own scrollbar
- Right pane (diagram) is `position: sticky` — stays fixed as left pane grows
- Section headers (`+ Add`, row count) always sticky at top of their section
- `thead` column headers are sticky WITHIN each scroll container

---

## Scroll Strategy — "Viewport Sweet Spot"

| Section | Max-Height | Visible Rows |
| :--- | :--- | :--- |
| States | 350px | ~12 rows |
| Transitions | 450px | ~14 rows |

**Why these numbers:** 12 states visible before scrolling. Once user hits row 13, the internal scrollbar appears. The Transitions section gets more space because workflows typically have more transitions than states.

### Shadow Scroll Indicators
Add `box-shadow: inset 0 8px 10px -10px rgba(0,0,0,.6)` at top and bottom of scroll containers. Signals "more data above/below" without taking any space.

### Zebra Striping
```css
.sheet-table tbody tr:nth-child(even) { background: rgba(255,255,255,.02); }
```
Essential for 100+ row readability. The eye tracks rows even without hovering.

### Ghost Row
Instead of empty space after the last row, append a dashed "ghost" row:
```jsx
<tr className="ghost-row">
  <td colSpan={4}>
    <div>─ ─ click + Add to continue ─ ─</div>
  </td>
</tr>
```

---

## Search/Filter Pattern for 100+ Rows

Add a mini search bar to each section header. Filter happens client-side, pure JS — no API needed.

```jsx
// In SpreadsheetGrid state:
const [stateFilter, setStateFilter] = useState('');
const [transFilter, setTransFilter] = useState('');

// Filtered views:
const filteredStates = wf.states.filter(st =>
  !stateFilter || st.name.toLowerCase().includes(stateFilter.toLowerCase())
);
const filteredTrans = wf.transitions.filter(t =>
  !transFilter ||
  t.from.toLowerCase().includes(transFilter.toLowerCase()) ||
  t.to.toLowerCase().includes(transFilter.toLowerCase())
);
```

**UX Rule:** Filter input appears inline in the section header. Placeholder: `"Filter states..."`. Typing "Sign" instantly hides all rows except "Signed Internally", "Signed by Customer". ESC clears the filter.

---

## Referential Integrity

```js
// deleteState — returns { ok, error }
// Blocked if state name appears in any transition
deleteState: (wfId, stateId) => {
  const inUse = wf.transitions.some(t => t.from === state.name || t.to === state.name);
  if (inUse) return { ok: false, error: `"${state.name}" is in use — remove its transitions first.` };
}

// renameState — auto-cascades to ALL transitions
renameState: (wfId, stateId, newName) => {
  // Updates state.name AND every t.from/t.to that matches old name
}
```

---

## useMermaid Hook

```js
// Returns null → diagram clears (no initial state set)
// All state nodes declared explicitly → isolated states still show as boxes
//
// ⚠ CRITICAL: dependency must be content keys, NOT the workflow object reference.
// If you use [workflow], useMemo uses Object.is() — same reference = skip recompute.
// After resetAll(), Zustand creates new objects (JSON.parse/stringify), so reference
// changes. But as a belt-and-suspenders guard, we derive string keys from the
// actual data content so the memo ALWAYS recomputes when data changes.
export const useMermaid = (workflow) => {
  const stateKey = workflow?.states.map(s => `${s.name}:${s.initial}`).join('|') ?? '';
  const transKey = workflow?.transitions.map(t => `${t.from}→${t.to}`).join('|') ?? '';
  return useMemo(() => {
    if (!workflow?.states.length) return null;
    if (!workflow.states.some(s => s.initial)) return null;
    let d = 'stateDiagram-v2\n';
    workflow.states.forEach(s => {
      const id = s.name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      d += `  ${id} : ${s.name}\n`;
      if (s.initial) d += `  [*] --> ${id}\n`;
    });
    workflow.transitions.forEach(t => {
      if (!t.from || !t.to) return;
      const f  = t.from.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      const to = t.to.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      d += `  ${f} --> ${to}\n`;
    });
    return d;
  }, [stateKey, transKey]); // ← granular content keys, not whole object
};
```

---

## Reset Button / Mermaid DOM Cache — Known Issue & Fix

**Symptom:** Clicking ↺ Reset clears the spreadsheet grid but the Mermaid diagram stays frozen showing old data.

**Root Causes:**

| # | Cause | Description |
| :- | :--- | :--- |
| 1 | **useMemo stale reference** | `useMemo([workflow])` uses `Object.is()` — if Zustand re-uses the same object reference, memo skips recompute and returns the old diagram string |
| 2 | **Mermaid DOM cache** | Mermaid injects SVG directly into the DOM. If React doesn't remount the component, the old SVG stays painted even if props change |
| 3 | **Empty string edge case** | If `useMermaid` returns `""` instead of `null`, Mermaid may crash silently and freeze on the last valid render |

**Our Fixes (all three applied):**

```jsx
// Fix 1 — useMermaid uses content keys, not object reference
const stateKey = workflow?.states.map(s => `${s.name}:${s.initial}`).join('|') ?? '';
return useMemo(() => { ... }, [stateKey, transKey]); // ← NOT [workflow]

// Fix 2 — resetCount bumps on every Reset → forces DiagramPane to fully remount
// WorkflowEditor.jsx:
const [resetCount, setResetCount] = useState(0);
const handleReset = () => {
  resetAll();
  setResetCount(c => c + 1); // React destroys + recreates DiagramPane → Mermaid DOM wiped
};
<DiagramPane key={resetCount} mermaidCode={mermaidStr} selectedState={selectedState} />

// Fix 3 — useMermaid returns null (not '') for empty state → DiagramPane clears innerHTML
if (!states.length) return null;
// DiagramPane:
if (!mermaidCode) { dRef.current.innerHTML = ''; return; }
```

**Rule:** Never use `key={JSON.stringify(data)}` on a component that renders on every keystroke — that would remount on every character typed. Use a counter that only increments on hard resets.

---

## ⚡ Stress Test Generator

**Trigger:** `⚡ Stress Test` button in the SOW Editor toolbar
**Action:** `loadStressTest(wfId)` in `useWorkflowStore.js`
**Output:** 100 states + 150 transitions loaded into the active workflow tab

### Generation Pattern (deterministic — same result every run)

| Layer | Pattern | Count | Cumulative |
| :--- | :--- | :---: | :---: |
| 1 | Linear chain: State 01 to 02 to 100 | 99 | 99 |
| 2 | Back to initial every 10th state | 10 | 109 |
| 3 | Skip-forward by 10 | 9 | 118 |
| 4 | Skip-forward by 5 | 19 | 137 |
| 5 | Branch +3 from even-indexed states (fills to 150) | 13 | 150 |
| 6 | Reverse -2 from tail (safety top-up if under 150) | 0 | 150 |

### Key Design Rules
```js
// Deduplication — O(1) per check, no nested loops
const seen = new Set();
const addT = (from, to) => {
  const key = `${from}|${to}`;
  if (seen.has(key) || from === to) return; // skip duplicates and self-loops
  seen.add(key);
  transitions.push(...);
};
// State naming — "State 01" to "State 100"
const pad = n => String(n).padStart(2, '0');
const nm  = i => `State ${pad(i + 1)}`;
```

### Performance Observations at 100 States / 150 Transitions
| Metric | Result |
| :--- | :--- |
| Grid render (initial load) | instant |
| Filter/search response | instant (Array.filter on 100 rows) |
| Mermaid diagram render | 1-3 sec (CPU layout, expected) |
| Cell edit latency | instant (content-key memo prevents diagram re-draw on keystroke) |
| Export JSON | instant |

### To Scale Further
Change N and target cap in loadStressTest:
```js
const N = 150; // states
for (let i = 0; transitions.length < 200 && ...) // target transitions
```
No other changes required — the layered generator fills to any target.

---

## Key Decision Log

| Decision | Reason |
| :--- | :--- |
| Dropped react-spreadsheet | Crashes on controlled data + DataEditor during commit cycle |
| Dropped Cacoo | Proviso is the source of truth — no external import |
| Dropped Flask backend | All state in-browser via Zustand |
| Custom grid | Stable, full UX control, integrity guards built in |
| `renameState` cascades | Renames auto-update all `from`/`to` in transitions |
| Zod cross-field | Catches self-loops, orphaned transitions, duplicates |
| Search/filter bars | Required for 100+ state workflows |
| Max-height scroll areas | Keeps diagram always visible on right pane |
| Zebra striping | Visual row tracking for large datasets |
| Ghost row | Eliminates "huge gap" at bottom of short lists |
| `useMermaid` content keys | `[stateKey, transKey]` instead of `[workflow]` — prevents stale memo |
| `resetCount` key on DiagramPane | Increments on Reset → React remounts DiagramPane → Mermaid DOM wiped |

---

## File Structure

```
src/
├── App.jsx                    ← Shell: layout, CSS, sidebar
├── store/useWorkflowStore.js  ← Zustand: all workflows + actions
├── validation/schema.js       ← Zod schemas
├── hooks/
│   ├── useMermaid.js          ← Diagram string generator
│   └── useExport.js           ← M-Files JSON exporter
└── components/
    ├── WorkflowEditor.jsx     ← Tabs + toolbar + split layout
    ├── SpreadsheetGrid.jsx    ← Custom grid + search + scroll
    ├── GlobalSection.jsx      ← Users, Properties, Rules
    ├── DiagramPane.jsx        ← Mermaid canvas (stateless)
    ├── PrdGenerator.jsx       ← PRD screen
    └── IngestWorkflow.jsx     ← Vault ingestion screen
```

---

## Phase III — Electron Desktop App + M-Files COM Bridge

### Why Electron (not PWA / Nativefier)
PWA and Nativefier are browser sandboxes — cannot spawn PowerShell or call COM APIs.
Electron gives Node.js in the main process → full Windows system access.

### Architecture
```
Renderer (React/Vite)
  └─ window.mfiles.pushWorkflow(json)   ← contextBridge (preload.cjs)
       └─ IPC → main.cjs
            └─ spawn powershell push-to-vault.ps1
                 └─ MFilesAPI COM → GetVaultConnection → LogInAsUser
                      └─ WorkflowOperations.AddWorkflowAdmin()
                           └─ M-Files Vault
```

### Key Files
| File | Purpose |
| :--- | :--- |
| `electron/main.cjs` | Electron main process — BrowserWindow + IPC handlers |
| `electron/preload.cjs` | contextBridge — exposes `window.mfiles` API securely |
| `scripts/push-to-vault.ps1` | PowerShell COM bridge — creates workflow in vault |
| `src/components/IngestWorkflow.jsx` | UI — dual auth toggle, connect, push, live log |

### ✅ Correct M-Files COM API Pattern (v26.x confirmed)
```powershell
# ❌ WRONG — Connect() does NOT exist on MFilesClientApplication in v26
$app.Connect("TCP", "server", 2266, $false)

# ✅ CORRECT — GetVaultConnection → LogInAs or LogInAsUser
$app  = New-Object -ComObject MFilesAPI.MFilesClientApplication
$conn = $app.GetVaultConnection('VaultName')   # by name, from registered connections

# Windows SSO  (MFAuthType 0)
$vault = $conn.LogInAs(0, 0, $false)

# M-Files Credentials  (MFAuthType 2)
$vault = $conn.LogInAsUser(2, 'username', 'password', $null, $null)
```

### IVaultConnection — Confirmed Methods (Get-Member verified)
| Method | Signature |
| :--- | :--- |
| `LogInAs` | `IVault LogInAs(LONG_PTR hwnd, MFAuthType, bool offline)` |
| `LogInAsUser` | `IVault LogInAsUser(MFAuthType, string user, string pass, Variant domain, Variant spn)` |
| `TestConnectionToVaultSilent` | `MFVaultConnectionTestResult TestConnectionToVaultSilent()` |
| `GetGUID` | `string GetGUID()` |
| `BindToVault` | `IVault BindToVault(LONG_PTR hwnd, bool readOnly, bool showOffline)` |

### MFAuthType Enum
| Value | Constant | Meaning |
| :---: | :--- | :--- |
| 0 | `MFAuthTypeLoggedOnWindowsUser` | Windows SSO |
| 1 | `MFAuthTypeSpecificWindowsUser` | Specific Windows user |
| 2 | `MFAuthTypeSpecificMFilesUser` | M-Files credentials |

### Vault Info (Acme)
| Field | Value |
| :--- | :--- |
| Vault Name | `Acme` |
| Vault GUID | `{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}` |
| Test user | `Betty.black` (admin access granted) |
| Server | `DESKTOP-DKCS42P` (machine name only — never include `\username`) |
| Registered vaults | Acme · Certification-user-15 |

### Workflow Creation COM Objects (pending license renewal)
```powershell
$wfAdmin      = New-Object -ComObject MFilesAPI.WorkflowAdmin
$wfAdmin.Name = $wf.name
$stAdmin      = New-Object -ComObject MFilesAPI.StateAdmin
$stAdmin.Name = $s.name
$createdState = $wfAdmin.AddStateAdmin($stAdmin)
$wfAdmin.InitialState = $createdState.ID      # for the initial state
$savedId = $vault.WorkflowOperations.AddWorkflowAdmin($wfAdmin)
```
⚠ If `New-Object -ComObject MFilesAPI.WorkflowAdmin` fails, inspect factory methods:
```powershell
$vault.WorkflowOperations | Get-Member -MemberType Method | Format-Table -AutoSize
```

### npm Scripts
| Script | Action |
| :--- | :--- |
| `npm run dev` | Vite browser dev (port 3000) |
| `npm run electron:dev` | Vite + Electron window (kill stale node procs first if ports busy) |
| `npm run electron:build` | Build → `dist-electron/Proviso Setup.exe` |

### .exe vs .msi
| | `.exe` NSIS | `.msi` |
| :--- | :--- | :--- |
| Ready now | ✅ | ❌ needs WiX |
| Enterprise GPO push | ❌ | ✅ |
| Silent install | `/S` | `msiexec /quiet` |
| **Recommendation** | **Ship `.exe` first** | Upgrade for IT rollout |

### Key Decisions — Phase III
| Decision | Reason |
| :--- | :--- |
| Electron over PWA/Nativefier | COM API requires Node.js — browser sandbox can't call it |
| `.cjs` extension for electron files | Project has `"type":"module"` — avoids ESM conflict |
| `base:'./'` in vite.config.js | Required for Electron production asset resolution |
| `contextIsolation: true` | Security — renderer cannot access Node directly |
| Temp file for JSON handoff | PowerShell can't receive large JSON via CLI args |
| `open: false` in Vite server config | Electron opens its own window |

---

## 🔑 Tomorrow (1 PM) Session Keywords

```
RESUME: Phase-III-B-Auth-Unlock
```

**Exact pickup sequence:**
1. Renew M-Files license → verify in M-Files Desktop (Betty.black can log in)
2. In Electron app → **Ingest Workflow** → 🔑 M-Files Credentials → Connect
3. If connection works → **Push Workflow** → confirm live log streams states/transitions
4. If `WorkflowAdmin` COM object fails → run inspect command above → fix method name
5. Confirm workflow appears in **M-Files Admin → Acme vault → Workflows**
6. `npm run electron:build` → `.exe` → demo to manager
```

---

## Phase III-B — Bidirectional Sync (Implemented)

### Architecture: Push ↔ Pull

```
Renderer (React)
  └─ window.mfiles.pushWorkflow(json)   ← contextBridge
  └─ window.mfiles.listWorkflows(cfg)   ← contextBridge
  └─ window.mfiles.pullWorkflows(cfg)   ← contextBridge
       └─ IPC → main.cjs
            ├─ mfiles:push          → push-to-vault.ps1
            ├─ mfiles:list-workflows → pull-from-vault.ps1 -ListOnly
            └─ mfiles:pull-workflows → pull-from-vault.ps1 -WorkflowIds
```

### Unified Sync Menu — UI Pattern

```
┌─────────────────────────────────┐
│  [ Export to Vault | Import from Vault ]  ← syncMode toggle
├─────────────────────────────────┤
│  Export mode:                   │
│    SyncQueue (local workflows)  │
│    → Push Staged                │
│                                 │
│  Import mode:                   │
│    [Fetch Vault Workflows]       │
│    SyncQueue (vault workflows)  │
│    ← Pull Staged into Tabs      │
└─────────────────────────────────┘
```

**State variables:**
```js
const [syncMode,setSyncMode]         = useState('export');      // 'export' | 'import'
const [mfPushQueue,setMfPushQueue]   = useState([]);            // wf IDs staged for push
const [mfPullQueue,setMfPullQueue]   = useState([]);            // wf IDs staged for pull
const [mfVaultWorkflows,setMfVaultWorkflows] = useState([]);    // fetched from vault
```

### SyncQueue Component

Reusable — used for both push and pull directions. Scrollable when > 5 items.

```jsx
function SyncQueue({ available, queue, setQueue, stagedLabel }) {
  const unqueued = available.filter(w => !queue.includes(w.id));
  return (
    <div className="q-list">
      {unqueued.length > 0 && (
        <div style={{maxHeight: 130, overflowY: unqueued.length > 5 ? 'auto' : 'visible'}}>
          {unqueued.map(w => (
            <div key={w.id} className="q-row">
              <span className="q-name">{w.name}</span>
              <button className="q-btn add" onClick={() => setQueue(q => [...q, w.id])}>+</button>
            </div>
          ))}
        </div>
      )}
      {queue.length > 0 && <div className="q-staged-lbl">{stagedLabel}</div>}
      {queue.map(id => {
        const w = available.find(x => x.id === id);
        if (!w) return null;
        return (
          <div key={w.id} className="q-row staged">
            <span className="q-name">{w.name}</span>
            <button className="q-btn del" onClick={() => setQueue(q => q.filter(x => x !== id))}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
```

**Design rules:**
- `available` = all options (local workflows OR vault workflows depending on direction)
- Items in queue are removed from the available list (can't stage twice)
- Staged section appears only when queue.length > 0
- Queue is cleared on successful push/pull

### PowerShell JSON Normalization — pull-from-vault.ps1

Pull script emits structured JSON via `[RESULT]` sentinel prefix. Two modes:

| Mode | Flag | Output |
|:---|:---|:---|
| List | `-ListOnly` | `[{id, name}]` — available workflows for SyncQueue picker |
| Fetch | `-WorkflowIds "1,2,3"` | Full workflow objects with states, transitions, scripts, rules |

**Normalization in `seedImportedWorkflow` (useWorkflowStore.js):**
```js
// Pulled workflow JSON → Proviso tab
seedImportedWorkflow: (mfData) => {
  const wf = {
    id:         makeId(),
    name:       `📥 ${mfData.name} (imported ${date})`,
    source:     mfData.source || 'mfiles',   // marks tab as imported (blue tint)
    importedAt: mfData.importedAt,
    states:     (mfData.states || []).map(s => ({ id: makeId(), ...s })),
    transitions:(mfData.transitions || []).map(t => ({ id: makeId(), ...t })),
  };
  // VBScript actions on states → global rules (data preservation)
  const newRules = [
    ...(mfData.rules   || []).map(r   => ({ id: makeId(), text: r.text })),
    ...(mfData.scripts || []).map(scr => ({ id: makeId(), text: `VBScript on state ${scr.state}: ${scr.text}` })),
  ];
  set(s => ({ workflows: [...s.workflows, wf], activeId: wf.id, rules: [...s.rules, ...newRules] }));
}
```

**Tab visual indicator:** imported tabs get `.imported` CSS class → blue-tinted tab strip.

### Async Handler Freeze Fix

**Symptom:** UI freezes while push/pull IPC call is in-flight.

**Fix pattern:**
```js
// 1. mfBusy guard — disables all sync buttons during operation
setMfBusy(true);
// ... async work ...
finally { setMfBusy(false); }

// 2. Sequential for...of for multi-workflow push — never parallel
for (const id of mfPushQueue) {
  const res = await window.mfiles.pushWorkflow({ ... });
  if (!res.ok) throw new Error(`${targetWf.name}: ${res.error || 'Unknown push error'}`);
}

// 3. Always clean up progress listener — even on error
finally {
  setMfBusy(false);
  try { window.mfiles.offProgress(); } catch(e) {}
}
```

**Why `for...of` not `Promise.all`:** M-Files vault COM is single-threaded — parallel pushes cause COM contention errors. Sequential is required.

### Push IPC Error Capture (main.cjs)

Push handler captures `[ERROR]` lines from PowerShell stdout and includes them in the resolve payload:

```js
let lastError = '';
ps.stdout.on('data', d => {
  d.toString().split('\n').filter(l => l.trim()).forEach(line => {
    send(line);   // stream to renderer log
    if (line.includes('[ERROR]')) lastError = line.replace(/\[ERROR\]\s*/, '').trim();
  });
});
ps.stderr.on('data', d => { const msg = d.toString().trim(); send(`[ERROR] ${msg}`); lastError = msg; });
ps.on('close', async (code) => {
  await unlink(tmpFile).catch(() => {});
  resolve({ ok: code === 0, exitCode: code, error: lastError || '' });
});
```

**Before this fix:** `res.error` in the renderer was always `undefined` — error message was swallowed.

### Mermaid Intrinsic Scaling

**Problem:** Mermaid injects `style="max-width: Xpx"` inline on the SVG, overriding all CSS.

**Fix:**
```js
const svgEl = diagRef.current.querySelector('svg');
if (svgEl) {
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  svgEl.style.maxWidth = 'none';
  // Read intrinsic width from viewBox so zoom scales proportionally
  const vb = svgEl.viewBox.baseVal;
  const baseW = (vb && vb.width > 0) ? vb.width : 800;
  svgEl.dataset.baseWidth = baseW;        // stored for zoom calculations
  svgEl.style.width  = `${baseW * zoomRef.current}px`;
  svgEl.style.height = 'auto';
}
```

**Zoom reapply:**
```js
useEffect(() => {
  zoomRef.current = zoom;
  const svgEl = diagRef.current?.querySelector('svg');
  if (svgEl) {
    const baseW = parseFloat(svgEl.dataset.baseWidth) || 800;
    svgEl.style.width = `${baseW * zoom}px`;
  }
}, [zoom]);
```

**Rule:** `state: { useMaxWidth: false }` in `mermaid.initialize()` prevents the inline `max-width` injection entirely. The `viewBox` approach is belt-and-suspenders for when Mermaid ignores that config.

### Updated IPC Handler Table

| IPC Channel | Direction | Script | Notes |
|:---|:---|:---|:---|
| `mfiles:list-vaults` | → PS | `test-connection.ps1` | Connection test |
| `mfiles:list-workflows` | → PS | `pull-from-vault.ps1 -ListOnly` | Returns `[{id,name}]` |
| `mfiles:pull-workflows` | → PS | `pull-from-vault.ps1 -WorkflowIds` | Full workflow fetch |
| `mfiles:push` | → PS | `push-to-vault.ps1` | Creates workflow in vault, streams progress |
| `mfiles:progress` | ← renderer | — | Streaming log lines from PS |
| `file:save` | → OS | — | Native Save-As dialog |
| `sow:claude-extract` | → HTTPS | api.anthropic.com | Claude NLP extraction |

### Updated File Structure

```
src/
├── App.jsx
├── main.jsx
├── store/
│   └── useWorkflowStore.js      ← seedImportedWorkflow, seedStressTest, importWorkflow
├── validation/
│   └── schema.js
├── hooks/
│   ├── useMermaid.js            ← content-key memo, returns null for empty
│   └── useExport.js
└── components/
    └── CommandCenter.jsx        ← all UI: SyncQueue, Unified Sync Menu, diagram, grids

electron/
├── main.cjs                     ← IPC: push, pull, list, file:save, claude
└── preload.cjs                  ← contextBridge: window.mfiles, window.sow, window.file

scripts/
├── push-to-vault.ps1            ← COM: creates workflow + states + transitions
├── pull-from-vault.ps1          ← COM: lists or fetches workflows (-ListOnly / -WorkflowIds)
├── test-connection.ps1          ← COM: vault connection test
└── verify-vault.ps1             ← COM: vault verification utility
```

---

## Beta II — Bidirectional M-Files Round-Trip Sync

### Goal
Transition from a push-only utility to a full bidirectional orchestrator.

### Technical Architecture
| Feature | Component | Logic |
| :--- | :--- | :--- |
| **Import (Pull)** | `pull-from-vault.ps1` | Deep extraction of States (names, aliases, VBScripts) and Transitions. |
| **Inventory** | `-ListOnly` mode | Fast fetch of workflow names/IDs without deep property extraction. |
| **IPC Bridge** | `main.cjs` | Handles JSON normalization to fix PowerShell single-item "unrolling" bug. |
| **Zustand Store** | `seedImportedWorkflow` | Generates unique IDs, prepends `📥`, and sets `source: 'mfiles'`. |

### UI / UX Refactor — "Unified Sync Menu"
- **Segmented Control:** Replaced stacked sections with a toggleable `[ Export to Vault ]` | `[ Import to Vault ]` interface.
- **Queue Builder:** Staging logic using `SyncQueue` component (Green `[+]` to stage, Red `[x]` to unstage).
- **Import Tab Styling:** Imported workflows feature a `2px` green top-border and subtle background tint to signal live data.

### Robustness & Reliability Fixes
| Issue | Resolution |
| :--- | :--- |
| **UI Freeze** | Wrapped `offProgress()` cleanup in `try/catch` and ensured `setMfBusy(false)` runs first in `finally` blocks. |
| **JSON Parsing** | Added defensive `if (!Array.isArray(parsed)) parsed = [parsed]` in `main.cjs` to handle PowerShell object-vs-array unrolling. |
| **Diagram Scaling** | Switched from `width: 100%` (which caused vertical explosion) to **Intrinsic Width Locking** via `viewBox.baseVal.width`. |
| **Centering** | Added `margin: 0 auto` to SVG to ensure balanced whitespace when side panels are collapsed. |

### Core M-Files Import Mapping
```powershell
# Mapping M-Files COM to Proviso JSON
$stateJson = @{
    name    = $s.Name
    initial = $false # Resolved in JS post-processing (usually index 0)
    alias   = $s.SemanticAliases.Value
}
$wfJson.scripts += @{
    state = $s.Name
    text  = $s.ActionRunVBScriptDefinition # Preserves server-side logic
}
```

---

## 🔑 Current Session Status
```
MILESTONE: Beta-II-Complete
NEXT: Beta-III-AI-Vision (Auto-generate diagram states from LLM vision)
```

---

## Beta II.1 — Workflow Navigation Polish (Validated)

### Goal
Improve navigation in dense workflow sessions and guarantee that each imported tab always renders its own state/transition diagram input.

### Implemented (and user-validated)
| Feature | File | Notes |
| :--- | :--- | :--- |
| Workflow tab strip arrows (left/right) | `src/components/CommandCenter.jsx` + `src/App.jsx` | Adds compact arrows to scroll the tab strip horizontally when many workflows are open. |
| Workflow area arrows (up/down) | `src/components/CommandCenter.jsx` + `src/App.jsx` | Adds compact arrows to scroll the left workflow editor vertically. |
| Per-tab diagram isolation | `src/components/CommandCenter.jsx` + `src/hooks/useMermaid.js` | Tab switch clears transient selection state and forces clean diagram remount to prevent stale SVG carry-over. |
| Mermaid dependency hardening | `src/hooks/useMermaid.js` | Memo now keys by workflow identity + state content + transition content. |
| Compact tab labels + expand toggle | `src/components/CommandCenter.jsx` + `src/App.jsx` | Tabs are ellipsized by default; hover shows full name; toggle expands label width for scanning. |

### UI Blend Rules (look and feel)
- Scroll arrows use existing theme tokens (`--s2`, `--s3`, `--border`, `--mid`, `--a2`, `--a3`)
- Same border radius, hover timing, and contrast profile as existing `.xb`/panel controls
- Disabled state uses dimmed opacity and preserves visual hierarchy
- Tab expand toggle (`⇥`/`⇤`) matches the same visual language as scroll controls.
- Compact tab mode tuned smaller for density: tighter tab padding and roughly half-width default label truncation.

### Correctness Rule — Diagram Input Source of Truth
Diagram rendering is bound strictly to the active workflow's states/transitions:

```js
const wf = getActive();
const mermaidStr = useMermaid(wf);
```

And memo invalidation now includes workflow identity to avoid cross-tab reuse:

```js
const workflowKey = workflow?.id || workflow?.name || '';
// dependencies: [workflowKey, stateKey, transKey]
```

This ensures each imported workflow tab displays only its own graph, even when tabs share similar structure.

### Testing Evidence (May 12, 2026)
- [x] Imported multiple vault workflows in one session.
- [x] Clicked each imported tab and confirmed it displayed its own states.
- [x] Clicked each imported tab and confirmed it displayed its own transitions.
- [x] Confirmed Mermaid diagram matched the active tab's workflow only.
- [x] Verified workflow-tab left/right arrows scroll correctly.
- [x] Verified workflow-area up/down arrows scroll correctly.
- [x] Verified arrow controls blend with existing Proviso GUI style.
- [x] Verified long workflow names are ellipsized by default.
- [x] Verified tab hover tooltip shows full workflow name.
- [x] Verified expand/collapse labels toggle changes label width without affecting tab selection.
- [x] Verified extra-compact tab mode keeps strip density high while bottom header still shows full active workflow name.

### Known Limitations
- Diagram intentionally stays blank when a workflow has no states.
- Diagram intentionally stays blank when no state is marked as `initial: true`.
- Transition lines with empty `from` or `to` are skipped in Mermaid rendering until values are completed.
- Imported workflow tab names can be long; labels are intentionally ellipsized in compact mode for layout stability.
- Expanded label mode increases visible width but still depends on horizontal tab-strip scrolling when many tabs are open.

---

## Beta II.2 — GUI Pro & Premium Experience (Implemented)

### Goal
Elevate the Proviso Command Center to a world-class, premium desktop interface with advanced interactivity and modern aesthetics.

### 1. Bi-Directional Highlighting
- **Interaction:** Hovering over a State or Transition row in the spreadsheet grid triggers a visual glow on the corresponding element in the Mermaid SVG.
- **Technical Implementation:** Uses `useEffect` in `CommandCenter.jsx` to select Mermaid DOM nodes by ID/Class (e.g., `[class*="LS-${f}"][class*="LE-${t}"]`) and inject a `.highlight` CSS class.
- **CSS:** `.highlight` adds a green stroke, increased stroke-width, and a subtle `drop-shadow` glow.

### 2. Command Palette (Ctrl+K)
- **Feature:** A fuzzy-searchable overlay for rapid navigation.
- **Component:** `CommandPalette.jsx` listens for `Ctrl + K` (or `Cmd + K`) and `Escape`.
- **Search Scope:** Workflows (switching), States (jump-to), and Global Actions (Export JSON).
- **UX:** Automatic focus on open, keyboard navigation (ArrowUp/Down/Enter).

### 3. Glassmorphism & Visual Depth
- **Aesthetics:** Side panels use `backdrop-filter: blur(12px)` and `rgba(7, 17, 31, 0.85)` backgrounds.
- **Hierarchy:** Creates a "layered" feel where the diagram sits "behind" the semi-translucent configuration panels.
- **Micro-Animations:** Added `0.2s cubic-bezier` transitions to buttons, tabs, and section headers for a "buttery" feel.

### 4. Contextual Pulse Indicators
- **Visual Feedback:** A tiny glowing status dot in the "Deliver" header.
- **States:**
| Color | Meaning |
| :--- | :--- |
| **Green (Pulse)** | Connected to M-Files Vault |
| **Amber (Fast Pulse)** | Busy / Syncing |
| **Blue/Dim** | Disconnected / Idle |
| **Benefit:** At-a-glance confirmation of system health without reading logs. |

### 5. Unified Action Toolbar
- **Design:** Consistently positioned floating glass bar at the bottom-center of the diagram pane.
- **Function:** Groups high-level diagram controls (Recenter, Command Palette Trigger) in a predictable, high-visibility location.

### 6. Empty State "Blueprint"
- **Onboarding:** Replaced "No workflow loaded" text with a professional SVG-based graphical empty state.
- **Contextual Help:** Provides specific instructions based on whether a workflow is active but empty, or if no workflow is selected at all.

---

## 🔑 Current Session Status
```
MILESTONE: Beta-II-Pro-Complete
NEXT: Beta-III-AI-Vision (Image-to-JSON Workflow Generation)
```

---

## 🔧 n8n 2.x Integration — Lessons Learned (Week 1, May 2026)

### Stack
- n8n `2.22.3` in Docker, PostgreSQL backend, port `5678`
- Auth: session cookie for `/rest/` endpoints · API key (`X-N8N-API-KEY`) for `/api/v1/` endpoints
- Bootstrap script: `scripts/create-n8n-workflows.ps1`

### Bugs Fixed & Root Causes

| # | Symptom | Root Cause | Fix |
|---|---------|-----------|-----|
| 1 | Login 404 on first run | REST API not ready despite `/healthz` returning 200 | Added `Start-Sleep 3` after healthz passes before first REST call |
| 2 | Archive step → 401 (session cookie rejected) | `Secure` cookie flag set by n8n; plain HTTP strips it silently | `N8N_SECURE_COOKIE: "false"` in `docker-compose.yml` |
| 3 | `POST /api/v1/workflows` → 400 | `active` field is **read-only** on create in n8n 2.x | Removed `active = $false` from create body; activate separately via `POST /api/v1/workflows/{id}/activate` |
| 4 | Workflow list → 400 | `limit=500` exceeds n8n 2.x maximum | Changed to `limit=250` |
| 5 | Webhook responds with broken JSON | String-concatenated `responseBody` had unescaped quotes | Used `[ordered]@{ ack=$true; event=$evt.event } \| ConvertTo-Json -Compress` |
| 6 | `POST /api/v1/workflows` → 400 (connections) | PowerShell silently flattens `@( @( item ) )` → `@( item )` → JSON `[{}]` instead of `[[{}]]` | Comma operator: `@( ,@( @{ node="Respond"; type="main"; index=0 } ) )` preserves nesting |

### Delete Sequence (required order)
```
1. POST /api/v1/workflows/{id}/deactivate   (API key)
2. POST /rest/workflows/{id}/archive         (session cookie — needs N8N_SECURE_COOKIE=false)
3. DELETE /api/v1/workflows/{id}             (API key)
```

### Login Body Field (n8n 2.x)
```json
{ "emailOrLdapLoginId": "admin@proviso.local", "password": "Changeme_n8n1" }
```
> ⚠️ Field is `emailOrLdapLoginId`, NOT `email` — common mistake.

### connections.main Must Be Nested Array
```powershell
# WRONG — PowerShell flattens this to [{...}]
main = @( @( @{ node = "Respond"; type = "main"; index = 0 } ) )

# CORRECT — comma operator preserves [[{...}]]
main = @( ,@( @{ node = "Respond"; type = "main"; index = 0 } ) )
```

### 9 Proviso Webhook Events (Week 1)
```
invoice-received · invoice-extracted · invoice-matched · invoice-exception
invoice-resolved · invoice-approved · invoice-posted · invoice-rejected · audit-event
```
Each workflow: `Webhook → Respond to Webhook` (responseMode: `responseNode`), returns `{"ack":true,"event":"<event>"}`.

### Week 1 Gate — PASSED ✅ (2026-05-25)
All 9 paths returned `{"ack":true}` — `PASS 9 / FAIL 0`.

---

## 🔀 Tool Boundary — Provisio vs AI Proviso (Locked Decision, May 2026)

### The Rule
> AI Proviso does **not** talk to the M-Files COM API. It never will.

### Who Does What

| Responsibility | Tool |
| :--- | :--- |
| Connect to M-Files vault via COM | **Provisio** (separate tool) |
| Export workflows as JSON from M-Files | **Provisio** |
| `VaultNamedValueStorageOperations`, vault aliases, auth | **Provisio** |
| Ingest a workflow JSON file | **AI Proviso** (`POST /api/workflows/import`) |
| Sanitize, add to dataset, run RAG | **AI Proviso** |
| AP automation pipeline | **AI Proviso** |

### One Connection Point
```
Provisio tool  ──[workflow.json]──►  POST /api/workflows/import  ──►  AI Proviso
```

### What This Removes from AI Proviso
- `win32com` / `pywin32` dependency
- `host-native` Docker profile
- Windows-only deployment requirement
- M-Files vault GUIDs, server addresses, auth credentials in `.env`
- `electron/main.cjs` IPC handlers for `mfiles:*`
- `electron/preload.cjs` `window.mfiles` bridge
- `scripts/pull-from-vault.ps1`, `push-to-vault.ps1`, `verify-vault.ps1`, `test-connection.ps1`

### Why It Matters
AI Proviso now runs on any OS (Linux container, Mac, Windows) without a local M-Files Desktop installation. The single JSON import endpoint is DMS-agnostic — Provisio could export from any system.


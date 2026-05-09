<#
.SYNOPSIS
    Proviso — Push workflow JSON into an M-Files blank vault via COM API
.DESCRIPTION
    Called by Electron main process IPC handler.
    Outputs [PROGRESS], [SUCCESS], [WARN], [ERROR] prefixed lines
    that Electron streams back to the renderer log panel.
.PARAMETER JsonPath
    Path to the temp JSON file written by the Electron main process
.PARAMETER VaultGuid
    M-Files vault GUID  e.g. {08E9A947-7E05-4722-A890-559D36FDC8FF}
.PARAMETER ServerAddress
    M-Files server hostname or IP  (default: localhost)
.PARAMETER Port
    M-Files TCP port  (default: 2266)
#>
param(
    [Parameter(Mandatory=$true)] [string]$JsonPath,
    [string]$VaultGuid     = '{08E9A947-7E05-4722-A890-559D36FDC8FF}',
    [string]$ServerAddress = 'localhost',
    [int]   $Port          = 2266
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function pLog  { param([string]$m) Write-Output "[PROGRESS] $m"; [Console]::Out.Flush() }
function pOK   { param([string]$m) Write-Output "[SUCCESS] $m";  [Console]::Out.Flush() }
function pWarn { param([string]$m) Write-Output "[WARN] $m";     [Console]::Out.Flush() }
function pErr  { param([string]$m) Write-Output "[ERROR] $m";    [Console]::Out.Flush() }

try {
    # ── 1. Load & validate JSON ────────────────────────────────────
    if (-not (Test-Path $JsonPath)) { throw "JSON file not found: $JsonPath" }
    $json = Get-Content $JsonPath -Raw | ConvertFrom-Json

    # Support single workflow object OR array (take first)
    $wf = if ($json -is [array]) { $json[0] } else { $json }

    if (-not $wf.name)   { throw "Workflow JSON missing 'name' field" }
    if (-not $wf.states) { throw "Workflow JSON missing 'states' array" }

    pLog "Workflow: '$($wf.name)'  |  $($wf.states.Count) states  |  $($wf.transitions.Count) transitions"

    # ── 2. Connect to M-Files (Windows SSO) ───────────────────────
    pLog "Connecting to M-Files at $ServerAddress : $Port ..."
    $app = New-Object -ComObject MFilesAPI.MFilesClientApplication
    # SSO — uses the current Windows identity, no credentials needed
    $app.Connect("TCP", $ServerAddress, $Port, $false)
    pLog "Server connection established"

    # ── 3. Bind to vault ──────────────────────────────────────────
    pLog "Binding to vault $VaultGuid ..."
    $vault = $app.BindToVault($VaultGuid, $false, $true, $null)
    pOK   "Bound to vault: '$($vault.Name)'"

    # ── 4. Duplicate check (skip if workflow already exists) ───────
    pLog "Checking for existing workflow with same name..."
    $existingWFs = $vault.WorkflowOperations.GetWorkflowsAdmin()
    foreach ($e in $existingWFs) {
        if ($e.Name -ieq $wf.name) {
            pWarn "Workflow '$($wf.name)' already exists in vault — skipping to prevent duplicate"
            pOK   "Done (no changes made)"
            exit 0
        }
    }

    # ── 5. Build WorkflowAdmin object ─────────────────────────────
    pLog "Creating WorkflowAdmin object..."
    $wfAdmin      = New-Object -ComObject MFilesAPI.WorkflowAdmin
    $wfAdmin.Name = $wf.name

    # ── 6. Add states ─────────────────────────────────────────────
    pLog "Adding $($wf.states.Count) states..."
    $nameToId = @{}   # maps state name → M-Files state ID

    foreach ($s in $wf.states) {
        $stAdmin      = New-Object -ComObject MFilesAPI.StateAdmin
        $stAdmin.Name = $s.name

        $createdState = $wfAdmin.AddStateAdmin($stAdmin)
        $nameToId[$s.name] = $createdState.ID
        pLog "  + State '$($s.name)'$(if($s.initial){ ' [INITIAL]' })"
    }

    # ── 7. Set initial state ───────────────────────────────────────
    $initState = $wf.states | Where-Object { $_.initial -eq $true } | Select-Object -First 1
    if ($initState) {
        $initId = $nameToId[$initState.name]
        $wfAdmin.ObjectClass = 0   # document class — may vary
        $wfAdmin.InitialState = $initId
        pLog "  → Initial state: '$($initState.name)' (ID=$initId)"
    } else {
        pWarn "No initial state flagged — M-Files requires one; set it manually in Admin"
    }

    # ── 8. Add transitions ────────────────────────────────────────
    pLog "Adding $($wf.transitions.Count) transitions..."
    $skipped = 0
    foreach ($t in $wf.transitions) {
        $fromId = $nameToId[$t.from]
        $toId   = $nameToId[$t.to]
        if (-not $fromId) { pWarn "  ⚠ Unknown FROM state '$($t.from)' — skipped"; $skipped++; continue }
        if (-not $toId)   { pWarn "  ⚠ Unknown TO state '$($t.to)' — skipped";     $skipped++; continue }

        $wfAdmin.AddStateTransitionAdmin($fromId, $toId)
        pLog "  + $($t.from) → $($t.to)"
    }
    if ($skipped -gt 0) { pWarn "$skipped transition(s) skipped due to unknown state names" }

    # ── 9. Commit to vault ────────────────────────────────────────
    pLog "Committing workflow to vault..."
    $savedId = $vault.WorkflowOperations.AddWorkflowAdmin($wfAdmin)

    pOK ""
    pOK "══ SUCCESS ══════════════════════════════════════"
    pOK "Workflow '$($wf.name)' created  (Vault ID = $savedId)"
    pOK "$($wf.states.Count) states  ·  $($wf.transitions.Count - $skipped) transitions"
    pWarn "Conditions and permissions NOT set — configure in M-Files Admin (Phase 2)"
    pOK "══════════════════════════════════════════════════"

    exit 0

} catch {
    pErr $_.Exception.Message
    exit 1
}

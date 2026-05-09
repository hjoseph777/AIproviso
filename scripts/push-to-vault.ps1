<#
.SYNOPSIS
    Proviso — Push workflow JSON into an M-Files vault via COM API
.PARAMETER JsonPath      Path to the temp JSON file
.PARAMETER VaultGuid     M-Files vault GUID
.PARAMETER ServerAddress M-Files server hostname
.PARAMETER Port          M-Files TCP port (default 2266)
.PARAMETER AuthType      "Windows" (SSO) or "MFiles" (credentials)
.PARAMETER Username      M-Files username  (only used when AuthType=MFiles)
.PARAMETER Password      M-Files password  (only used when AuthType=MFiles)
#>
param(
    [Parameter(Mandatory=$true)] [string]$JsonPath,
    [string]$VaultGuid     = '{08E9A947-7E05-4722-A890-559D36FDC8FF}',
    [string]$ServerAddress = 'localhost',
    [int]   $Port          = 2266,
    [string]$AuthType      = 'Windows',    # 'Windows' | 'MFiles'
    [string]$Username      = '',
    [string]$Password      = ''
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

    # ── 2. Connect to M-Files ─────────────────────────────────────
    pLog "Auth type: $AuthType"
    pLog "Looking up vault $VaultGuid in registered connections..."

    $app = New-Object -ComObject MFilesAPI.MFilesClientApplication

    # Find the registered VaultConnection by GUID
    $allConns = $app.GetVaultConnections()
    $conn = $null
    foreach ($c in $allConns) {
        if ($c.GetGUID() -ieq $VaultGuid) { $conn = $c; break }
    }
    if (-not $conn) {
        throw "Vault $VaultGuid is not registered in M-Files Desktop on this machine. Open M-Files Desktop and add the vault connection first."
    }
    pLog "Found vault: '$($conn.Name)' ($($conn.GetGUID()))"

    # Test connectivity first
    $testResult = $conn.TestConnectionToVaultSilent()
    pLog "Connectivity test: $testResult"

    if ($AuthType -ieq 'Windows') {
        # ── Windows SSO (current logged-on Windows user) ──────────
        pLog "Using Windows SSO (current Windows identity)"
        # MFAuthType 0 = MFAuthTypeLoggedOnWindowsUser
        $vault = $conn.LogInAs(0, 0, $false)

    } else {
        # ── M-Files Credentials ───────────────────────────────────
        if (-not $Username) { throw "Username is required for M-Files authentication" }
        pLog "Using M-Files credentials (user: $Username)"
        # MFAuthType 2 = MFAuthTypeSpecificMFilesUser
        $vault = $conn.LogInAsUser(2, $Username, $Password, $null, $null)
    }

    pOK "Authenticated to vault: '$($vault.Name)'"

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

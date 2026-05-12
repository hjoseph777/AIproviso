param(
    [Parameter(Mandatory=$true)] [string]$JsonPath,
    [string]$VaultGuid     = '{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}',
    [string]$ServerAddress = 'localhost',
    [int]   $Port          = 2266,
    [string]$AuthType      = 'Windows',
    [string]$Username      = '',
    [string]$Password      = '',
    [int]   $LicenseType   = 0
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function pLog  { param([string]$m) Write-Output "[PROGRESS] $m"; [Console]::Out.Flush() }
function pOK   { param([string]$m) Write-Output "[SUCCESS] $m";  [Console]::Out.Flush() }
function pWarn { param([string]$m) Write-Output "[WARN] $m";     [Console]::Out.Flush() }
function pErr  { param([string]$m) Write-Output "[ERROR] $m";    [Console]::Out.Flush() }
try {
    if (-not (Test-Path $JsonPath)) { throw "JSON not found: $JsonPath" }
    $json = Get-Content $JsonPath -Raw | ConvertFrom-Json
    $wf   = if ($json -is [array]) { $json[0] } else { $json }
    if (-not $wf.name)   { throw "Missing name" }
    if (-not $wf.states) { throw "Missing states" }
    pLog "Workflow: '$($wf.name)'  $($wf.states.Count) states  $($wf.transitions.Count) transitions"
    pLog "Connecting to $ServerAddress via MFilesServerApplication..."
    $srvApp = New-Object -ComObject MFilesAPI.MFilesServerApplication
    $srvApp.ConnectWithoutLogin($null, 'ncacn_ip_tcp', $ServerAddress, [string]$Port, '', '', '') | Out-Null
    pLog "Transport connected"
    if ($AuthType -ieq 'Windows') {
        pLog "Auth: Windows SSO (MFAuthType=1)"
        $vault = $srvApp.LogInAsUserToVault($VaultGuid, $null, 1, $null, $null, $null)
    } else {
        if (-not $Username) { throw "Username required for M-Files auth" }
        pLog "Auth: M-Files credentials (user: $Username)"
        $vault = $srvApp.LogInAsUserToVault($VaultGuid, $null, 3, $Username, $Password, $null)
    }
    pOK "Authenticated: '$($vault.Name)'"
    pLog "Checking for duplicate workflow..."
    $existingWFs = $vault.WorkflowOperations.GetWorkflowsAdmin()
    foreach ($e in $existingWFs) {
        if ($e.Workflow.Name -ieq $wf.name) {
            pWarn "Workflow '$($wf.name)' already exists (ID=$($e.Workflow.ID)) - skipping"
            pOK "Done (no changes made)"
            exit 0
        }
    }
    pLog "Creating workflow shell: '$($wf.name)'..."
    $wfAdmin = New-Object -ComObject MFilesAPI.WorkflowAdmin
    $wfAdmin.Workflow.Name = $wf.name
    $createdWf = $vault.WorkflowOperations.AddWorkflowAdmin($wfAdmin)
    $wfId = $createdWf.Workflow.ID
    pOK "Workflow shell created (ID=$wfId)"
    pLog "Adding $($wf.states.Count) states..."
    $nameToStateId = @{}
    $wfAdminFresh  = $vault.WorkflowOperations.GetWorkflowAdmin($wfId)
    foreach ($s in $wf.states) {
        $stAdmin      = New-Object -ComObject MFilesAPI.StateAdmin
        $stAdmin.Name = $s.name
        if ($s.PSObject.Properties['checkInOutPermissions']) {
            $stAdmin.CheckInOutPermissions = [bool]$s.checkInOutPermissions
        } else {
            $stAdmin.CheckInOutPermissions = $false
        }
        if ($s.PSObject.Properties['restrictTransitions']) {
            $stAdmin.RestrictTransitions = [bool]$s.restrictTransitions
        }
        if ($s.PSObject.Properties['preconditions'] -and $s.preconditions.Count -gt 0) {
            pWarn "    '$($s.name)': $($s.preconditions.Count) precondition(s) require Phase 2 config"
        }
        $wfAdminFresh.States.Add(-1, $stAdmin)
        if ($s.initial) { pLog "  + '$($s.name)' [INITIAL]" } else { pLog "  + '$($s.name)'" }
    }
    $vault.WorkflowOperations.UpdateWorkflowAdmin($wfAdminFresh) | Out-Null
    pOK "$($wf.states.Count) states added"
    $wfFinal = $vault.WorkflowOperations.GetWorkflowAdmin($wfId)
    foreach ($st in $wfFinal.States) { $nameToStateId[$st.Name] = $st.ID }
    pLog "State ID map built: $($nameToStateId.Count) entries"
    $initState = $wf.states | Where-Object { $_.initial -eq $true } | Select-Object -First 1
    if ($initState -and $nameToStateId.ContainsKey($initState.name)) {
        $wfInit = $vault.WorkflowOperations.GetWorkflowAdmin($wfId)
        foreach ($st in $wfInit.States) {
            if ($st.Name -ieq $initState.name) { $st.StateFlag = 1 }
        }
        $vault.WorkflowOperations.UpdateWorkflowAdmin($wfInit) | Out-Null
        pLog "Initial state set: '$($initState.name)'"
    } else { pWarn "No initial state found - set manually in M-Files Admin" }
    pLog "Adding $($wf.transitions.Count) transitions..."
    $skipped = 0
    $wfForTr = $vault.WorkflowOperations.GetWorkflowAdmin($wfId)
    foreach ($t in $wf.transitions) {
        $fromId = $nameToStateId[$t.from]
        $toId   = $nameToStateId[$t.to]
        if (-not $fromId) { pWarn "Unknown FROM '$($t.from)' - skipped"; $skipped++; continue }
        if (-not $toId)   { pWarn "Unknown TO '$($t.to)' - skipped";     $skipped++; continue }
        $trAdmin           = New-Object -ComObject MFilesAPI.StateTransition
        $trAdmin.FromState = $fromId
        $trAdmin.ToState   = $toId
        if ($t.PSObject.Properties['name'] -and $t.name) {
            $trAdmin.Name = $t.name
        } else {
            $trAdmin.Name = "$($t.from) to $($t.to)"
        }
        if ($t.PSObject.Properties['allowedUsers'] -and $t.allowedUsers.Count -gt 0) {
            pWarn "    Transition '$($trAdmin.Name)': allowedUsers ACL requires Phase 2 config"
        }
        $wfForTr.StateTransitions.Add(-1, $trAdmin)
        pLog "  + $($t.from) -> $($t.to)"
    }
    if ($skipped -lt $wf.transitions.Count) {
        $vault.WorkflowOperations.UpdateWorkflowAdmin($wfForTr) | Out-Null
    }
    if ($skipped -gt 0) { pWarn "$skipped transition(s) skipped" }
    pOK ""
    pOK "SUCCESS: Workflow '$($wf.name)' created (ID=$wfId)"
    pOK "$($wf.states.Count) states  $($wf.transitions.Count - $skipped) transitions"
    pWarn "Phase 2: Preconditions, ACLs, and permissions via M-Files Admin"
    exit 0
} catch {
    pErr $_.Exception.Message
    exit 1
}

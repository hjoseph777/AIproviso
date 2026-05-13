param(
    [string]$VaultGuid     = '{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}',
    [string]$ServerAddress = 'localhost',
    [int]   $Port          = 2266,
    [string]$AuthType      = 'Windows',
    [string]$Username      = '',
    [string]$Password      = '',
    [switch]$ListOnly,
    [string]$WorkflowIds   = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function pLog  { param([string]$m) Write-Output "[PROGRESS] $m"; [Console]::Out.Flush() }

function Is-VisibleWorkflow {
    param([object]$wf)

    if ($null -eq $wf) { return $false }

    # Exclude deleted/hidden/system-like entries when those flags are available.
    foreach ($flag in @('Deleted','IsDeleted','Hidden','IsHidden')) {
        try {
            if ($wf.PSObject.Properties.Name -contains $flag) {
                if ([bool]$wf.$flag) { return $false }
            }
        } catch { }
    }

    return $true
}

try {
    pLog "Connecting to $ServerAddress via MFilesServerApplication..."
    $srvApp = New-Object -ComObject MFilesAPI.MFilesServerApplication
    $srvApp.ConnectWithoutLogin($null, 'ncacn_ip_tcp', $ServerAddress, [string]$Port, '', '', '') | Out-Null
    
    if ($AuthType -ieq 'Windows') {
        pLog "Auth: Windows SSO (MFAuthType=1)"
        $vault = $srvApp.LogInAsUserToVault($VaultGuid, $null, 1, $null, $null, $null)
    } else {
        pLog "Auth: M-Files user '$Username' (MFAuthType=2)"
        $vault = $srvApp.LogInAsUserToVault($VaultGuid, $null, 2, $Username, $Password, $null)
    }
    pLog "Connected to vault."

    if ($ListOnly) {
        $list = @()
        $seen = @{}

        # Prefer non-admin list to match what users expect in vault UI.
        # Some environments return extra admin-scope entries via GetWorkflowsAdmin().
        try {
            $workflows = $vault.WorkflowOperations.GetWorkflows()
            foreach ($wf in $workflows) {
                if (-not (Is-VisibleWorkflow $wf)) { continue }
                $id = [int]$wf.ID
                $name = [string]$wf.Name
                if ($id -le 0 -or [string]::IsNullOrWhiteSpace($name)) { continue }
                if ($seen.ContainsKey($id)) { continue }
                $seen[$id] = $true
                $list += @{ id = $id; name = $name }
            }
        }
        catch {
            # Fallback for environments where GetWorkflows() is not available.
            $workflows = $vault.WorkflowOperations.GetWorkflowsAdmin()
            foreach ($wf in $workflows) {
                $core = $wf.Workflow
                if (-not (Is-VisibleWorkflow $core)) { continue }
                $id = [int]$core.ID
                $name = [string]$core.Name
                if ($id -le 0 -or [string]::IsNullOrWhiteSpace($name)) { continue }
                if ($seen.ContainsKey($id)) { continue }
                $seen[$id] = $true
                $list += @{ id = $id; name = $name }
            }
        }

        $json = $list | ConvertTo-Json -Depth 5 -Compress
        Write-Output "[RESULT]$json"
        exit 0
    }

    if (-not $WorkflowIds) {
        throw "Must provide -WorkflowIds when not using -ListOnly"
    }

    $ids = $WorkflowIds.Split(',') | ForEach-Object { [int]$_ }
    $results = @()

    foreach ($id in $ids) {
        pLog "Fetching workflow ID $id..."
        $wfAdmin = $vault.WorkflowOperations.GetWorkflowAdmin($id)
        
        $wfJson = @{
            id          = $wfAdmin.Workflow.ID
            name        = $wfAdmin.Workflow.Name
            source      = 'mfiles'
            importedAt  = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
            states      = @()
            transitions = @()
            scripts     = @()
            rules       = @()
        }

        # Build ID to Name map for transitions
        $stateMap = @{}
        foreach ($s in $wfAdmin.States) {
            $stateMap[$s.ID] = $s.Name
            
            # Map state
            $stateJson = @{
                name = $s.Name
                initial = $false # Initial logic might need tweaking based on M-Files semantics, usually ID=0 or logic.
            }
            if ($s.SemanticAliases -and $s.SemanticAliases.Value) {
                $stateJson.alias = $s.SemanticAliases.Value
            }
            # Add action text if present (to avoid data loss)
            if ($s.ActionRunVBScript) {
                $wfJson.scripts += @{
                    state = $s.Name
                    text  = $s.ActionRunVBScriptDefinition
                }
            }
            $wfJson.states += $stateJson
        }

        # First state might be considered initial if there's no clear 'initial' property in StateAdmin
        if ($wfJson.states.Count -gt 0) {
            $wfJson.states[0].initial = $true
        }

        foreach ($t in $wfAdmin.StateTransitions) {
            $fromName = if ($t.FromState) { $stateMap[$t.FromState] } else { $null }
            $toName   = if ($t.ToState)   { $stateMap[$t.ToState] } else { $null }
            
            if ($fromName -and $toName) {
                $transJson = @{
                    from  = $fromName
                    to    = $toName
                    label = $t.Name
                }
                $wfJson.transitions += $transJson
            }
        }
        
        $results += $wfJson
    }

    $finalJson = $results | ConvertTo-Json -Depth 10 -Compress
    Write-Output "[RESULT]$finalJson"
} catch {
    $msg = $_.Exception.Message
    Write-Output "[ERROR] $msg"
    exit 1
}

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
        $workflows = $vault.WorkflowOperations.GetWorkflowsAdmin()
        $list = @()
        foreach ($wf in $workflows) {
            $list += @{
                id   = $wf.Workflow.ID
                name = $wf.Workflow.Name
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
                # Capture transition conditions/scripts
                if ($t.SelectStateVBScript) {
                    $wfJson.rules += @{
                        text = "Transition $($t.Name) has SelectStateVBScript: $($t.SelectStateVBScript)"
                    }
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

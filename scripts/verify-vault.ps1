param(
    [string]$VaultGuid     = '{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}',
    [string]$ServerAddress = 'localhost',
    [int]   $Port          = 2266
)
$ErrorActionPreference = 'Stop'
try {
    $srvApp = New-Object -ComObject MFilesAPI.MFilesServerApplication
    $srvApp.ConnectWithoutLogin($null, 'ncacn_ip_tcp', $ServerAddress, [string]$Port, '', '', '') | Out-Null
    Write-Output "Connected to $ServerAddress"

    # MFAuthType 1 = Windows SSO (server-side enum, confirmed)
    $vault = $srvApp.LogInAsUserToVault($VaultGuid, $null, 1, $null, $null, $null)
    Write-Output "Vault: $($vault.Name)  [$VaultGuid]"
    Write-Output "Authenticated (Windows SSO)"
    Write-Output ""

    $wfsAdmin = $vault.WorkflowOperations.GetWorkflowsAdmin()
    Write-Output "Total workflows: $($wfsAdmin.Count)"
    Write-Output "------------------------------------"
    foreach ($w in $wfsAdmin) {
        $states = ($w.States | ForEach-Object { $_.Name }) -join ', '
        Write-Output "ID=$($w.Workflow.ID)  [$($w.Workflow.Name)]  States=$($w.States.Count)"
        Write-Output "  $states"
        Write-Output ""
    }
    if ($wfsAdmin.Count -eq 0) { Write-Output "No workflows found -- vault is empty." }
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}

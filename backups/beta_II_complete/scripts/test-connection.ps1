param(
    [string]$VaultGuid     = '{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}',
    [string]$ServerAddress = 'localhost',
    [int]   $Port          = 2266,
    [string]$AuthType      = 'Windows',
    [string]$Username      = '',
    [string]$Password      = ''
)
$ErrorActionPreference = 'Stop'
try {
    $srvApp = New-Object -ComObject MFilesAPI.MFilesServerApplication
    $srvApp.ConnectWithoutLogin($null, 'ncacn_ip_tcp', $ServerAddress, [string]$Port, '', '', '') | Out-Null
    if ($AuthType -ieq 'Windows') {
        $vault = $srvApp.LogInAsUserToVault($VaultGuid, $null, 1, $null, $null, $null)
    } else {
        if (-not $Username) { throw "Username required" }
        $vault = $srvApp.LogInAsUserToVault($VaultGuid, $null, 3, $Username, $Password, $null)
    }
    Write-Output "OK:$($vault.Name)"
    exit 0
} catch {
    Write-Output "ERR:$($_.Exception.Message.Split([char]10)[0])"
    exit 1
}

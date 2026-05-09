# Test 1: Windows SSO (current Windows user)
try {
    $app   = New-Object -ComObject MFilesAPI.MFilesClientApplication
    $conn  = $app.GetVaultConnection('Acme')
    # MFAuthType 0 = MFAuthTypeLoggedOnWindowsUser
    $vault = $conn.LogInAs(0, 0, $false)
    Write-Host "SSO SUCCESS: '$($vault.Name)' | UserID=$($vault.SessionInfo.UserID)"
} catch {
    Write-Host "SSO FAILED: $($_.Exception.Message.Split("`n")[0])"
}

# Test 2: Try lowercase username
try {
    $app2  = New-Object -ComObject MFilesAPI.MFilesClientApplication
    $conn2 = $app2.GetVaultConnection('Acme')
    $vault2 = $conn2.LogInAsUser(2, 'betty.black', 'bb', $null, $null)
    Write-Host "MFiles (betty.black) SUCCESS: '$($vault2.Name)'"
} catch {
    Write-Host "MFiles (betty.black) FAILED: $($_.Exception.Message.Split("`n")[0])"
}

# Test 3: Try admin user
try {
    $app3  = New-Object -ComObject MFilesAPI.MFilesClientApplication
    $conn3 = $app3.GetVaultConnection('Acme')
    $vault3 = $conn3.LogInAsUser(2, 'admin', '', $null, $null)
    Write-Host "MFiles (admin/blank) SUCCESS: '$($vault3.Name)'"
} catch {
    Write-Host "MFiles (admin/blank) FAILED: $($_.Exception.Message.Split("`n")[0])"
}

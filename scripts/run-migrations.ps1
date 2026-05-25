#!/usr/bin/env pwsh
# =============================================================================
# run-migrations.ps1
# Runs all MOD-00 migration files against the proviso database in sequence.
# Execute AFTER docker compose up (postgres must be healthy).
# =============================================================================

param(
    [string]$Host     = "localhost",
    [string]$Port     = "5432",
    [string]$User     = "proviso",
    [string]$Password = "proviso_dev_password",
    [string]$Database = "proviso",
    [switch]$SkipSeed  # Pass -SkipSeed to omit 004_seed_data.sql in production
)

$ErrorActionPreference = "Stop"
$env:PGPASSWORD = $Password

$migrationDir = Join-Path $PSScriptRoot "..\core\migrations"
$migrations   = @(
    "001_initial_schema.sql",
    "002_rls_policies.sql",
    "003_triggers.sql"
)
if (-not $SkipSeed) {
    $migrations += "004_seed_data.sql"
}

Write-Host "`n=== AI Proviso — MOD-00 Migrations ===" -ForegroundColor Cyan
Write-Host "Target: $User@$Host:$Port/$Database`n"

$psqlCmd = "psql"

# Verify psql is available
try {
    $null = & $psqlCmd --version 2>&1
} catch {
    Write-Error "psql not found. Install PostgreSQL client tools or run from inside the postgres container."
    exit 1
}

# Wait for postgres to be ready
Write-Host "Waiting for PostgreSQL..." -ForegroundColor Yellow
$maxWait = 30
$waited  = 0
do {
    $ready = & $psqlCmd -h $Host -p $Port -U $User -d postgres -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
    $waited += 2
    if ($waited -ge $maxWait) {
        Write-Error "PostgreSQL not ready after ${maxWait}s. Is docker compose up?"
        exit 1
    }
} while ($true)
Write-Host "PostgreSQL ready.`n" -ForegroundColor Green

# Run each migration
foreach ($file in $migrations) {
    $path = Join-Path $migrationDir $file
    if (-not (Test-Path $path)) {
        Write-Error "Migration file not found: $path"
        exit 1
    }
    Write-Host "  Running $file..." -NoNewline
    $output = & $psqlCmd -h $Host -p $Port -U $User -d postgres -f $path 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
    Write-Host " OK" -ForegroundColor Green
}

Write-Host "`n=== All migrations applied successfully ===" -ForegroundColor Cyan
Write-Host "Dev tenant UUID : 00000000-0000-0000-0000-000000000001"
Write-Host "Dev admin email : admin@proviso.dev"
Write-Host "Dev admin UUID  : 00000000-0000-0000-0000-000000000002`n"

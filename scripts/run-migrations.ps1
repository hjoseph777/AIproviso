#!/usr/bin/env pwsh
# =============================================================================
# run-migrations.ps1
# Runs all MOD-00 migration files against the proviso database in sequence.
# Execute AFTER docker compose up (postgres must be healthy).
# =============================================================================

param(
    [string]$DbHost   = "localhost",
    [string]$Port     = "5432",
    [string]$User     = "proviso",
    [SecureString]$Password = (ConvertTo-SecureString "proviso_dev_password" -AsPlainText -Force),
    [string]$Database = "proviso",
    [switch]$SkipSeed  # Pass -SkipSeed to omit 004_seed_data.sql in production
)

$ErrorActionPreference = "Stop"
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $Password).Password

$migrationDir = Join-Path $PSScriptRoot "..\core\migrations"
$migrations   = @(
    "001_initial_schema.sql",
    "002_rls_policies.sql",
    "003_triggers.sql"
)
if (-not $SkipSeed) {
    $migrations += "004_seed_data.sql"
}
$migrations += "005_workflow_runtime.sql"
$migrations += "006_workflow_history_rule_id.sql"

Write-Host ""
Write-Host "=== AI Proviso ??? MOD-00 Migrations ===" -ForegroundColor Cyan
Write-Host "Target: ${User}@${DbHost}:${Port}/${Database}"
Write-Host ""

# Wait for postgres to be ready
Write-Host "Waiting for PostgreSQL..." -ForegroundColor Yellow
$maxWait = 30
$waited  = 0
do {
    $null = docker exec -i proviso-postgres psql -U $User -d postgres -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
    $waited += 2
    if ($waited -ge $maxWait) {
        Write-Error "PostgreSQL not ready after ${maxWait}s. Is docker compose up?"
        exit 1
    }
} while ($true)
Write-Host "PostgreSQL ready." -ForegroundColor Green
Write-Host ""

# Track applied migrations so incremental schema updates can run safely.
$createMigrationsTable = @"
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
"@
$null = docker exec -i proviso-postgres psql -U $User -d $Database -v ON_ERROR_STOP=1 -c $createMigrationsTable 2>&1

$schemaCheck = docker exec -i proviso-postgres psql -U $User -d $Database -t -A -c "SELECT to_regclass('public.tenant_configurations')" 2>&1
$appliedCountRaw = docker exec -i proviso-postgres psql -U $User -d $Database -t -A -c "SELECT COUNT(*) FROM schema_migrations" 2>&1
$appliedCount = 0
if ($LASTEXITCODE -eq 0) {
    [void][int]::TryParse($appliedCountRaw.Trim(), [ref]$appliedCount)
}

if ($LASTEXITCODE -eq 0 -and $schemaCheck.Trim() -eq "tenant_configurations" -and $appliedCount -eq 0) {
    Write-Host "Existing base schema detected without migration history. Baseline markers will be created for 001-004." -ForegroundColor Yellow
    $baselineFiles = @("001_initial_schema.sql", "002_rls_policies.sql", "003_triggers.sql", "004_seed_data.sql")
    foreach ($baseline in $baselineFiles) {
        $baselineSql = "INSERT INTO schema_migrations (filename) VALUES ('$baseline') ON CONFLICT (filename) DO NOTHING"
        $null = docker exec -i proviso-postgres psql -U $User -d $Database -v ON_ERROR_STOP=1 -c $baselineSql 2>&1
    }
}

# Copy migrations to container
docker cp "$migrationDir/." proviso-postgres:/migrations

# Run each migration
foreach ($file in $migrations) {
    $path = Join-Path $migrationDir $file
    if (-not (Test-Path $path)) {
        Write-Error "Migration file not found: $path"
        exit 1
    }
    $alreadyApplied = docker exec -i proviso-postgres psql -U $User -d $Database -t -A -c "SELECT 1 FROM schema_migrations WHERE filename = '$file'" 2>&1
    $alreadyAppliedValue = ("$alreadyApplied").Trim()
    if ($LASTEXITCODE -eq 0 -and $alreadyAppliedValue -eq "1") {
        Write-Host "  Skipping $file (already applied)" -ForegroundColor DarkYellow
        continue
    }
    Write-Host "  Running $file..." -NoNewline
    $ErrorActionPreference = "Continue"
    $output = docker exec -i proviso-postgres psql -U $User -d postgres -v ON_ERROR_STOP=1 -f "/migrations/$file" 2>&1
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($exitCode -ne 0) {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
    $recordApplied = "INSERT INTO schema_migrations (filename) VALUES ('$file') ON CONFLICT (filename) DO NOTHING"
    $null = docker exec -i proviso-postgres psql -U $User -d $Database -v ON_ERROR_STOP=1 -c $recordApplied 2>&1
    Write-Host " OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== All migrations applied successfully ===" -ForegroundColor Cyan
Write-Host "Dev tenant UUID : 00000000-0000-0000-0000-000000000001"
Write-Host "Dev admin email : admin@proviso.dev"
Write-Host "Dev admin UUID  : 00000000-0000-0000-0000-000000000002"
Write-Host ""

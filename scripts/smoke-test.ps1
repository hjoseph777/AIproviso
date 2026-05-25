#!/usr/bin/env pwsh
# =============================================================================
# smoke-test.ps1
# Week 1 Acceptance Test — Confirms the full event path is live:
#   Backend API → invoice row created → OCR job queued →
#   invoice.received fired → n8n webhook receives + ACKs
#
# Run AFTER: docker compose up + run-migrations.ps1
# =============================================================================

param(
    [string]$BackendUrl = "http://localhost:5000",
    [string]$N8nUrl     = "http://localhost:5678",
    [string]$TenantId   = "00000000-0000-0000-0000-000000000001"
)

$ErrorActionPreference = "Stop"
$pass = 0
$fail = 0

function Check($label, $condition, $detail = "") {
    if ($condition) {
        Write-Host "  [PASS] $label" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] $label" + $(if ($detail) { " — $detail" } else { "" }) -ForegroundColor Red
        $script:fail++
    }
}

Write-Host "`n=== AI Proviso — Week 1 Smoke Test ===" -ForegroundColor Cyan
Write-Host "Backend : $BackendUrl"
Write-Host "n8n     : $N8nUrl"
Write-Host "Tenant  : $TenantId`n"

# ── Step 1: Backend liveness ──────────────────────────────────────────────────
Write-Host "[ 1 ] Backend liveness check..."
try {
    $health = Invoke-RestMethod -Uri "$BackendUrl/health" -Method GET -TimeoutSec 10
    Check "GET /health returns status=ok" ($health.status -eq "ok")
} catch {
    Check "GET /health reachable" $false $_.Exception.Message
}

# ── Step 2: Database + Redis deep health ──────────────────────────────────────
Write-Host "[ 2 ] Deep health check (DB + Redis)..."
try {
    $dbHealth = Invoke-RestMethod -Uri "$BackendUrl/health/db" -Method GET -TimeoutSec 15
    Check "PostgreSQL connected"    ($dbHealth.postgres.ok -eq $true)
    Check "Redis connected"         ($dbHealth.redis.ok -eq $true)
} catch {
    Check "GET /health/db reachable" $false $_.Exception.Message
}

# ── Step 3: Fire invoice.received ─────────────────────────────────────────────
Write-Host "[ 3 ] Firing invoice.received via POST /api/intake/upload..."
$invoiceId = $null
$correlationId = $null
try {
    $body   = @{ tenant_id = $TenantId; paperless_id = "SMOKE-TEST-001" } | ConvertTo-Json
    $intake = Invoke-RestMethod -Uri "$BackendUrl/api/intake/upload" `
                                -Method POST `
                                -Body $body `
                                -ContentType "application/json" `
                                -TimeoutSec 30

    $invoiceId     = $intake.invoice_id
    $correlationId = $intake.correlation_id

    Check "Response contains invoice_id"     (-not [string]::IsNullOrEmpty($invoiceId))
    Check "Response contains correlation_id" (-not [string]::IsNullOrEmpty($correlationId))
    Check "Response status = received"       ($intake.status -eq "received")
    Check "n8n ACK received"                 ($intake.n8n_ack -ne $null)

    Write-Host "    invoice_id     = $invoiceId"
    Write-Host "    correlation_id = $correlationId"
    Write-Host "    n8n_ack        = $($intake.n8n_ack | ConvertTo-Json -Compress)"
} catch {
    Check "POST /api/intake/upload succeeded" $false $_.Exception.Message
}

# ── Step 4: Confirm OCR queue depth > 0 ──────────────────────────────────────
Write-Host "[ 4 ] Checking OCR queue depth..."
try {
    $queueInfo = Invoke-RestMethod -Uri "$BackendUrl/api/debug/queue-depth" -Method GET -TimeoutSec 10
    Check "OCR queue depth >= 1" ($queueInfo.ocr_queue_depth -ge 1)
    Write-Host "    ocr_queue_depth = $($queueInfo.ocr_queue_depth)"
    Write-Host "    dlq_depth       = $($queueInfo.dlq_depth)"
} catch {
    Check "GET /api/debug/queue-depth reachable" $false $_.Exception.Message
}

# ── Step 5: n8n webhook endpoint reachable ────────────────────────────────────
Write-Host "[ 5 ] Confirming n8n invoice.received webhook endpoint..."
try {
    $testEnvelope = @{
        event          = "invoice.received"
        schema_version = "1.0.0"
        invoice_id     = $(if ($invoiceId) { $invoiceId } else { [guid]::NewGuid().ToString() })
        tenant_id      = $TenantId
        payload        = @{ paperless_id = "SMOKE-TEST-DIRECT" }
        source_module  = "smoke-test"
        correlation_id = [guid]::NewGuid().ToString()
        timestamp      = (Get-Date -Format "o")
    } | ConvertTo-Json

    $n8nResp = Invoke-RestMethod -Uri "$N8nUrl/webhook/invoice/received" `
                                  -Method POST `
                                  -Body $testEnvelope `
                                  -ContentType "application/json" `
                                  -TimeoutSec 15

    Check "n8n webhook /invoice/received responds" ($n8nResp -ne $null)
    Check "n8n ACK contains ack=true"             ($n8nResp.ack -eq $true)
} catch {
    Check "n8n /webhook/invoice/received reachable" $false $_.Exception.Message
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "`n=== Results ===" -ForegroundColor Cyan
Write-Host "  PASS: $pass" -ForegroundColor Green
Write-Host "  FAIL: $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })

if ($fail -eq 0) {
    Write-Host "`n  Week 1 gate: PASS — invoice.received fires end-to-end." -ForegroundColor Green
    Write-Host "  Ready to begin Week 2: MOD-01 Intake implementation.`n"
    exit 0
} else {
    Write-Host "`n  Week 1 gate: FAIL — resolve the failures above before Week 2.`n" -ForegroundColor Red
    exit 1
}

#!/usr/bin/env pwsh

param(
    [string]$BackendUrl = "http://localhost:5000",
    [string]$TenantId = "00000000-0000-0000-0000-000000000001",
    [string]$TimerWorkerContainer = "proviso-timer-worker"
)

$ErrorActionPreference = "Stop"
$pass = 0
$fail = 0

function Check($label, $condition, $detail = "") {
    if ($condition) {
        Write-Host "  [PASS] $label" -ForegroundColor Green
        $script:pass++
    } else {
        $detailStr = if ($detail) { " - $detail" } else { "" }
        Write-Host "  [FAIL] $label$detailStr" -ForegroundColor Red
        $script:fail++
    }
}

function Get-RuntimeView($invoiceId) {
    Invoke-RestMethod -Uri "$BackendUrl/api/runtime-view?invoice_id=$invoiceId" -Method GET -TimeoutSec 15
}

function Get-StateValue($runtime, $label) {
    $row = $runtime.data.stateIntent.rows | Where-Object { $_[0] -eq $label } | Select-Object -First 1
    if ($null -eq $row) { return $null }
    return $row[1]
}

function Get-PersistedValue($runtime, $label) {
    $row = $runtime.data.persisted | Where-Object { $_[0] -eq $label } | Select-Object -First 1
    if ($null -eq $row) { return $null }
    return $row[1]
}

function Get-DiagnosticBlock($runtime, $title) {
    return $runtime.data.diagnostics | Where-Object { $_.title -eq $title } | Select-Object -First 1
}

function Wait-ForCondition($label, [scriptblock]$probe, [scriptblock]$predicate, [int]$attempts = 20, [int]$delaySeconds = 2) {
    for ($i = 0; $i -lt $attempts; $i++) {
        $value = & $probe
        if (& $predicate $value) {
            Check $label $true
            return $value
        }
        Start-Sleep -Seconds $delaySeconds
    }
    Check $label $false
    return $null
}

Write-Host ""
Write-Host "=== AI Proviso Runtime Smoke Test ===" -ForegroundColor Cyan
Write-Host "Backend      : $BackendUrl"
Write-Host "Tenant       : $TenantId"
Write-Host "Timer Worker : $TimerWorkerContainer"
Write-Host ""

# ── Fix 3: Image freshness check ─────────────────────────────────────────────
# Warns when a container image is older than its Dockerfile.
# Caught the SQL 42601 recurrence: code fixed in source, container not rebuilt.
Write-Host "[ 0 ] Container image freshness check..."
$staleImages = 0
$repoRoot    = Split-Path $PSScriptRoot -Parent
$checks      = @(
    @("proviso-workflow-engine", "workflow-engine/Dockerfile", "workflow-engine"),
    @("proviso-ocr-worker",      "ocr-worker/Dockerfile",      "ocr-worker")
)
foreach ($chk in $checks) {
    $cName = $chk[0]; $dfRel = $chk[1]; $rebuildKey = $chk[2]
    $dfPath = Join-Path $repoRoot $dfRel
    if (-not (Test-Path $dfPath)) {
        Write-Host "  [SKIP] $cName - Dockerfile not found" -ForegroundColor DarkGray
    } else {
        $createdStr = docker inspect $cName --format "{{.Created}}" 2>$null
        if (-not $createdStr) {
            Write-Host "  [SKIP] $cName - not running" -ForegroundColor DarkGray
        } else {
            $dfMtime       = (Get-Item $dfPath).LastWriteTimeUtc
            $containerTime = ([datetime]::Parse($createdStr)).ToUniversalTime()
            if ($dfMtime -gt $containerTime) {
                Write-Host "  [WARN] $cName - image STALE (Dockerfile newer than container)" -ForegroundColor Yellow
                Write-Host "         Run: docker compose build $rebuildKey" -ForegroundColor DarkYellow
                $staleImages++
            } else {
                Write-Host "  [OK]   $cName - image is current" -ForegroundColor DarkGreen
            }
        }
    }
}
if ($staleImages -gt 0) {
    Write-Host "  WARNING: $staleImages stale container(s) - results may not reflect latest code." -ForegroundColor Yellow
}
Write-Host ""
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "[ 1 ] Backend liveness check..."
try {
    $health = Invoke-RestMethod -Uri "$BackendUrl/health" -Method GET -TimeoutSec 10
    Check "GET /health returns status=ok" ($health.status -eq "ok")
} catch {
    Check "GET /health reachable" $false $_.Exception.Message
}

Write-Host "[ 2 ] Deep health check (DB + Redis)..."
try {
    $dbHealth = Invoke-RestMethod -Uri "$BackendUrl/health/db" -Method GET -TimeoutSec 15
    Check "PostgreSQL connected" ($dbHealth.postgres.ok -eq $true)
    Check "Redis connected" ($dbHealth.redis.ok -eq $true)
} catch {
    Check "GET /health/db reachable" $false $_.Exception.Message
}

$invoiceId = $null

Write-Host "[ 3 ] Creating intake invoice..."
try {
    $body = @{ tenant_id = $TenantId; paperless_id = "SMOKE-TEST-001" } | ConvertTo-Json
    $intake = Invoke-RestMethod -Uri "$BackendUrl/api/intake/upload" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    $invoiceId = $intake.invoice_id
    Check "Response contains invoice_id" (-not [string]::IsNullOrWhiteSpace($invoiceId))
    Check "Intake status = received" ($intake.status -eq "received")
} catch {
    Check "POST /api/intake/upload succeeded" $false $_.Exception.Message
}

$runtimeAfterExtraction = $null
if ($invoiceId) {
    Write-Host "[ 4 ] Waiting for OCR + workflow persistence..."
    $runtimeAfterExtraction = Wait-ForCondition "Invoice reaches extracted runtime state" {
        Get-RuntimeView $invoiceId
    } {
        param($runtime)
        (Get-StateValue $runtime "Current state") -eq "extracted"
    }

    if ($runtimeAfterExtraction) {
        Check "workflow_timers shows one open timer after extraction" ((Get-PersistedValue $runtimeAfterExtraction "workflow_timers") -eq "1 open")
    }
}

$runtimeAfterReview = $null
if ($invoiceId) {
    Write-Host "[ 5 ] Routing invoice to review through AP endpoint..."
    try {
        $review = Invoke-RestMethod -Uri "$BackendUrl/api/invoices/$invoiceId/review" -Method POST -Body '{}' -ContentType "application/json" -TimeoutSec 15
        Check "POST /api/invoices/:id/review returns item" ($review.item.id -eq $invoiceId)
        Check "Review endpoint returns UI status=review" ($review.item.status -eq "review")
    } catch {
        Check "POST /api/invoices/:id/review succeeded" $false $_.Exception.Message
    }

    $runtimeAfterReview = Wait-ForCondition "Runtime view reflects exception state after review" {
        Get-RuntimeView $invoiceId
    } {
        param($runtime)
        (Get-StateValue $runtime "Current state") -eq "exception" -and $runtime.data.transitionIntent.title -eq "invoice.exception"
    }

    if ($runtimeAfterReview) {
        Check "Runtime trace recorded exception transition" ($runtimeAfterReview.data.trace[0][1] -match "exception")
        Check "Runtime reports one open timer after review" ((Get-PersistedValue $runtimeAfterReview "workflow_timers") -eq "1 open")
    }
}

$runtimeAfterCancel = $null
if ($invoiceId) {
    Write-Host "[ 6 ] Enqueueing BullMQ timer cancellation callback..."
    try {
        $enqueueOutput = docker exec $TimerWorkerContainer node dispatch-timer-event.mjs --invoice-id $invoiceId --tenant-id $TenantId --timer-key sla.current --status cancelled --job-reference smoke-test --note smoke-test 2>&1
        Check "BullMQ timer callback job enqueued" ($LASTEXITCODE -eq 0) ($enqueueOutput -join "`n")
    } catch {
        Check "BullMQ timer callback job enqueued" $false $_.Exception.Message
    }

    $runtimeAfterCancel = Wait-ForCondition "Signed timer webhook updates runtime view" {
        Get-RuntimeView $invoiceId
    } {
        param($runtime)
        $timerDiag = Get-DiagnosticBlock $runtime "Latest timer"
        ((Get-PersistedValue $runtime "workflow_timers") -eq "0 open") -and $timerDiag.copy.Contains("status: cancelled")
    }

    if ($runtimeAfterCancel) {
        $timerDiag = Get-DiagnosticBlock $runtimeAfterCancel "Latest timer"
        Check "Latest timer diagnostic shows cancelled status" ($timerDiag.copy.Contains("status: cancelled"))
    }
}

Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Cyan
Write-Host "  PASS: $pass" -ForegroundColor Green
Write-Host "  FAIL: $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })

if ($fail -eq 0) {
    Write-Host ""
    Write-Host "  Runtime gate: PASS - intake, AP review, workflow persistence, and signed timer callback all succeeded." -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "  Runtime gate: FAIL - resolve the failures above before relying on the integrated flow." -ForegroundColor Red
Write-Host ""
exit 1

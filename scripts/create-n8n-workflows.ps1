# AI Proviso — n8n Workflow Bootstrap
# Idempotent: safe to re-run on a fresh container or an existing instance.
# n8n 2.x: Basic Auth removed. Session cookie for admin ops (archive, key mgmt);
#           X-N8N-API-KEY for workflow CRUD via /api/v1/.
#
# Gaps addressed:
#   Gap 1 — API key is idempotent: reuse from .env if valid; delete-by-label before
#            recreating so there is never more than one 'proviso-automation' key.
#   Gap 2 — Delete sequence: deactivate → archive (REST) → delete (/api/v1/).
#            Per-workflow error handling; loop never stops on a single failure.
#   Gap 3 — .env written safely: replace existing N8N_API_KEY line or append once.
#   Gap 4 — Name filter: case-insensitive .Contains("proviso") not a glob match.
#   Gap 5 — Built-in smoke test: POST to all 9 paths, assert ack=true, exit 1 on
#            any failure so CI/CD pipelines catch regressions.

[CmdletBinding()]
param(
    [string]$N8nUrl       = "http://localhost:5678",
    [string]$Email        = "admin@proviso.local",
    [string]$Password     = "Changeme_n8n1",
    [string]$FirstName    = "Proviso",
    [string]$LastName     = "Admin",
    [switch]$RegenerateKey   # drop + recreate the 'proviso-automation' key
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Constants ──────────────────────────────────────────────────────
$KEY_LABEL = "proviso-automation"
$envPath   = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.env"))

# ── Colour helpers ─────────────────────────────────────────────────
function StepHeader([int]$n, [string]$label) {
    Write-Host ""
    Write-Host "[ $n ] $label" -ForegroundColor Yellow
}
function OK  ([string]$m) { Write-Host "  OK  $m" -ForegroundColor Green }
function WARN([string]$m) { Write-Host "  WRN $m" -ForegroundColor DarkYellow }
function FAIL([string]$m) { Write-Host "  ERR $m" -ForegroundColor Red }

# ── 9 Proviso event definitions ────────────────────────────────────
$events = @(
    @{ name = "proviso-invoice-received";  path = "invoice-received";  event = "invoice.received"  }
    @{ name = "proviso-invoice-extracted"; path = "invoice-extracted"; event = "invoice.extracted" }
    @{ name = "proviso-invoice-matched";   path = "invoice-matched";   event = "invoice.matched"   }
    @{ name = "proviso-invoice-exception"; path = "invoice-exception"; event = "invoice.exception" }
    @{ name = "proviso-invoice-resolved";  path = "invoice-resolved";  event = "invoice.resolved"  }
    @{ name = "proviso-invoice-approved";  path = "invoice-approved";  event = "invoice.approved"  }
    @{ name = "proviso-invoice-posted";    path = "invoice-posted";    event = "invoice.posted"    }
    @{ name = "proviso-invoice-rejected";  path = "invoice-rejected";  event = "invoice.rejected"  }
    @{ name = "proviso-audit-event";       path = "audit-event";       event = "audit.event"       }
)

Write-Host ""
Write-Host "=== AI Proviso n8n Workflow Bootstrap ===" -ForegroundColor Cyan
Write-Host "  Target  : $N8nUrl"          -ForegroundColor Gray
Write-Host "  Owner   : $Email"           -ForegroundColor Gray
Write-Host "  Env     : $envPath"         -ForegroundColor Gray
Write-Host "  Workflows: $($events.Count)" -ForegroundColor Gray

# ══════════════════════════════════════════════════════════════════
# STEP 0 — Wait for n8n
# ══════════════════════════════════════════════════════════════════
StepHeader 0 "Waiting for n8n"
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $h = Invoke-RestMethod -Uri "$N8nUrl/healthz" -Method GET -TimeoutSec 5
        if ($h.status -eq "ok") { $ready = $true; break }
    } catch { }
    Write-Host "  ... $($i * 2)s" -ForegroundColor DarkGray
    Start-Sleep 2
}
if (-not $ready) { FAIL "n8n not ready after 60 s"; exit 1 }
OK "n8n is ready"

# ══════════════════════════════════════════════════════════════════
# STEP 1 — Session login / owner setup
# Always establishes $session so archive calls work in Step 3.
# ══════════════════════════════════════════════════════════════════
StepHeader 1 "Establishing session"
$session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$session.Headers.Add("Accept", "application/json")

# First-run check
$needsSetup = $false
try {
    $pre        = Invoke-RestMethod -Uri "$N8nUrl/rest/owner/pre-setup" `
                                    -Method GET -WebSession $session -TimeoutSec 10
    $needsSetup = ($pre.data.setupComplete -eq $false) -or ($pre.setupComplete -eq $false)
} catch { $needsSetup = $false }

if ($needsSetup) {
    Write-Host "  First run — creating owner account..." -ForegroundColor Gray
    $setupBody = @{
        email     = $Email
        firstName = $FirstName
        lastName  = $LastName
        password  = $Password
    } | ConvertTo-Json
    try {
        Invoke-WebRequest -Uri "$N8nUrl/rest/owner/setup" -Method POST `
                          -Body $setupBody -ContentType "application/json" `
                          -WebSession $session -TimeoutSec 30 | Out-Null
        OK "Owner account created"
    } catch {
        WARN "Owner setup failed ($($_.Exception.Message)) — trying login"
    }
}

# Login (runs after setup on first run; sole auth step on subsequent runs)
$loginBody = @{ emailOrLdapLoginId = $Email; password = $Password } | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$N8nUrl/rest/login" -Method POST `
                      -Body $loginBody -ContentType "application/json" `
                      -WebSession $session -TimeoutSec 30 | Out-Null
    OK "Login OK — session established"
} catch {
    FAIL "Login failed (check Email/Password): $($_.Exception.Message)"
    exit 1
}

# ══════════════════════════════════════════════════════════════════
# STEP 2 — Idempotent API key
# Fast path: key in .env is still valid → reuse it, skip creation.
# Slow path: delete stale key by label, create fresh, save to .env
#            with replace-not-append so the file never has duplicates.
# ══════════════════════════════════════════════════════════════════
StepHeader 2 "API key ($KEY_LABEL)"
$apiKey = $null

# 2a. Fast path — validate key already in .env
if (-not $RegenerateKey -and (Test-Path $envPath)) {
    $envContent = Get-Content $envPath -Raw -Encoding UTF8
    if ($envContent -match "(?m)^N8N_API_KEY=(.+)$") {
        $candidate = $Matches[1].Trim()
        try {
            $null = Invoke-RestMethod -Uri "$N8nUrl/api/v1/workflows?limit=1" `
                        -Headers @{ "X-N8N-API-KEY" = $candidate
                                    "Content-Type"  = "application/json" } `
                        -TimeoutSec 10
            $apiKey = $candidate
            OK "Reusing valid key from .env"
        } catch {
            WARN "Key in .env is stale — will regenerate"
        }
    }
}

# 2b. Slow path — clean old key by label, create fresh, persist
if (-not $apiKey) {
    # Delete every key sharing this label (idempotent; may be 0 or more)
    try {
        $keyList = Invoke-RestMethod -Uri "$N8nUrl/rest/api-keys" `
                                     -Method GET -WebSession $session -TimeoutSec 10
        $staleKeys = @($keyList.data | Where-Object { $_.label -eq $KEY_LABEL })
        foreach ($k in $staleKeys) {
            Invoke-RestMethod -Uri "$N8nUrl/rest/api-keys/$($k.id)" `
                              -Method DELETE -WebSession $session -TimeoutSec 10 | Out-Null
            Write-Host "  Removed stale key id=$($k.id)" -ForegroundColor DarkGray
        }
    } catch {
        WARN "Could not clean stale keys: $($_.Exception.Message)"
    }

    # Create scoped key
    $keyBody = @{
        label     = $KEY_LABEL
        expiresAt = $null
        scopes    = @(
            "workflow:create", "workflow:read", "workflow:update",
            "workflow:delete", "workflow:list", "workflow:activate", "workflow:deactivate"
        )
    } | ConvertTo-Json
    try {
        $keyResp = Invoke-RestMethod -Uri "$N8nUrl/rest/api-keys" -Method POST `
                                     -Body $keyBody -ContentType "application/json" `
                                     -WebSession $session -TimeoutSec 30
        # rawApiKey = full JWT (only shown at creation); apiKey = masked "****xxx"
        $apiKey = $keyResp.data.rawApiKey
        if (-not $apiKey) { throw "rawApiKey absent from response" }
        OK "New key created"
    } catch {
        FAIL "Could not create API key: $($_.Exception.Message)"
        exit 1
    }

    # 2c. Write to .env: replace existing N8N_API_KEY line, or append once
    try {
        if (Test-Path $envPath) {
            $lines   = Get-Content $envPath -Encoding UTF8
            $found   = $false
            $updated = $lines | ForEach-Object {
                if ($_ -match "^N8N_API_KEY=") {
                    "N8N_API_KEY=$apiKey"
                    $found = $true
                } else { $_ }
            }
            if (-not $found) { $updated = @($updated) + "N8N_API_KEY=$apiKey" }
            $updated | Set-Content $envPath -Encoding UTF8
        } else {
            "N8N_API_KEY=$apiKey" | Set-Content $envPath -Encoding UTF8
        }
        OK "Key saved to .env"
    } catch {
        WARN "Could not update .env: $($_.Exception.Message)"
    }
}

$apiHeaders = @{
    "Content-Type"  = "application/json"
    "X-N8N-API-KEY" = $apiKey
}

# ══════════════════════════════════════════════════════════════════
# STEP 3 — Remove existing Proviso workflows
# Strict n8n 2.x sequence: deactivate → archive (REST) → delete (/api/v1/).
# Each sub-step runs only if the previous one succeeded.
# Failures are logged per workflow; the loop always continues.
# Filter: case-insensitive contains("proviso") catches all name variants.
# ══════════════════════════════════════════════════════════════════
StepHeader 3 "Removing existing Proviso workflows"
try {
    $wfList   = Invoke-RestMethod -Uri "$N8nUrl/api/v1/workflows?limit=250" `
                                  -Method GET -Headers $apiHeaders
    $toRemove = @($wfList.data | Where-Object { $_.name.ToLower().Contains("proviso") })

    if ($toRemove.Count -eq 0) {
        Write-Host "  Nothing to remove" -ForegroundColor DarkGray
    }

    foreach ($wf in $toRemove) {
        $id        = $wf.id
        $canDelete = $true
        Write-Host "  -> $($wf.name) ($id)" -ForegroundColor Magenta

        # 1. Deactivate (skipped if already inactive — frees the webhook path)
        if ($wf.active -eq $true) {
            try {
                Invoke-RestMethod -Uri "$N8nUrl/api/v1/workflows/$id/deactivate" `
                                  -Method POST -Headers $apiHeaders -TimeoutSec 15 | Out-Null
                Write-Host "     deactivated" -ForegroundColor DarkGray
            } catch {
                WARN "     deactivate failed ($($_.Exception.Message)) — skipping $id"
                $canDelete = $false
            }
        }

        # 2. Archive (REST endpoint; requires session cookie, not API key)
        if ($canDelete) {
            try {
                Invoke-RestMethod -Uri "$N8nUrl/rest/workflows/$id/archive" `
                                  -Method POST -WebSession $session -TimeoutSec 15 | Out-Null
                Write-Host "     archived" -ForegroundColor DarkGray
            } catch {
                WARN "     archive failed ($($_.Exception.Message)) — skipping delete of $id"
                $canDelete = $false
            }
        }

        # 3. Delete
        if ($canDelete) {
            try {
                Invoke-RestMethod -Uri "$N8nUrl/api/v1/workflows/$id" `
                                  -Method DELETE -Headers $apiHeaders -TimeoutSec 15 | Out-Null
                OK "     deleted"
            } catch {
                WARN "     delete failed ($($_.Exception.Message))"
            }
        }
    }
} catch {
    WARN "Could not list workflows for cleanup: $($_.Exception.Message)"
}

# ══════════════════════════════════════════════════════════════════
# STEP 4 — Create + activate all 9 workflows
# Node IDs and webhookId are UUIDs (required by n8n 2.x routing).
# Webhook typeVersion 2, responseMode "responseNode" — confirmed working.
# ══════════════════════════════════════════════════════════════════
StepHeader 4 "Creating and activating $($events.Count) workflows"
$createdCount = 0
$failedCreate = 0

foreach ($evt in $events) {
    $webhookNodeId = [System.Guid]::NewGuid().ToString()
    $respondNodeId = [System.Guid]::NewGuid().ToString()
    # Serialize the response body as proper JSON first — avoids nested-quote escaping issues
    $respBody      = [ordered]@{ ack = $true; event = $evt.event } | ConvertTo-Json -Compress

    $wfBody = @{
        name   = $evt.name
        nodes  = @(
            @{
                id          = $webhookNodeId
                webhookId   = $webhookNodeId
                name        = "Webhook"
                type        = "n8n-nodes-base.webhook"
                typeVersion = 2
                position    = @(250, 300)
                parameters  = @{
                    httpMethod   = "POST"
                    path         = $evt.path
                    responseMode = "responseNode"
                    options      = @{}
                }
            },
            @{
                id          = $respondNodeId
                name        = "Respond"
                type        = "n8n-nodes-base.respondToWebhook"
                typeVersion = 1
                position    = @(500, 300)
                parameters  = @{
                    respondWith  = "json"
                    responseBody = $respBody
                    options      = @{}
                }
            }
        )
        connections = @{
            "Webhook" = @{
                # Comma operator prevents PowerShell from flattening the nested array.
                # n8n requires main = [[{...}]] not [{...}].
                main = @( ,@( @{ node = "Respond"; type = "main"; index = 0 } ) )
            }
        }
        settings = @{ executionOrder = "v1" }
    } | ConvertTo-Json -Depth 20

    Write-Host ("  {0,-35}" -f $evt.path) -NoNewline -ForegroundColor Gray
    try {
        $newWf = Invoke-RestMethod -Uri "$N8nUrl/api/v1/workflows" `
                                   -Method POST -Headers $apiHeaders -Body $wfBody
        $wfId  = $newWf.id

        Invoke-RestMethod -Uri "$N8nUrl/api/v1/workflows/$wfId/activate" `
                          -Method POST -Headers $apiHeaders -TimeoutSec 15 | Out-Null

        Write-Host "OK  active  id=$wfId" -ForegroundColor Green
        $createdCount++
    } catch {
        Write-Host "FAILED  $($_.Exception.Message)" -ForegroundColor Red
        $failedCreate++
    }
}

Write-Host ""
if ($failedCreate -eq 0) {
    OK "All $createdCount workflows created and active"
} else {
    FAIL "$failedCreate workflow(s) failed to create/activate"
    exit 1
}

Start-Sleep 3   # allow n8n to register all webhook paths in webhook_entity

# ══════════════════════════════════════════════════════════════════
# STEP 5 — Built-in smoke test (replaces separate smoke-test.ps1)
# POST to every webhook path. Assert response.ack -eq $true.
# Exit code 1 if any path fails — CI/CD compatible.
# ══════════════════════════════════════════════════════════════════
StepHeader 5 "Live smoke test ($($events.Count) paths)"
$passCount = 0
$failCount = 0

foreach ($evt in $events) {
    $url     = "$N8nUrl/webhook/$($evt.path)"
    $reqBody = '{"event":"' + $evt.event + '","test":true}'
    $col     = "  {0,-35}" -f $evt.path

    try {
        $resp = Invoke-RestMethod -Uri $url -Method POST -Body $reqBody `
                                  -ContentType "application/json" -TimeoutSec 10
        if ($resp.ack -eq $true) {
            Write-Host ($col + "PASS  ack=true  event=$($resp.event)") -ForegroundColor Green
            $passCount++
        } else {
            Write-Host ($col + "FAIL  ack missing -- $($resp | ConvertTo-Json -Compress)") -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host ($col + "ERROR $($_.Exception.Message)") -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host ("  PASS $passCount   FAIL $failCount") `
           -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "=== All $($events.Count) webhooks healthy -- Week 1 gate PASSED ===" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "=== $failCount webhook(s) FAILED -- fix before proceeding ===" -ForegroundColor Red
    exit 1
}


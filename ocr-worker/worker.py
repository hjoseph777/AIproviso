"""
ocr-worker/worker.py
MOD-02 — OCR Worker — Phase I Stub

Polls the Redis BullMQ queue 'ocr:jobs' for incoming OCR job payloads.
Phase I (OCR_MODE=stub): logs receipt, writes a mock extraction to the DB,
  fires invoice.extracted → n8n, and ACKs the job.
Week 3-4: replace _run_stub_extraction() with real PaddleOCR + DocTR pipeline.

Queue message shape (written by MOD-01 intake controller):
{
  "invoice_id": "uuid",
  "tenant_id":  "uuid",
  "paperless_id": "string",
  "correlation_id": "uuid",
  "source_module": "MOD-01",
  "timestamp": "iso8601"
}
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import psycopg2
import redis
import requests

# ── Config ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [ocr-worker] %(levelname)s %(message)s",
)
log = logging.getLogger("ocr-worker")

REDIS_URL     = os.environ["REDIS_URL"]
DATABASE_URL  = os.environ["DATABASE_URL"]
N8N_BASE_URL  = os.environ.get("N8N_BASE_URL", "http://n8n:5678")
N8N_TOKEN     = os.environ.get("N8N_WEBHOOK_TOKEN", "")
OCR_MODE      = os.environ.get("OCR_MODE", "stub")

QUEUE_KEY = "ocr:jobs"       # BullMQ-compatible Redis list
DLQ_KEY   = "dlq:events"    # Dead Letter Queue after max retries

MAX_RETRIES = 5
POLL_TIMEOUT_SEC = 5          # BLPOP block time

# ── Database ──────────────────────────────────────────────────────────────────

def get_db_conn():
    return psycopg2.connect(DATABASE_URL)

def write_extraction(conn, invoice_id: str, tenant_id: str, extraction: dict, confidence: dict) -> str:
    """Inserts a new invoice_extractions row. Returns the extraction UUID."""
    extraction_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute("""
            -- Set tenant context for RLS
            SET LOCAL app.current_tenant_id = %s;
            INSERT INTO invoice_extractions
              (id, invoice_id, version, extracted_json, confidence_json, ocr_engine, raw_ocr_text, page_count, processing_ms)
            SELECT
              %s, %s,
              COALESCE((SELECT MAX(version) FROM invoice_extractions WHERE invoice_id = %s), 0) + 1,
              %s, %s, %s, %s, %s, %s;
        """,
        (tenant_id,
         extraction_id, invoice_id,
         invoice_id,
         json.dumps(extraction),
         json.dumps(confidence),
         OCR_MODE,
         None,    # raw_ocr_text — None in stub mode
         1,       # page_count
         50))     # processing_ms — stub is fast
    conn.commit()
    return extraction_id

def update_invoice_status(conn, invoice_id: str, tenant_id: str, status: str):
    with conn.cursor() as cur:
        cur.execute("""
            SET LOCAL app.current_tenant_id = %s;
            UPDATE invoices SET status = %s WHERE id = %s;
        """, (tenant_id, status, invoice_id))
    conn.commit()

def write_audit_event(conn, invoice_id: str, tenant_id: str, event_type: str, payload: dict, correlation_id: str):
    with conn.cursor() as cur:
        cur.execute("""
            SET LOCAL app.current_tenant_id = %s;
            INSERT INTO audit_events (event_type, invoice_id, source_module, tenant_id, correlation_id, new_value)
            VALUES (%s, %s, 'MOD-02', %s, %s, %s);
        """, (tenant_id, event_type, invoice_id, tenant_id, correlation_id, json.dumps(payload)))
    conn.commit()

# ── n8n Event Firing ──────────────────────────────────────────────────────────

def fire_event(event: str, invoice_id: str, tenant_id: str, correlation_id: str, payload: dict, confidence: dict):
    """Fires an event to n8n via HTTP. Non-blocking — logs failure, does not crash."""
    path = event.replace(".", "/")   # "invoice.extracted" → "invoice/extracted"
    url  = f"{N8N_BASE_URL}/webhook/{path}"
    body = {
        "event": event,
        "schema_version": "1.0.0",
        "invoice_id": invoice_id,
        "tenant_id": tenant_id,
        "payload": payload,
        "confidence": confidence,
        "source_module": "MOD-02",
        "correlation_id": correlation_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    headers = {"Content-Type": "application/json"}
    if N8N_TOKEN:
        headers["X-Proviso-Token"] = N8N_TOKEN

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=10)
        resp.raise_for_status()
        log.info("✓ Fired %s → n8n: status=%d", event, resp.status_code)
    except Exception as exc:
        log.error("✗ Failed to fire %s → n8n: %s", event, exc)

# ── Extraction Engines ────────────────────────────────────────────────────────

def _run_stub_extraction(job: dict) -> tuple[dict, dict]:
    """
    Phase I stub: returns mock extracted fields + perfect confidence.
    Week 3-4: replace with real PaddleOCR → DocTR → LLM pipeline.
    """
    log.info("[STUB] Simulating OCR extraction for invoice_id=%s", job["invoice_id"])
    time.sleep(0.05)    # simulate minimal processing time

    extracted = {
        "vendor_name":      "Acme Supplies Inc",
        "invoice_number":   f"INV-STUB-{job['invoice_id'][:8].upper()}",
        "invoice_date":     datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "due_date":         None,
        "total_amount":     2500.00,
        "tax_amount":       325.00,
        "currency":         "CAD",
        "po_number":        "PO-DEV-001",
    }
    confidence = {
        "vendor_name":    0.95,
        "invoice_number": 0.90,
        "invoice_date":   0.98,
        "total_amount":   0.97,
        "currency":       0.99,
        "po_number":      0.85,
    }
    return extracted, confidence

def run_extraction(job: dict) -> tuple[dict, dict]:
    if OCR_MODE == "stub":
        return _run_stub_extraction(job)
    # Week 3-4: add elif OCR_MODE == "paddle": return _run_paddle_extraction(job)
    raise NotImplementedError(f"OCR_MODE '{OCR_MODE}' is not implemented yet.")

# ── Job Processor ─────────────────────────────────────────────────────────────

def process_job(job_data: bytes, conn) -> bool:
    """Returns True on success, False on retryable failure."""
    try:
        job = json.loads(job_data)
        invoice_id     = job["invoice_id"]
        tenant_id      = job["tenant_id"]
        correlation_id = job.get("correlation_id", str(uuid.uuid4()))

        log.info("Processing OCR job: invoice_id=%s mode=%s", invoice_id, OCR_MODE)

        # 1. Run extraction
        extracted, confidence = run_extraction(job)

        # 2. Write extraction record to DB
        write_extraction(conn, invoice_id, tenant_id, extracted, confidence)

        # 3. Advance invoice status → extracted
        update_invoice_status(conn, invoice_id, tenant_id, "extracted")

        # 4. Write audit event
        write_audit_event(conn, invoice_id, tenant_id, "invoice.extracted", extracted, correlation_id)

        # 5. Fire invoice.extracted → n8n
        fire_event(
            event="invoice.extracted",
            invoice_id=invoice_id,
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            payload=extracted,
            confidence=confidence,
        )

        log.info("✓ Job complete: invoice_id=%s", invoice_id)
        return True

    except json.JSONDecodeError as exc:
        log.error("Invalid job payload (not JSON): %s", exc)
        return False   # DLQ immediately — not retryable
    except Exception as exc:
        log.error("Job failed: %s", exc)
        return False

# ── Main Loop ─────────────────────────────────────────────────────────────────

def main():
    log.info("OCR Worker starting. mode=%s queue=%s", OCR_MODE, QUEUE_KEY)

    r = redis.from_url(REDIS_URL, decode_responses=False)
    conn = None

    while True:
        try:
            # Reconnect DB if needed
            if conn is None or conn.closed:
                conn = get_db_conn()
                log.info("DB connection established.")

            # BLPOP blocks until a job arrives or timeout
            result = r.blpop(QUEUE_KEY, timeout=POLL_TIMEOUT_SEC)
            if result is None:
                continue   # timeout — no job, loop back

            _, job_data = result
            attempt = 1
            success = False

            while attempt <= MAX_RETRIES and not success:
                if attempt > 1:
                    backoff = 1.0 * (2 ** (attempt - 1))
                    log.warning("Retry %d/%d in %.1fs...", attempt, MAX_RETRIES, backoff)
                    time.sleep(backoff)

                success = process_job(job_data, conn)
                attempt += 1

            if not success:
                log.error("Job moved to DLQ after %d attempts.", MAX_RETRIES)
                r.lpush(DLQ_KEY, job_data)

        except redis.ConnectionError as exc:
            log.error("Redis connection lost: %s — reconnecting in 5s", exc)
            time.sleep(5)
        except psycopg2.OperationalError as exc:
            log.error("DB connection lost: %s — reconnecting in 5s", exc)
            conn = None
            time.sleep(5)
        except KeyboardInterrupt:
            log.info("Worker shutting down.")
            break

    if conn and not conn.closed:
        conn.close()

if __name__ == "__main__":
    main()

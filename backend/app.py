import json
import logging
import os
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import psycopg2
import redis
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

# =============================================================================
# AI Proviso — Backend API (Phase I Flask Sandbox)
# Target: Fastify gateway in Phase II (see PRD v8 Section 4.5)
# =============================================================================

logging.basicConfig(level=logging.INFO, format="%(asctime)s [backend-api] %(levelname)s %(message)s")
log = logging.getLogger("backend-api")

app = Flask(__name__)
CORS(app)

# ── Config ────────────────────────────────────────────────────────────────────
DATABASE_URL      = os.environ.get("DATABASE_URL", "")
REDIS_URL         = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
N8N_BASE_URL      = os.environ.get("N8N_BASE_URL", "http://n8n:5678")
N8N_WEBHOOK_TOKEN = os.environ.get("N8N_WEBHOOK_TOKEN", "")

OCR_QUEUE_KEY = "ocr:jobs"

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_db_conn():
    return psycopg2.connect(DATABASE_URL)

def get_redis():
    return redis.from_url(REDIS_URL, decode_responses=True)

def fire_n8n_event(event: str, payload: dict) -> dict:
    """POST a canonical event envelope to the n8n webhook for that event topic."""
    path = event.replace(".", "/")
    url  = f"{N8N_BASE_URL}/webhook/{path}"
    headers = {"Content-Type": "application/json"}
    if N8N_WEBHOOK_TOKEN:
        headers["X-Proviso-Token"] = N8N_WEBHOOK_TOKEN

    resp = requests.post(url, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()

# ─────────────────────────────────────────────────────────────────────────────
# HEALTH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Basic liveness check — used by Docker Compose healthcheck."""
    return jsonify({"status": "ok", "service": "proviso-backend-api"}), 200


@app.route("/health/db", methods=["GET"])
def health_db():
    """Deep health check: verifies postgres + redis connectivity."""
    pg_ok    = False
    redis_ok = False
    pg_error = None
    redis_error = None

    try:
        conn = get_db_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.close()
        pg_ok = True
    except Exception as exc:
        pg_error = str(exc)

    try:
        r = get_redis()
        r.ping()
        redis_ok = True
    except Exception as exc:
        redis_error = str(exc)

    all_ok = pg_ok and redis_ok
    return jsonify({
        "status": "ok" if all_ok else "degraded",
        "postgres": {"ok": pg_ok, "error": pg_error},
        "redis":    {"ok": redis_ok, "error": redis_error},
    }), 200 if all_ok else 503


# ─────────────────────────────────────────────────────────────────────────────
# MOD-01 — INTAKE (Smoke Test Entry Point)
# Accepts an invoice document or a simulated payload, creates an invoice row,
# pushes an OCR job to Redis, and fires invoice.received → n8n.
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/intake/upload", methods=["POST"])
def intake_upload():
    """
    Accepts a simulated invoice submission (Phase I: JSON payload, no real file).
    Creates invoice record → pushes OCR job → fires invoice.received.
    Body: { "tenant_id": "uuid", "paperless_id": "optional" }
    """
    data = request.get_json(force=True, silent=True) or {}
    tenant_id    = data.get("tenant_id", "00000000-0000-0000-0000-000000000001")
    paperless_id = data.get("paperless_id")

    invoice_id     = str(uuid.uuid4())
    correlation_id = str(uuid.uuid4())
    now_iso        = datetime.now(timezone.utc).isoformat()

    # 1. Insert invoice row into DB
    try:
        conn = get_db_conn()
        with conn.cursor() as cur:
            cur.execute(
                "SET LOCAL app.current_tenant_id = %s", (tenant_id,)
            )
            cur.execute("""
                INSERT INTO invoices (id, tenant_id, status, correlation_id, paperless_id)
                VALUES (%s, %s, 'received', %s, %s)
            """, (invoice_id, tenant_id, correlation_id, paperless_id))
        conn.commit()

        # 2. Write audit event
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            cur.execute("""
                INSERT INTO audit_events (event_type, invoice_id, source_module, tenant_id, correlation_id, new_value)
                VALUES ('invoice.received', %s, 'MOD-01', %s, %s, %s)
            """, (invoice_id, tenant_id, correlation_id, json.dumps({"paperless_id": paperless_id})))
        conn.commit()
        conn.close()
    except Exception as exc:
        log.error("DB error during intake: %s", exc)
        return jsonify({"error": "database_error", "detail": str(exc)}), 500

    # 3. Push OCR job to Redis queue
    ocr_job = {
        "invoice_id":     invoice_id,
        "tenant_id":      tenant_id,
        "paperless_id":   paperless_id,
        "correlation_id": correlation_id,
        "source_module":  "MOD-01",
        "timestamp":      now_iso,
    }
    try:
        r = get_redis()
        r.rpush(OCR_QUEUE_KEY, json.dumps(ocr_job))
        log.info("OCR job queued: invoice_id=%s", invoice_id)
    except Exception as exc:
        log.error("Redis error queuing OCR job: %s", exc)
        # Non-fatal for smoke test — log but continue

    # 4. Fire invoice.received → n8n
    event_payload = {
        "event":          "invoice.received",
        "schema_version": "1.0.0",
        "invoice_id":     invoice_id,
        "tenant_id":      tenant_id,
        "payload":        {"paperless_id": paperless_id},
        "source_module":  "MOD-01",
        "correlation_id": correlation_id,
        "timestamp":      now_iso,
    }
    n8n_ack = None
    try:
        n8n_ack = fire_n8n_event("invoice.received", event_payload)
        log.info("invoice.received fired → n8n ack=%s", n8n_ack)
    except Exception as exc:
        log.warning("n8n not reachable (non-fatal in dev): %s", exc)

    return jsonify({
        "invoice_id":     invoice_id,
        "correlation_id": correlation_id,
        "status":         "received",
        "n8n_ack":        n8n_ack,
        "message":        "invoice.received event fired. OCR job queued.",
    }), 201


# ─────────────────────────────────────────────────────────────────────────────
# SMOKE TEST / DEBUG ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/events/fire", methods=["POST"])
def fire_event_direct():
    """
    Dev-only: Fire any event envelope directly to n8n.
    Body: canonical ProvisoEventEnvelope JSON
    """
    payload = request.get_json(force=True, silent=True) or {}
    event   = payload.get("event")
    if not event:
        return jsonify({"error": "event field required"}), 400

    try:
        n8n_resp = fire_n8n_event(event, payload)
        return jsonify({"fired": True, "event": event, "n8n_response": n8n_resp}), 200
    except Exception as exc:
        return jsonify({"fired": False, "event": event, "error": str(exc)}), 502


@app.route("/api/debug/queue-depth", methods=["GET"])
def queue_depth():
    """Returns current lengths of OCR queue and DLQ for monitoring."""
    try:
        r = get_redis()
        return jsonify({
            "ocr_queue_depth": r.llen(OCR_QUEUE_KEY),
            "dlq_depth":       r.llen("dlq:events"),
        }), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503


# =============================================================================
# PRESERVED: Cacoo Diagram Import (Phase 2/3 — not yet implemented)
# =============================================================================

CACOO_MOCK = {
    "diagramName": "Imported from Cacoo",
    "states": [
        {"name": "Draft", "initial": True},
        {"name": "Review", "initial": False},
        {"name": "Approved", "initial": False},
    ],
    "transitions": [
        {"from": "Draft", "to": "Review"},
        {"from": "Review", "to": "Approved"},
    ]
}

def parse_cacoo_xml(xml_content):
    try:
        ET.fromstring(xml_content)
        return CACOO_MOCK
    except Exception as exc:
        log.error("Error parsing Cacoo XML: %s", exc)
        return CACOO_MOCK

@app.route("/api/cacoo-fetch", methods=["POST"])
def cacoo_fetch():
    data = request.get_json(force=True, silent=True) or {}
    diagram_id = data.get("diagramId")
    api_key    = data.get("apiKey")
    if not diagram_id or not api_key:
        return jsonify({"error": "Diagram ID and API Key required"}), 400
    if diagram_id == "test" or api_key == "test":
        return jsonify(CACOO_MOCK)
    url = f"https://cacoo.com/api/v1/diagrams/{diagram_id}/contents.xml?apiKey={api_key}&returnValues=position,textStyle"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return jsonify(CACOO_MOCK)
        return jsonify(parse_cacoo_xml(resp.text))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=port, debug=debug)

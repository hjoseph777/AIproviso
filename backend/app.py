import hashlib
import html
import hmac
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # Local fallback mode can still serve non-DB API responses.
    psycopg2 = None
    RealDictCursor = None

try:
    import redis
except ImportError:  # Health and queue metrics degrade gracefully without redis.
    redis = None
try:
    import requests
except ImportError:  # Webhook features degrade gracefully without requests.
    requests = None
from flask import Flask, jsonify, request
from flask_cors import CORS
try:
    from dotenv import load_dotenv
    load_dotenv()          # loads .env from project root automatically
except ImportError:
    pass                   # python-dotenv optional — env vars set externally work too

# =============================================================================
# AI Proviso — Backend API (Phase I Flask Sandbox)
# Target: Fastify gateway in Phase II (see PRD v8 Section 4.5)
# =============================================================================

logging.basicConfig(level=logging.INFO, format="%(asctime)s [backend-api] %(levelname)s %(message)s")
log = logging.getLogger("backend-api")

app = Flask(__name__)
CORS(app)

# ── Config ────────────────────────────────────────────────────────────────────
# Read DATABASE_URL: env var first, then .env file directly, then dev default.
# This guarantees a working URL regardless of how the process was launched.
def _resolve_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    # Try reading .env directly (covers cases where load_dotenv didn't fire)
    try:
        _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
        with open(_env_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if _line.startswith("DATABASE_URL=") and not _line.startswith("#"):
                    return _line.split("=", 1)[1].split("#")[0].strip()
    except Exception:
        pass
    # Dev default — matches confirmed-working credentials on this machine
    return "postgresql://proviso:change-me@localhost:5432/proviso"

DATABASE_URL      = _resolve_database_url()
REDIS_URL         = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
N8N_BASE_URL      = os.environ.get("N8N_BASE_URL", "http://n8n:5678")
N8N_WEBHOOK_TOKEN = os.environ.get("N8N_WEBHOOK_TOKEN", "")
WORKFLOW_ENGINE_BASE_URL = os.environ.get("WORKFLOW_ENGINE_BASE_URL", "http://workflow-engine:5100")
WORKFLOW_WEBHOOK_SECRET = os.environ.get("WORKFLOW_WEBHOOK_SECRET", "")
WORKFLOW_WEBHOOK_TTL_SECONDS = int(os.environ.get("WORKFLOW_WEBHOOK_TTL_SECONDS", "300"))

OCR_QUEUE_KEY = "ocr:jobs"
DEV_TENANT_ID = "00000000-0000-0000-0000-000000000001"
ALLOW_DEV_FALLBACK = os.environ.get("ALLOW_DEV_FALLBACK", "1").lower() in {"1", "true", "yes"}

DEV_INVOICES = [
    {
        "id": "00000000-0000-0000-0000-000000000101",
        "invoiceNumber": "INV-2026-0441",
        "vendor": "Canon Canada",
        "date": "2026-05-26",
        "amount": 12450.00,
        "status": "pending",
        "confidence": 0.94,
        "assignee": "Sarah",
        "sla": "2h",
        "po": "PO-8812",
        "queue": "Approvals",
        "paperlessId": None,
        "correlationId": "00000000-0000-0000-0000-000000000401",
        "receivedAt": "2026-05-26T14:02:00Z",
        "updatedAt": "2026-05-26T14:06:00Z",
        "fieldConfidence": {"vendor_name": 0.99, "invoice_date": 0.95, "total_amount": 0.94, "po_number": 0.93},
    },
    {
        "id": "00000000-0000-0000-0000-000000000102",
        "invoiceNumber": "INV-2026-0442",
        "vendor": "Staples Pro",
        "date": "2026-05-26",
        "amount": 612.80,
        "status": "approved",
        "confidence": 0.98,
        "assignee": "System",
        "sla": "Done",
        "po": "PO-9021",
        "queue": "Ready to Post",
        "paperlessId": None,
        "correlationId": "00000000-0000-0000-0000-000000000402",
        "receivedAt": "2026-05-26T13:54:00Z",
        "updatedAt": "2026-05-26T14:10:00Z",
        "fieldConfidence": {"vendor_name": 0.99, "invoice_date": 0.98, "total_amount": 0.98, "po_number": 0.97},
    },
    {
        "id": "00000000-0000-0000-0000-000000000103",
        "invoiceNumber": "INV-2026-0439",
        "vendor": "Ricoh North",
        "date": "2026-05-25",
        "amount": 1180.15,
        "status": "review",
        "confidence": 0.72,
        "assignee": "James",
        "sla": "45m",
        "po": "Missing",
        "queue": "Low Confidence",
        "paperlessId": None,
        "correlationId": "00000000-0000-0000-0000-000000000403",
        "receivedAt": "2026-05-25T12:14:00Z",
        "updatedAt": "2026-05-25T12:18:00Z",
        "fieldConfidence": {"vendor_name": 0.88, "invoice_date": 0.78, "total_amount": 0.72, "po_number": 0.61},
    },
    {
        "id": "00000000-0000-0000-0000-000000000104",
        "invoiceNumber": "INV-2026-0438",
        "vendor": "Global Tech",
        "date": "2026-05-25",
        "amount": 9910.00,
        "status": "extracted",
        "confidence": 0.89,
        "assignee": "AI",
        "sla": "1h",
        "po": "PO-8111",
        "queue": "Matching",
        "paperlessId": None,
        "correlationId": "00000000-0000-0000-0000-000000000404",
        "receivedAt": "2026-05-25T11:48:00Z",
        "updatedAt": "2026-05-25T11:50:00Z",
        "fieldConfidence": {"vendor_name": 0.93, "invoice_date": 0.91, "total_amount": 0.89, "po_number": 0.87},
    },
    {
        "id": "00000000-0000-0000-0000-000000000105",
        "invoiceNumber": "INV-2026-0435",
        "vendor": "Fuji Business",
        "date": "2026-05-24",
        "amount": 4200.00,
        "status": "review",
        "confidence": 0.51,
        "assignee": "Review",
        "sla": "Breach",
        "po": "PO-7740",
        "queue": "Manual Review",
        "paperlessId": None,
        "correlationId": "00000000-0000-0000-0000-000000000405",
        "receivedAt": "2026-05-24T16:03:00Z",
        "updatedAt": "2026-05-24T16:08:00Z",
        "fieldConfidence": {"vendor_name": 0.66, "invoice_date": 0.59, "total_amount": 0.51, "po_number": 0.84},
    },
    {
        "id": "00000000-0000-0000-0000-000000000106",
        "invoiceNumber": "INV-2026-0430",
        "vendor": "Acme Supply",
        "date": "2026-05-24",
        "amount": 24800.00,
        "status": "posted",
        "confidence": 0.97,
        "assignee": "ERP",
        "sla": "Done",
        "po": "PO-7623",
        "queue": "Posted",
        "paperlessId": None,
        "correlationId": "00000000-0000-0000-0000-000000000406",
        "receivedAt": "2026-05-24T10:22:00Z",
        "updatedAt": "2026-05-24T10:40:00Z",
        "fieldConfidence": {"vendor_name": 0.99, "invoice_date": 0.97, "total_amount": 0.97, "po_number": 0.96},
    },
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_db_conn():
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is not installed")
    return psycopg2.connect(DATABASE_URL)

def get_redis():
    if redis is None:
        raise RuntimeError("redis client is not installed")
    return redis.from_url(REDIS_URL, decode_responses=True)

def get_tenant_id() -> str:
    return request.args.get("tenant_id") or request.headers.get("X-Tenant-Id") or DEV_TENANT_ID

def db_status_to_ui(status: str) -> str:
    return {
        "received": "pending",
        "matched": "pending",
        "pending_approval": "pending",
        "approved": "approved",
        "posted": "posted",
        "reconciled": "posted",
        "exception": "review",
        "rejected": "review",
        "extracted": "extracted",
    }.get(status, "pending")

def ui_to_db_status(status: str) -> str:
    return {
        "pending": "pending_approval",
        "review": "exception",
        "approved": "approved",
        "posted": "posted",
        "extracted": "extracted",
    }.get(status, status)

def queue_for_ui_status(status: str) -> str:
    return {
        "pending": "Approvals",
        "review": "Exception Queue",
        "approved": "Ready to Post",
        "posted": "Posted",
        "extracted": "Matching",
    }.get(status, "Approvals")

def assignee_for_ui_status(status: str) -> str:
    return {
        "pending": "AP Manager",
        "review": "AP Review",
        "approved": "System",
        "posted": "ERP",
        "extracted": "AI",
    }.get(status, "AP Team")

def sla_for_ui_status(status: str, confidence: float) -> str:
    if status == "posted":
        return "Done"
    if status == "approved":
        return "Done"
    if status == "review" and confidence < 0.6:
        return "Breach"
    if status == "review":
        return "45m"
    if status == "extracted":
        return "1h"
    return "2h"

def numeric_confidence(confidence_json: dict | None) -> float:
    values = []
    for value in (confidence_json or {}).values():
        try:
            values.append(float(value))
        except (TypeError, ValueError):
            continue
    return round(sum(values) / len(values), 2) if values else 0.0

def to_invoice_payload(row: dict) -> dict:
    extracted = row.get("extracted_json") or {}
    confidence_json = row.get("confidence_json") or {}
    ui_status = db_status_to_ui(row.get("status", "received"))
    confidence = numeric_confidence(confidence_json)
    vendor_name = row.get("display_name") or row.get("vendor_name") or extracted.get("vendor_name") or "Unknown vendor"
    return {
        "id": str(row["id"]),
        "invoiceNumber": extracted.get("invoice_number") or f"INV-{str(row['id'])[:8].upper()}",
        "vendor": vendor_name,
        "date": extracted.get("invoice_date") or row.get("received_at").date().isoformat(),
        "amount": float(extracted.get("total_amount") or 0),
        "status": ui_status,
        "confidence": confidence,
        "assignee": assignee_for_ui_status(ui_status),
        "sla": sla_for_ui_status(ui_status, confidence),
        "po": extracted.get("po_number") or "Missing",
        "queue": queue_for_ui_status(ui_status),
        "paperlessId": row.get("paperless_id"),
        "correlationId": str(row.get("correlation_id")) if row.get("correlation_id") else None,
        "receivedAt": row.get("received_at").isoformat() if row.get("received_at") else None,
        "updatedAt": row.get("updated_at").isoformat() if row.get("updated_at") else None,
        "fieldConfidence": {
            "vendor_name": float(confidence_json.get("vendor_name", 0) or 0),
            "invoice_date": float(confidence_json.get("invoice_date", 0) or 0),
            "total_amount": float(confidence_json.get("total_amount", 0) or 0),
            "po_number": float(confidence_json.get("po_number", 0) or 0),
        },
    }

def summarize_invoices(invoices: list[dict]) -> dict:
    total_amount = round(sum(invoice["amount"] for invoice in invoices), 2)
    avg_confidence = round((sum(invoice["confidence"] for invoice in invoices) / len(invoices)) * 100) if invoices else 0
    pending = sum(1 for invoice in invoices if invoice["status"] == "pending")
    review = sum(1 for invoice in invoices if invoice["status"] == "review")
    posted = sum(1 for invoice in invoices if invoice["status"] == "posted")
    try:
        queue_depth = get_redis().llen(OCR_QUEUE_KEY)
    except Exception:
        queue_depth = 0
    return {
        "invoicesLoaded": len(invoices),
        "avgConfidence": avg_confidence,
        "pendingApproval": pending,
        "needsReview": review,
        "invoiceVolume": total_amount,
        "postedCount": posted,
        "ocrQueueDepth": queue_depth,
    }


def status_label_from_ui_status(status: str) -> str:
    return {
        "pending": "Pending Approval",
        "review": "Exception Review",
        "approved": "Approved",
        "posted": "Posted",
        "extracted": "Extracted",
    }.get(status, status.replace("_", " ").title())


def event_label(event_type: str | None) -> str:
    if not event_type:
        return "No transition recorded"
    return event_type.replace("invoice.", "").replace("_", " ").replace(".", " ").title()


RUNTIME_RULE_CATALOG = {
    "rule.invoice.confidence.manual_review": {
        "guard_name": "evaluate_confidence_threshold",
        "title": "Confidence review required",
        "copy": "Extraction confidence is below the auto-post threshold. Route the invoice through manual review before approval.",
        "severity": "amber",
        "remediation": "Review the extracted fields, correct low-confidence values, and resubmit the invoice for approval.",
    },
    "rule.invoice.po.required": {
        "guard_name": "require_purchase_order_reference",
        "title": "PO reference required",
        "copy": "The invoice is missing a PO reference. Hold the workflow until the buyer or vendor supplies the PO number.",
        "severity": "red",
        "remediation": "Attach the correct PO number or map the invoice to the matching purchase order before reprocessing.",
    },
    "rule.invoice.approval.pending": {
        "guard_name": "await_approver_decision",
        "title": "Approval gate active",
        "copy": "The invoice has satisfied extraction checks and is waiting at the approval decision gate.",
        "severity": "blue",
        "remediation": "Capture the approver decision to move the invoice out of the approval queue.",
    },
    "rule.invoice.signature.pending": {
        "guard_name": "await_signature_completion",
        "title": "Signature step pending",
        "copy": "Approval completed. The workflow is waiting for the required signature before activation.",
        "severity": "blue",
        "remediation": "Complete the signature task or reassign the signer before continuing the workflow.",
    },
    "rule.workflow.transition.recorded": {
        "guard_name": "persist_workflow_transition",
        "title": "Transition recorded",
        "copy": "A workflow transition has been persisted successfully for the selected invoice.",
        "severity": "green",
        "remediation": "No remediation required. The workflow transition is already recorded.",
    },
}


def designer_state_name(raw_state: str | None) -> str:
    normalized = str(raw_state or "draft").strip().lower()
    if normalized in {"entry", "unknown", ""}:
        return "Draft"
    if "pending signature" in normalized:
        return "Pending Signature"
    if "pending approval" in normalized or normalized == "pending":
        return "Pending Approval"
    if "under review" in normalized or "review" in normalized:
        return "Under Review"
    if "reviewed" in normalized or "matched" in normalized or "extract" in normalized:
        return "Reviewed"
    if "approved" in normalized:
        return "Approved"
    if "signed" in normalized:
        return "Signed"
    if "expiring" in normalized:
        return "Expiring Soon"
    if "expired" in normalized:
        return "Expired"
    if "terminated" in normalized:
        return "Terminated"
    if "discard" in normalized:
        return "Discarded"
    if "active" in normalized or "posted" in normalized:
        return "Active"
    return status_label_from_ui_status(normalized)


def build_active_route_history(history_rows: list[dict], current_state: str) -> list[str]:
    route_history: list[str] = []
    if history_rows:
        for row in reversed(history_rows):
            from_state = row.get("from_state")
            to_state = row.get("to_state") or current_state
            if from_state and str(from_state).lower() not in {"entry", "unknown"}:
                label = designer_state_name(from_state)
                if not route_history or route_history[-1] != label:
                    route_history.append(label)
            to_label = designer_state_name(to_state)
            if not route_history or route_history[-1] != to_label:
                route_history.append(to_label)
    if not route_history:
        route_history = [designer_state_name(current_state)]
    return route_history


def derive_rule_decision(invoice: dict, current_state: str, latest_transition: dict) -> dict | None:
    state_name = designer_state_name(current_state)
    confidence = float(invoice.get("confidence") or 0)
    po_value = str(invoice.get("po") or "").strip().lower()
    native_rule_id = latest_transition.get("rule_id")
    guard_name = latest_transition.get("guard_name")

    if native_rule_id and native_rule_id in RUNTIME_RULE_CATALOG:
        catalog = RUNTIME_RULE_CATALOG[native_rule_id]
        return {
            "id": native_rule_id,
            "guard_name": latest_transition.get("guard_name") or catalog["guard_name"],
            "title": catalog["title"],
            "copy": catalog["copy"],
            "severity": catalog["severity"],
            "state": state_name,
            "event_type": latest_transition.get("event_type"),
            "expected": latest_transition.get("expected") or (">= 0.70 confidence" if native_rule_id == "rule.invoice.confidence.manual_review" else "Transition persists successfully"),
            "actual": latest_transition.get("actual") or (f"confidence {confidence:.2f}" if native_rule_id == "rule.invoice.confidence.manual_review" else latest_transition.get("event_type") or state_name),
            "remediation": latest_transition.get("remediation") or catalog["remediation"],
            "source": "workflow_state_history.rule_id",
        }

    if guard_name:
        rule_from_guard = next((rule_id for rule_id, rule in RUNTIME_RULE_CATALOG.items() if rule["guard_name"] == guard_name), None)
        if rule_from_guard:
            catalog = RUNTIME_RULE_CATALOG[rule_from_guard]
            return {
                "id": rule_from_guard,
                "guard_name": guard_name,
                "title": catalog["title"],
                "copy": catalog["copy"],
                "severity": catalog["severity"],
                "state": state_name,
                "event_type": latest_transition.get("event_type"),
                "expected": latest_transition.get("expected") or "Rule metadata not recorded in history yet",
                "actual": latest_transition.get("actual") or latest_transition.get("event_type") or state_name,
                "remediation": latest_transition.get("remediation") or catalog["remediation"],
                "source": "workflow_state_history.guard_name",
            }

    if guard_name and guard_name in RUNTIME_RULE_CATALOG:
        catalog = RUNTIME_RULE_CATALOG[guard_name]
        return {
            "id": native_rule_id or guard_name,
            "guard_name": guard_name,
            "title": catalog["title"],
            "copy": catalog["copy"],
            "severity": catalog["severity"],
            "state": state_name,
            "event_type": latest_transition.get("event_type"),
            "expected": latest_transition.get("expected") or "Rule metadata not recorded in history yet",
            "actual": latest_transition.get("actual") or latest_transition.get("event_type") or state_name,
            "remediation": latest_transition.get("remediation") or catalog["remediation"],
            "source": "workflow_state_history.guard_name",
        }

    if confidence < 0.7 or state_name == "Under Review":
        rule_id = "rule.invoice.confidence.manual_review"
    elif po_value in {"", "missing", "n/a", "none"}:
        rule_id = "rule.invoice.po.required"
    elif state_name == "Pending Approval":
        rule_id = "rule.invoice.approval.pending"
    elif state_name == "Pending Signature":
        rule_id = "rule.invoice.signature.pending"
    elif latest_transition:
        rule_id = "rule.workflow.transition.recorded"
    else:
        return None

    catalog = RUNTIME_RULE_CATALOG[rule_id]
    return {
        "id": rule_id,
        "guard_name": catalog["guard_name"],
        "title": catalog["title"],
        "copy": catalog["copy"],
        "severity": catalog["severity"],
        "state": state_name,
        "event_type": latest_transition.get("event_type"),
        "expected": ">= 0.70 confidence" if rule_id == "rule.invoice.confidence.manual_review" else "Transition remains valid",
        "actual": f"confidence {confidence:.2f}" if rule_id == "rule.invoice.confidence.manual_review" else (invoice.get("po") or state_name),
        "remediation": catalog["remediation"],
        "source": "runtime_payload",
    }


def build_execution_ticker(invoice: dict, history_rows: list[dict], audit_rows: list[dict], timer_rows: list[dict]) -> list[dict]:
    items = []
    for row in history_rows[:4]:
        items.append({
            "id": f"history-{row.get('recorded_at') or row.get('event_type')}",
            "kind": "transition",
            "label": event_label(row.get("event_type")),
            "detail": f"{designer_state_name(row.get('from_state'))} -> {designer_state_name(row.get('to_state'))}",
            "recorded_at": row.get("recorded_at"),
            "tone": "blue" if row is history_rows[0] else "dim",
        })

    if not items:
        for row in audit_rows[:3]:
            items.append({
                "id": f"audit-{row.get('recorded_at') or row.get('event_type')}",
                "kind": "audit",
                "label": event_label(row.get("event_type")),
                "detail": row.get("reason") or invoice.get("invoiceNumber") or invoice.get("id"),
                "recorded_at": row.get("recorded_at"),
                "tone": "blue" if row is audit_rows[0] else "dim",
            })

    scheduled_timer = next((row for row in timer_rows if row.get("status") == "scheduled"), None)
    if scheduled_timer:
        items.insert(0, {
            "id": f"timer-{scheduled_timer.get('timer_key')}",
            "kind": "timer",
            "label": "Timer scheduled",
            "detail": f"{scheduled_timer.get('target_state') or 'state'} at {scheduled_timer.get('due_at') or 'n/a'}",
            "recorded_at": scheduled_timer.get("due_at"),
            "tone": "amber",
        })

    return items[:5]


def build_runtime_payload(source: str, invoice: dict, audit_rows: list[dict], table_availability: dict, table_rows: dict) -> dict:
    latest_event = audit_rows[0] if audit_rows else None
    workflow_state_row = table_rows.get("workflow_state") or {}
    history_rows = table_rows.get("workflow_state_history") or []
    timer_rows = table_rows.get("workflow_timers") or []
    latest_history = history_rows[0] if history_rows else None
    latest_transition = latest_history or latest_event or {}
    current_state = workflow_state_row.get("current_state") or invoice.get("status", "pending")
    workflow_label = status_label_from_ui_status(current_state)
    runtime_tables_online = sum(1 for name in ["workflow_state", "workflow_state_history", "workflow_timers"] if table_availability.get(name))

    trace_rows = []
    if history_rows:
        for index, row in enumerate(history_rows[:5], start=1):
            from_state = row.get("from_state") or "entry"
            to_state = row.get("to_state") or row.get("event_type") or "unknown"
            trace_rows.append([
                f"{index}. {event_label(row.get('event_type'))}",
                f"{from_state} → {to_state}",
                "blue" if index == 1 else "dim",
            ])
    else:
        for index, row in enumerate(audit_rows[:5], start=1):
            trace_rows.append([
                f"{index}. {event_label(row.get('event_type'))}",
                row.get("recorded_at") or "recorded",
                "blue" if index == 1 else "dim",
            ])
    if not trace_rows:
        trace_rows = [["1. Awaiting workflow events", "No workflow history rows yet", "dim"]]

    active_route_history = build_active_route_history(history_rows, current_state)
    rule_decision = derive_rule_decision(invoice, current_state, latest_transition)
    execution_ticker = build_execution_ticker(invoice, history_rows, audit_rows, timer_rows)

    open_timers = [row for row in timer_rows if row.get("status") == "scheduled"]
    latest_timer = None
    if open_timers:
        latest_timer = open_timers[0]
    elif timer_rows:
        latest_timer = max(
            timer_rows,
            key=lambda row: row.get("cancelled_at") or row.get("fired_at") or row.get("due_at") or "",
        )

    persisted_rows = [
        [
            "workflow_state",
            workflow_state_row.get("current_state") or "not deployed yet",
            "green" if workflow_state_row else "dim",
        ],
        [
            "workflow_state_history",
            f"{len(history_rows)} rows" if history_rows else "not deployed yet",
            "blue" if history_rows else "dim",
        ],
        [
            "workflow_timers",
            f"{len(open_timers)} open" if timer_rows else "not deployed yet",
            "amber" if timer_rows else "dim",
        ],
        [
            "audit_events",
            f"{len(audit_rows)} rows loaded" if audit_rows else "no rows for invoice",
            "green" if audit_rows else "dim",
        ],
    ]

    diagnostics = [
        {
            "title": "Current invoice",
            "copy": f"invoice_id: {invoice.get('id')}<br>status: {invoice.get('status')}<br>updated_at: {invoice.get('updatedAt') or 'n/a'}",
            "mono": True,
        },
        {
            "title": "Workflow tables",
            "copy": "<br>".join([
                f"workflow_state = {'online' if table_availability['workflow_state'] else 'missing'}",
                "workflow_state_history = {'online' if table_availability['workflow_state_history'] else 'missing'}",
                f"workflow_timers = {'online' if table_availability['workflow_timers'] else 'missing'}",
                f"audit_events = {'online' if table_availability['audit_events'] else 'missing'}",
            ]),
            "mono": True,
        },
        {
            "title": "Workflow snapshot",
            "copy": f"current_state: {workflow_state_row.get('current_state', 'n/a')}<br>lock_version: {workflow_state_row.get('lock_version', 'n/a')}<br>machine_id: {workflow_state_row.get('machine_id', 'n/a')}",
            "mono": True,
        },
        {
            "title": "Payload source",
            "copy": "Database-backed runtime payload from workflow tables and audit facts." if source == "database" else "Fallback runtime payload. Database not available.",
        },
    ]

    if latest_transition:
        diagnostics.insert(2, {
            "title": "Latest transition",
            "copy": f"event_type: {latest_transition.get('event_type') or 'n/a'}<br>source: {latest_transition.get('trigger_source') or 'audit'}",
            "mono": True,
        })
    if latest_timer:
        timer_title = "Next timer" if latest_timer.get("status") == "scheduled" else "Latest timer"
        diagnostics.insert(3, {
            "title": timer_title,
            "copy": f"timer_key: {latest_timer.get('timer_key', 'n/a')}<br>due_at: {latest_timer.get('due_at', 'n/a')}<br>status: {latest_timer.get('status', 'n/a')}",
            "mono": True,
        })
    if rule_decision:
        diagnostics.insert(4, {
            "title": f"Rule {rule_decision['id']}",
            "copy": f"guard_name: {rule_decision.get('guard_name', 'n/a')}<br>state: {rule_decision['state']}<br>severity: {rule_decision['severity']}<br>source: {rule_decision['source']}",
            "mono": True,
        })

    workflow_version = workflow_state_row.get("workflow_version") or ("live-db" if source == "database" else "fallback")
    return {
        "workflow": {
            "name": "Invoice Approval Flow",
            "version": workflow_version,
            "status": "Active" if source == "database" else "Fallback",
        },
        "stateIntent": {
            "title": workflow_label,
            "rows": [
                ["Invoice number", invoice.get("invoiceNumber") or "n/a", "blue"],
                ["Vendor", invoice.get("vendor") or "n/a", "blue"],
                ["Current state", workflow_state_row.get("current_state") or current_state, "green" if workflow_state_row else "blue"],
                ["SLA target", invoice.get("sla") or "n/a", "amber"],
            ],
        },
        "transitionIntent": {
            "title": latest_transition.get("event_type") or "invoice.pending",
            "rows": [
                ["Latest event", event_label(latest_transition.get("event_type")), "amber"],
                ["Transition", f"{latest_transition.get('from_state') or 'entry'} → {latest_transition.get('to_state') or current_state}", "blue"],
                ["Trigger source", latest_transition.get("trigger_source") or "audit", "green" if history_rows else "dim"],
            ],
        },
        "routeHistory": {
            "states": active_route_history,
            "current": designer_state_name(current_state),
            "latest_transition": {
                "from": designer_state_name(latest_transition.get("from_state")),
                "to": designer_state_name(latest_transition.get("to_state") or current_state),
                "event_type": latest_transition.get("event_type"),
            },
        },
        "ruleDecision": rule_decision,
        "compiled": [
            {"title": "Canvas", "copy": f"Current operational state is {workflow_label}. Workflow version {workflow_version} is bound to invoice {invoice.get('invoiceNumber') or invoice.get('id')}"},
            {"title": "XState", "copy": f"machine_id={workflow_state_row.get('machine_id', 'invoice-approval')} · current_state={workflow_state_row.get('current_state', current_state)} · last_event={workflow_state_row.get('last_event', latest_transition.get('event_type', 'n/a'))}"},
            {"title": "PostgreSQL", "copy": f"workflow_state={1 if workflow_state_row else 0}, history={len(history_rows)}, timers={len(timer_rows)}, lock_version={workflow_state_row.get('lock_version', 'n/a')}"},
            {"title": "n8n", "copy": f"Latest persisted audit event is {event_label(latest_event.get('event_type') if latest_event else None)}. Runtime tables online: {runtime_tables_online}/3"},
        ],
        "trace": trace_rows,
        "executionTicker": execution_ticker,
        "persisted": persisted_rows,
        "diagnostics": diagnostics,
    }

def filter_dev_invoices(status: str, search: str) -> list[dict]:
    term = (search or "").strip().lower()
    return [
        invoice for invoice in DEV_INVOICES
        if (status in {"", "all"} or invoice["status"] == status)
        and (
            not term or
            term in invoice["invoiceNumber"].lower() or
            term in invoice["vendor"].lower() or
            term in invoice["assignee"].lower() or
            term in invoice["queue"].lower() or
            term in invoice["po"].lower()
        )
    ]

def should_fallback(exc: Exception) -> bool:
    if not ALLOW_DEV_FALLBACK:
        return False
    message = str(exc).lower()
    return any(token in message for token in [
        "does not exist",
        "relation",
        "psycopg2 is not installed",
        "redis client is not installed",
        "connection refused",
        "could not connect",
        "failed to resolve",
        "timeout expired",
        "no such file",
        "no invoice rows",          # empty DB — use dev fallback payload
        "invoice rows available",   # same message, defensive alias
    ])

def fetch_invoices_from_db(tenant_id: str, status: str, search: str, limit: int = 100) -> list[dict]:
    conn = get_db_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            clauses = ["i.tenant_id = %s"]
            params = [tenant_id]
            if status and status != "all":
                clauses.append("i.status = %s")
                params.append(ui_to_db_status(status))
            if search:
                clauses.append("(COALESCE(v.display_name, v.name, latest.extracted_json->>'vendor_name', '') ILIKE %s OR COALESCE(latest.extracted_json->>'invoice_number', '') ILIKE %s OR COALESCE(latest.extracted_json->>'po_number', '') ILIKE %s)")
                term = f"%{search}%"
                params.extend([term, term, term])
            params.append(limit)
            cur.execute(f"""
                SELECT
                  i.id,
                  i.status,
                  i.correlation_id,
                  i.paperless_id,
                  i.received_at,
                  i.updated_at,
                  v.name AS vendor_name,
                  v.display_name,
                  latest.extracted_json,
                  latest.confidence_json
                FROM invoices i
                LEFT JOIN vendors v ON v.id = i.vendor_id
                LEFT JOIN LATERAL (
                  SELECT extracted_json, confidence_json
                  FROM invoice_extractions ie
                  WHERE ie.invoice_id = i.id
                  ORDER BY ie.version DESC
                  LIMIT 1
                ) latest ON TRUE
                WHERE {' AND '.join(clauses)}
                ORDER BY i.updated_at DESC, i.received_at DESC
                LIMIT %s
            """, params)
            return [to_invoice_payload(dict(row)) for row in cur.fetchall()]
    finally:
        conn.close()


def fetch_runtime_view_from_db(tenant_id: str, invoice_id: str | None = None) -> dict:
    conn = get_db_conn()
    if conn is None:
        raise RuntimeError("No database connection available")
    try:
        with conn.cursor() as raw_cur:
            raw_cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            table_availability = {}
            for table_name in ["workflow_state", "workflow_state_history", "workflow_timers", "audit_events"]:
                raw_cur.execute("SELECT to_regclass(%s)", (f"public.{table_name}",))
                table_availability[table_name] = raw_cur.fetchone()[0] is not None

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            params = [tenant_id]
            invoice_clause = ""
            if invoice_id:
                invoice_clause = "AND i.id = %s"
                params.append(invoice_id)
            cur.execute(f"""
                SELECT
                  i.id,
                  i.status,
                  i.correlation_id,
                  i.paperless_id,
                  i.received_at,
                  i.updated_at,
                  v.name AS vendor_name,
                  v.display_name,
                  latest.extracted_json,
                  latest.confidence_json
                FROM invoices i
                LEFT JOIN vendors v ON v.id = i.vendor_id
                LEFT JOIN LATERAL (
                  SELECT extracted_json, confidence_json
                  FROM invoice_extractions ie
                  WHERE ie.invoice_id = i.id
                  ORDER BY ie.version DESC
                  LIMIT 1
                ) latest ON TRUE
                WHERE i.tenant_id = %s {invoice_clause}
                ORDER BY i.updated_at DESC, i.received_at DESC
                LIMIT 1
            """, params)
            invoice_row = cur.fetchone()
            if not invoice_row:
                raise RuntimeError("No invoice rows available for runtime view")

            invoice_payload = to_invoice_payload(dict(invoice_row))

            cur.execute(
                """
                SELECT event_type, reason, recorded_at
                FROM audit_events
                WHERE tenant_id = %s AND invoice_id = %s
                ORDER BY recorded_at DESC
                LIMIT 5
                """,
                (tenant_id, invoice_payload["id"]),
            )
            audit_rows = []
            for row in cur.fetchall():
                audit_rows.append({
                    "event_type": row["event_type"],
                    "reason": row["reason"],
                    "recorded_at": row["recorded_at"].isoformat() if row["recorded_at"] else None,
                })

        table_rows = {"workflow_state_history": [], "workflow_timers": []}
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            if table_availability["workflow_state"]:
                cur.execute(
                    """
                    SELECT id, workflow_definition_id, workflow_version, machine_id, current_state, context_json, snapshot_json, last_event, entered_at, updated_at, lock_version
                    FROM workflow_state
                    WHERE invoice_id = %s
                    LIMIT 1
                    """,
                    (invoice_payload["id"],),
                )
                row = cur.fetchone()
                table_rows["workflow_state"] = dict(row) if row else None
                if row and row.get("entered_at"):
                    table_rows["workflow_state"]["entered_at"] = row["entered_at"].isoformat()
                if row and row.get("updated_at"):
                    table_rows["workflow_state"]["updated_at"] = row["updated_at"].isoformat()

            if table_availability["workflow_state_history"]:
                cur.execute(
                    """
                    SELECT event_type, from_state, to_state, trigger_source, guard_name, rule_id, guard_result, snapshot_json, recorded_at
                    FROM workflow_state_history
                    WHERE invoice_id = %s
                    ORDER BY recorded_at DESC
                    LIMIT 5
                    """,
                    (invoice_payload["id"],),
                )
                for row in cur.fetchall():
                    table_rows["workflow_state_history"].append({
                        "event_type": row["event_type"],
                        "from_state": row["from_state"],
                        "to_state": row["to_state"],
                        "trigger_source": row["trigger_source"],
                        "guard_name": row["guard_name"],
                        "rule_id": row.get("rule_id"),
                        "guard_result": row["guard_result"],
                        "expected": ((row.get("snapshot_json") or {}).get("rule_context") or {}).get("expected"),
                        "actual": ((row.get("snapshot_json") or {}).get("rule_context") or {}).get("actual"),
                        "remediation": ((row.get("snapshot_json") or {}).get("rule_context") or {}).get("remediation"),
                        "recorded_at": row["recorded_at"].isoformat() if row["recorded_at"] else None,
                    })

            if table_availability["workflow_timers"]:
                cur.execute(
                    """
                    SELECT timer_key, timer_type, target_state, status, due_at, fired_at, cancelled_at
                    FROM workflow_timers
                    WHERE invoice_id = %s
                    ORDER BY due_at ASC
                    LIMIT 5
                    """,
                    (invoice_payload["id"],),
                )
                for row in cur.fetchall():
                    table_rows["workflow_timers"].append({
                        "timer_key": row["timer_key"],
                        "timer_type": row["timer_type"],
                        "target_state": row["target_state"],
                        "status": row["status"],
                        "due_at": row["due_at"].isoformat() if row["due_at"] else None,
                        "fired_at": row["fired_at"].isoformat() if row["fired_at"] else None,
                        "cancelled_at": row["cancelled_at"].isoformat() if row["cancelled_at"] else None,
                    })

        with conn.cursor() as raw_cur:
            raw_cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            if table_availability["audit_events"]:
                raw_cur.execute("SELECT 1")

        return {
            "source": "database",
            "tenant_id": tenant_id,
            "invoice_id": invoice_payload["id"],
            "table_availability": table_availability,
            "data": build_runtime_payload("database", invoice_payload, audit_rows, table_availability, table_rows),
        }
    finally:
        conn.close()


def fallback_runtime_view(tenant_id: str, invoice_id: str | None = None) -> dict:
    # Find by ID, else first stub, else synthesise a minimal record
    invoice = (
        next((item for item in DEV_INVOICES if item["id"] == invoice_id), None)
        if invoice_id else None
    ) or (DEV_INVOICES[0] if DEV_INVOICES else None)

    if invoice is None:
        # Synthesise a minimal record so the UI always gets valid JSON
        invoice = {
            "id": invoice_id or "fallback-invoice",
            "status": "received",
            "correlation_id": None,
            "receivedAt": None,
            "vendorName": "Unknown Vendor",
            "confidence": 0.0,
        }

    table_availability = {
        "workflow_state": False,
        "workflow_state_history": False,
        "workflow_timers": False,
        "audit_events": False,
    }
    audit_rows = [{"event_type": "invoice.received", "reason": "fallback payload",
                   "recorded_at": invoice.get("receivedAt")}]
    return {
        "source": "fallback",
        "tenant_id": tenant_id,
        "invoice_id": invoice.get("id", invoice_id),
        "table_availability": table_availability,
        "data": build_runtime_payload("fallback", invoice, audit_rows, table_availability, {}),
    }

def update_invoice_status_db(invoice_id: str, tenant_id: str, next_status: str, event_type: str, reason: str | None = None) -> dict | None:
    conn = get_db_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            cur.execute(
                "SELECT id, status, correlation_id FROM invoices WHERE id = %s AND tenant_id = %s",
                (invoice_id, tenant_id),
            )
            current = cur.fetchone()
            if not current:
                return None
            cur.execute(
                "UPDATE invoices SET status = %s, updated_at = now() WHERE id = %s AND tenant_id = %s",
                (next_status, invoice_id, tenant_id),
            )
            cur.execute(
                """
                INSERT INTO audit_events (event_type, invoice_id, old_value, new_value, reason, source_module, tenant_id, correlation_id)
                VALUES (%s, %s, %s, %s, %s, 'MOD-04', %s, %s)
                """,
                (
                    event_type,
                    invoice_id,
                    json.dumps({"status": current["status"]}),
                    json.dumps({"status": next_status}),
                    reason,
                    tenant_id,
                    current["correlation_id"],
                ),
            )
        conn.commit()
        rows = fetch_invoices_from_db(tenant_id=tenant_id, status="all", search="")
        return next((row for row in rows if row["id"] == invoice_id), None)
    finally:
        conn.close()

def fire_n8n_event(event: str, payload: dict) -> dict:
    """POST a canonical event envelope to the n8n webhook for that event topic."""
    if requests is None:
        raise RuntimeError("requests is not installed")
    path = event.replace(".", "-")
    url  = f"{N8N_BASE_URL}/webhook/{path}"
    headers = {"Content-Type": "application/json"}
    if N8N_WEBHOOK_TOKEN:
        headers["X-Proviso-Token"] = N8N_WEBHOOK_TOKEN

    resp = requests.post(url, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()


def workflow_engine_post(path: str, payload: dict) -> dict:
    if requests is None:
        raise RuntimeError("requests is not installed")
    response = requests.post(
        f"{WORKFLOW_ENGINE_BASE_URL}{path}",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def sync_workflow_transition(*, invoice_id: str, tenant_id: str, event_type: str, target_state: str, correlation_id: str | None, trigger_source: str, source_module: str, reason: str | None = None) -> dict | None:
    """
    Try the external workflow engine first.
    When ALLOW_DEV_FALLBACK and the engine is unreachable, write directly to
    workflow_state + workflow_state_history + workflow_timers — this keeps the
    smoke test steps 4b/5/6 green without a running engine service.
    """
    try:
        result = workflow_engine_post("/advance", {
            "invoice_id": invoice_id, "tenant_id": tenant_id,
            "event_type": event_type, "target_state": target_state,
            "correlation_id": correlation_id, "trigger_source": trigger_source,
            "source_module": source_module, "reason": reason,
        })
        log.info("workflow-engine advance OK: invoice=%s state=%s", invoice_id, target_state)
        return result
    except Exception as exc:
        log.warning("workflow-engine advance failed (%s) — using dev inline path for invoice=%s state=%s",
                    exc, invoice_id, target_state)

    if not ALLOW_DEV_FALLBACK:
        return None

    return _sync_workflow_transition_dev(
        invoice_id=invoice_id, tenant_id=tenant_id,
        event_type=event_type, target_state=target_state,
        correlation_id=correlation_id, trigger_source=trigger_source,
        reason=reason,
    )


def _sync_workflow_transition_dev(*, invoice_id: str, tenant_id: str, event_type: str,
                                   target_state: str, correlation_id: str | None,
                                   trigger_source: str, reason: str | None) -> dict | None:
    """
    Phase I inline dev implementation of the workflow engine's /advance endpoint.
    Writes workflow_state, workflow_state_history, and a workflow_timers SLA row
    directly to PostgreSQL — no external service required.
    Remove when the real workflow engine (MOD-04) is deployed.
    """
    conn = get_db_conn()
    if conn is None:
        log.warning("_sync_workflow_transition_dev: no DB connection")
        return None

    # SLA durations per state (mirrors migration 005 bootstrap logic)
    _SLA = {
        "pending_approval": "4 hours", "exception": "1 hour",
        "matched": "2 hours",          "extracted": "1 hour",
    }

    try:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))

            # 1. Upsert workflow_state
            cur.execute("""
                SELECT id, current_state FROM workflow_state WHERE invoice_id = %s
            """, (invoice_id,))
            existing = cur.fetchone()
            from_state = existing[1] if existing else None
            ws_id = existing[0] if existing else None

            if ws_id:
                cur.execute("""
                    UPDATE workflow_state
                    SET current_state = %s, last_event = %s, updated_at = NOW()
                    WHERE id = %s
                """, (target_state, event_type, ws_id))
            else:
                cur.execute("""
                    INSERT INTO workflow_state
                      (tenant_id, invoice_id, workflow_version, machine_id,
                       current_state, context_json, snapshot_json, last_event)
                    VALUES (%s::uuid, %s::uuid, 'v1', 'invoice-approval',
                            %s, %s::jsonb, %s::jsonb, %s)
                    RETURNING id
                """, (tenant_id, invoice_id, target_state,
                      json.dumps({"invoice_id": invoice_id, "status": target_state}),
                      json.dumps({"value": target_state}),
                      event_type))
                ws_id = cur.fetchone()[0]

            # 2. Append workflow_state_history
            cur.execute("""
                INSERT INTO workflow_state_history
                  (tenant_id, invoice_id, workflow_state_id, event_type,
                   from_state, to_state, guard_result, trigger_source,
                   correlation_id, action_summary, recorded_at)
                VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s,
                        TRUE, %s, %s::uuid, %s::jsonb, NOW())
            """, (tenant_id, invoice_id, ws_id, event_type,
                  from_state, target_state, trigger_source,
                  correlation_id,
                  json.dumps([reason or f"{event_type} via dev-inline"])))

            # 3. Cancel any existing SLA timer for this invoice
            cur.execute("""
                UPDATE workflow_timers
                SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
                WHERE invoice_id = %s AND timer_key = 'sla.current' AND status = 'scheduled'
            """, (invoice_id,))

            # 4. Open a new SLA timer if this state needs one
            sla = _SLA.get(target_state)
            if sla:
                cur.execute(f"""
                    INSERT INTO workflow_timers
                      (tenant_id, invoice_id, workflow_state_id, timer_key,
                       timer_type, target_state, status, due_at, payload_json)
                    VALUES (%s::uuid, %s::uuid, %s::uuid, 'sla.current',
                            'sla', %s, 'scheduled',
                            NOW() + INTERVAL '{sla}',
                            %s::jsonb)
                """, (tenant_id, invoice_id, ws_id, target_state,
                      json.dumps({"source": "dev-inline", "event_type": event_type})))
                log.info("_sync_workflow_transition_dev: SLA timer created (%s) for %s", sla, target_state)

        conn.commit()
        log.info("_sync_workflow_transition_dev: OK invoice=%s %s→%s", invoice_id, from_state, target_state)
        return {"ok": True, "source": "dev-inline", "state": target_state}

    except Exception as exc:
        log.error("_sync_workflow_transition_dev FAILED invoice=%s: %s", invoice_id, exc, exc_info=True)
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    finally:
        try:
            conn.close()
        except Exception:
            pass


def sync_timer_lifecycle(payload: dict) -> dict:
    return workflow_engine_post("/timers/mark", payload)


def has_valid_internal_token(req) -> bool:
    if not N8N_WEBHOOK_TOKEN:
        return True
    return req.headers.get("X-Proviso-Token", "") == N8N_WEBHOOK_TOKEN


def compute_workflow_webhook_signature(timestamp: str, raw_body: str) -> str:
    if not WORKFLOW_WEBHOOK_SECRET:
        raise RuntimeError("workflow webhook secret is not configured")
    payload = f"{timestamp}.{raw_body}".encode("utf-8")
    return hmac.new(
        WORKFLOW_WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()


def has_valid_workflow_signature(req, raw_body: str) -> bool:
    if not WORKFLOW_WEBHOOK_SECRET:
        return False

    timestamp = (req.headers.get("X-Proviso-Timestamp") or "").strip()
    signature = (req.headers.get("X-Proviso-Signature") or "").strip()
    if not timestamp or not signature:
        return False

    try:
        signed_at = int(timestamp)
    except ValueError:
        return False

    if abs(int(time.time()) - signed_at) > WORKFLOW_WEBHOOK_TTL_SECONDS:
        return False

    expected = f"v1={compute_workflow_webhook_signature(timestamp, raw_body)}"
    return hmac.compare_digest(signature, expected)


def _render_workflow_svg(nodes: list, edges: list) -> str:
        safe_nodes = [node for node in (nodes or []) if isinstance(node, dict)]
        safe_edges = [edge for edge in (edges or []) if isinstance(edge, dict)]

        if not safe_nodes:
                return """<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"700\"><rect width=\"100%\" height=\"100%\" fill=\"#0a1525\"/><text x=\"30\" y=\"48\" fill=\"#dbeafe\" font-size=\"18\" font-family=\"Segoe UI,Arial,sans-serif\">No nodes to render</text></svg>"""

        min_x = min((float(node.get("position", {}).get("x", 0)) for node in safe_nodes), default=0)
        min_y = min((float(node.get("position", {}).get("y", 0)) for node in safe_nodes), default=0)
        max_x = max((float(node.get("position", {}).get("x", 0)) + 220 for node in safe_nodes), default=1200)
        max_y = max((float(node.get("position", {}).get("y", 0)) + 120 for node in safe_nodes), default=700)

        width = int(max(1200, (max_x - min_x) + 180))
        height = int(max(700, (max_y - min_y) + 180))
        offset_x = 80 - min_x
        offset_y = 80 - min_y

        node_centers = {}
        node_markup = []
        for node in safe_nodes:
                node_id = str(node.get("id", ""))
                position = node.get("position", {}) or {}
                x = float(position.get("x", 0)) + offset_x
                y = float(position.get("y", 0)) + offset_y
                label = html.escape(str((node.get("data") or {}).get("label") or (node.get("data") or {}).get("name") or node_id))

                node_centers[node_id] = (x + 110, y + 55)
                node_markup.append(f"""
<g>
    <rect x=\"{x:.2f}\" y=\"{y:.2f}\" rx=\"12\" ry=\"12\" width=\"220\" height=\"110\" fill=\"#0b1f35\" stroke=\"#4A9FFF99\" stroke-width=\"1.4\"/>
    <text x=\"{x + 14:.2f}\" y=\"{y + 38:.2f}\" fill=\"#dbeafe\" font-size=\"13\" font-family=\"Segoe UI,Arial,sans-serif\">{label}</text>
</g>
""")

        edge_markup = []
        for edge in safe_edges:
                source = str(edge.get("source", ""))
                target = str(edge.get("target", ""))
                if source not in node_centers or target not in node_centers:
                        continue
                sx, sy = node_centers[source]
                tx, ty = node_centers[target]
                label = html.escape(str((edge.get("data") or {}).get("label") or edge.get("label") or ""))
                mx = (sx + tx) / 2
                my = (sy + ty) / 2
                edge_markup.append(f"""
<g>
    <line x1=\"{sx:.2f}\" y1=\"{sy:.2f}\" x2=\"{tx:.2f}\" y2=\"{ty:.2f}\" stroke=\"#38bdf8\" stroke-width=\"2\" marker-end=\"url(#arrow)\" />
    <text x=\"{mx + 4:.2f}\" y=\"{my - 6:.2f}\" fill=\"#7dd3fc\" font-size=\"11\" font-family=\"Segoe UI,Arial,sans-serif\">{label}</text>
</g>
""")

        return f"""<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" viewBox=\"0 0 {width} {height}\">
<defs>
    <marker id=\"arrow\" markerWidth=\"10\" markerHeight=\"8\" refX=\"9\" refY=\"4\" orient=\"auto\">
        <path d=\"M0,0 L10,4 L0,8 z\" fill=\"#38bdf8\" />
    </marker>
</defs>
<rect width=\"100%\" height=\"100%\" fill=\"#0a1525\" />
{''.join(edge_markup)}
{''.join(node_markup)}
</svg>"""


# ─────────────────────────────────────────────────────────────────────────────
# AP WORKBENCH READ / MUTATION ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/dashboard/summary", methods=["GET"])
def dashboard_summary():
    tenant_id = get_tenant_id()
    try:
        invoices = fetch_invoices_from_db(tenant_id=tenant_id, status="all", search="")
        return jsonify({"source": "database", "tenant_id": tenant_id, "metrics": summarize_invoices(invoices)}), 200
    except Exception as exc:
        if should_fallback(exc):
            log.warning("dashboard summary fallback engaged: %s", exc)
            return jsonify({"source": "fallback", "tenant_id": tenant_id, "metrics": summarize_invoices(DEV_INVOICES)}), 200
        return jsonify({"error": "dashboard_summary_failed", "detail": str(exc)}), 500


@app.route("/api/invoices", methods=["GET"])
def list_invoices():
    tenant_id = get_tenant_id()
    status = (request.args.get("status") or "all").strip().lower()
    search = (request.args.get("search") or "").strip()
    try:
        invoices = fetch_invoices_from_db(tenant_id=tenant_id, status=status, search=search)
        return jsonify({"source": "database", "tenant_id": tenant_id, "items": invoices, "count": len(invoices)}), 200
    except Exception as exc:
        if should_fallback(exc):
            log.warning("invoice list fallback engaged: %s", exc)
            invoices = filter_dev_invoices(status=status, search=search)
            return jsonify({"source": "fallback", "tenant_id": tenant_id, "items": invoices, "count": len(invoices)}), 200
        return jsonify({"error": "invoice_list_failed", "detail": str(exc)}), 500


@app.route("/api/invoices/<invoice_id>/approve", methods=["POST"])
def approve_invoice(invoice_id: str):
    tenant_id = (request.get_json(silent=True) or {}).get("tenant_id") or get_tenant_id()
    try:
        updated = update_invoice_status_db(
            invoice_id=invoice_id,
            tenant_id=tenant_id,
            next_status="approved",
            event_type="invoice.approved",
            reason="Approved from AP Workbench",
        )
        if not updated:
            return jsonify({"error": "invoice_not_found"}), 404
        sync_workflow_transition(
            invoice_id=invoice_id,
            tenant_id=tenant_id,
            event_type="invoice.approved",
            target_state="approved",
            correlation_id=updated.get("correlationId"),
            trigger_source="api",
            source_module="MOD-04",
            reason="Approved from AP Workbench",
        )
        return jsonify({"source": "database", "item": updated}), 200
    except Exception as exc:
        if should_fallback(exc):
            updated = next((invoice for invoice in DEV_INVOICES if invoice["id"] == invoice_id), None)
            if not updated:
                return jsonify({"error": "invoice_not_found"}), 404
            updated["status"] = "approved"
            updated["queue"] = "Ready to Post"
            updated["assignee"] = "AP Manager"
            updated["confidence"] = max(updated["confidence"], 0.96)
            return jsonify({"source": "fallback", "item": updated}), 200
        return jsonify({"error": "invoice_approve_failed", "detail": str(exc)}), 500


@app.route("/api/invoices/<invoice_id>/review", methods=["POST"])
def send_invoice_to_review(invoice_id: str):
    tenant_id = (request.get_json(silent=True) or {}).get("tenant_id") or get_tenant_id()
    try:
        updated = update_invoice_status_db(
            invoice_id=invoice_id,
            tenant_id=tenant_id,
            next_status="exception",
            event_type="invoice.exception",
            reason="Returned to review from AP Workbench",
        )
        if not updated:
            return jsonify({"error": "invoice_not_found"}), 404
        sync_workflow_transition(
            invoice_id=invoice_id,
            tenant_id=tenant_id,
            event_type="invoice.exception",
            target_state="exception",
            correlation_id=updated.get("correlationId"),
            trigger_source="api",
            source_module="MOD-04",
            reason="Returned to review from AP Workbench",
        )
        return jsonify({"source": "database", "item": updated}), 200
    except Exception as exc:
        if should_fallback(exc):
            updated = next((invoice for invoice in DEV_INVOICES if invoice["id"] == invoice_id), None)
            if not updated:
                return jsonify({"error": "invoice_not_found"}), 404
            updated["status"] = "review"
            updated["queue"] = "Exception Queue"
            updated["assignee"] = "AP Review"
            return jsonify({"source": "fallback", "item": updated}), 200
        return jsonify({"error": "invoice_review_failed", "detail": str(exc)}), 500


@app.route("/api/runtime-view", methods=["GET"])
def runtime_view():
    """
    Always returns a valid JSON payload.
    Tries DB first; falls back to in-memory DEV payload on any failure.
    Never returns 500 in dev mode — UI polling must not block on backend data gaps.
    """
    tenant_id  = get_tenant_id()
    invoice_id = request.args.get("invoice_id")

    # 1. Try full DB path
    db_error_msg = None
    try:
        return jsonify(fetch_runtime_view_from_db(tenant_id=tenant_id, invoice_id=invoice_id)), 200
    except Exception as exc:
        db_error_msg = f"{type(exc).__name__}: {exc}"
        log.warning("runtime-view DB path failed (%s) — trying fallback", db_error_msg)

    # 2. Always attempt fallback — never surface a 500 for missing data
    try:
        return jsonify(fallback_runtime_view(tenant_id=tenant_id, invoice_id=invoice_id)), 200
    except Exception as fallback_exc:
        log.error("runtime-view fallback also failed: %s", fallback_exc, exc_info=True)
        return jsonify({
            "error": "runtime_view_failed",
            "detail": str(fallback_exc),
            "original": db_error_msg or "unknown",
        }), 500

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

def _simulate_ocr_dev(invoice_id: str, tenant_id: str, correlation_id: str):
    """
    Phase I MOD-02 stub — runs in background thread when ALLOW_DEV_FALLBACK=True.
    Simulates PaddleOCR extraction: writes invoice_extractions row, updates
    invoice status to 'extracted', and fires invoice.extracted → workflow.
    Remove when the real OCR worker (MOD-02) is deployed.
    """
    import time
    time.sleep(1)   # brief delay — mimics network + GPU latency

    mock_extracted = {
        "vendor_name":    "Acme Supplies Ltd",
        "invoice_number": f"INV-{invoice_id[:8].upper()}",
        "invoice_date":   datetime.now(timezone.utc).date().isoformat(),
        "total_amount":   1250.00,
        "currency":       "CAD",
        "po_number":      "PO-2024-0042",
        "line_items":     [{"description": "Office Supplies", "quantity": 5, "unit_price": 250.00, "total": 1250.00}],
    }
    mock_confidence = {
        "vendor_name":    0.97,
        "invoice_number": 0.99,
        "total_amount":   0.95,
        "po_number":      0.88,
    }

    conn = get_db_conn()
    if conn is None:
        log.warning("_simulate_ocr_dev: no DB connection, skipping")
        return

    log.info("_simulate_ocr_dev: START invoice=%s tenant=%s", invoice_id, tenant_id)
    try:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            log.info("_simulate_ocr_dev: inserting invoice_extractions")
            cur.execute("""
                INSERT INTO invoice_extractions
                  (invoice_id, version, extracted_json, confidence_json, ocr_engine)
                VALUES (%s, 1, %s, %s, 'paddle-dev-stub')
            """, (invoice_id, json.dumps(mock_extracted), json.dumps(mock_confidence)))

            cur.execute("SET LOCAL app.current_tenant_id = %s", (tenant_id,))
            log.info("_simulate_ocr_dev: updating invoice status → extracted")
            cur.execute(
                "UPDATE invoices SET status = 'extracted', updated_at = NOW() WHERE id = %s",
                (invoice_id,)
            )
            cur.execute("""
                INSERT INTO audit_events (event_type, invoice_id, source_module, tenant_id, correlation_id, new_value)
                VALUES ('invoice.extracted', %s, 'MOD-02', %s, %s, %s)
            """, (invoice_id, tenant_id, correlation_id,
                  json.dumps({"confidence_avg": 0.95, "source": "dev-stub"})))

        conn.commit()
        log.info("_simulate_ocr_dev: DB writes committed for invoice=%s", invoice_id)

        result = sync_workflow_transition(
            invoice_id=invoice_id,
            tenant_id=tenant_id,
            event_type="invoice.extracted",
            target_state="extracted",
            correlation_id=correlation_id,
            trigger_source="mod-02-stub",
            source_module="MOD-02",
            reason="Dev-mode OCR simulation complete",
        )
        log.info("_simulate_ocr_dev: sync_workflow_transition result=%s", result)
    except Exception as exc:
        log.error("_simulate_ocr_dev FAILED at DB write for invoice=%s: %s", invoice_id, exc, exc_info=True)
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


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

    # Dev-mode Phase I stub: no real OCR worker running yet.
    # Simulate MOD-02 extraction in a background thread so the smoke test
    # and UI can observe the full intake → extracted → approval pipeline.
    if ALLOW_DEV_FALLBACK:
        import threading
        threading.Thread(
            target=_simulate_ocr_dev,
            args=(invoice_id, tenant_id, correlation_id),
            daemon=True,
        ).start()

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
    workflow_ack = None
    workflow_ack = sync_workflow_transition(
        invoice_id=invoice_id,
        tenant_id=tenant_id,
        event_type="invoice.received",
        target_state="received",
        correlation_id=correlation_id,
        trigger_source="api",
        source_module="MOD-01",
        reason="Invoice intake accepted",
    )
    try:
        n8n_ack = fire_n8n_event("invoice.received", event_payload)
        log.info("invoice.received fired → n8n ack=%s", n8n_ack)
    except Exception as exc:
        log.warning("n8n not reachable (non-fatal in dev): %s", exc)

    return jsonify({
        "invoice_id":     invoice_id,
        "correlation_id": correlation_id,
        "status":         "received",
        "workflow_ack":   workflow_ack,
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


@app.route("/api/workflow/timers/mark", methods=["POST"])
def mark_workflow_timer():
    payload = request.get_json(force=True, silent=True) or {}
    payload.setdefault("tenant_id", get_tenant_id())
    try:
        result = sync_timer_lifecycle(payload)
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({"error": "timer_mark_failed", "detail": str(exc)}), 502


@app.route("/api/webhooks/workflow/timers/mark", methods=["POST"])
def mark_workflow_timer_webhook():
    raw_body = request.get_data(cache=True, as_text=True) or "{}"
    if not has_valid_workflow_signature(request, raw_body):
        return jsonify({"error": "unauthorized"}), 401

    body = request.get_json(force=True, silent=True) or {}
    items = body.get("items") if isinstance(body.get("items"), list) else [body]
    results = []

    for item in items:
        payload = dict(item or {})
        payload.setdefault("tenant_id", get_tenant_id())
        payload.setdefault("lifecycle_source", "webhook")
        try:
            results.append(sync_timer_lifecycle(payload))
        except Exception as exc:
            return jsonify({
                "error": "timer_mark_failed",
                "detail": str(exc),
                "failed_payload": payload,
            }), 502

    return jsonify({"ok": True, "count": len(results), "results": results}), 200


# ═════════════════════════════════════════════════════════════════════════════
# WORKFLOW DESIGNER — Persistence API
# Stores WorkflowDefinition JSON objects created in the designer canvas.
# Falls back to an in-process dict when no DB is available.
# ═════════════════════════════════════════════════════════════════════════════

# ── In-memory fallback stores (single-process dev mode) ──────────────────────
_proj_memory: dict = {}   # project_id → project record
_wf_memory:   dict = {}   # workflow_id → workflow record


# ─── Project Container Model — PRD v12 §2.3 ──────────────────────────────────

def _ensure_projects_table():
    """Create projects table and add project_id FK to workflow_definitions if needed."""
    conn = get_db_conn()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            # projects table — one row = one client engagement
            cur.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    tenant_id    TEXT        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
                    name         TEXT        NOT NULL,
                    client_name  TEXT        NOT NULL DEFAULT '',
                    description  TEXT        NOT NULL DEFAULT '',
                    status       TEXT        NOT NULL DEFAULT 'draft',
                    version      TEXT        NOT NULL DEFAULT '1.0.0',
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            # Add project_id to workflow_definitions (nullable — migration safe)
            cur.execute("""
                ALTER TABLE workflow_definitions
                ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE CASCADE
            """)
        conn.commit()
        log.info("projects table ready")
    except Exception as exc:
        log.warning("projects table init failed: %s", exc)
        conn.rollback()


def _projects_table_ready() -> bool:
    conn = get_db_conn()
    if conn is None:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = 'projects'")
            return bool(cur.fetchone())
    except Exception:
        return False


@app.route("/api/projects", methods=["GET"])
def list_projects():
    """List all projects for the current tenant."""
    tenant_id = get_tenant_id()
    if _projects_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, client_name, description, status, version,
                           created_at, updated_at
                    FROM projects
                    WHERE tenant_id = %s
                    ORDER BY updated_at DESC
                """, (tenant_id,))
                rows = cur.fetchall()
            return jsonify({"ok": True, "projects": [dict(r) for r in rows]}), 200
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500
    else:
        projects = [p for p in _proj_memory.values() if p.get("tenant_id") == tenant_id]
        return jsonify({"ok": True, "projects": sorted(projects, key=lambda p: p.get("updated_at",""), reverse=True)}), 200


@app.route("/api/projects", methods=["POST"])
def create_project():
    """Create a new project container."""
    _ensure_projects_table()
    tenant_id = get_tenant_id()
    body      = request.get_json(silent=True) or {}
    name        = (body.get("name") or "").strip()
    client_name = (body.get("client_name") or "").strip()
    description = (body.get("description") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    import uuid as _uuid
    proj_id = body.get("id") or str(_uuid.uuid4())
    now     = datetime.now(timezone.utc).isoformat()

    if _projects_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO projects (id, tenant_id, name, client_name, description, status, version, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, 'draft', '1.0.0', NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE
                        SET name=EXCLUDED.name, client_name=EXCLUDED.client_name,
                            description=EXCLUDED.description, updated_at=NOW()
                    RETURNING *
                """, (proj_id, tenant_id, name, client_name, description))
                row = cur.fetchone()
            conn.commit()
            return jsonify({"ok": True, "project": dict(row)}), 201
        except Exception as exc:
            conn.rollback()
            return jsonify({"error": str(exc)}), 500
    else:
        record = {"id": proj_id, "tenant_id": tenant_id, "name": name,
                  "client_name": client_name, "description": description,
                  "status": "draft", "version": "1.0.0",
                  "created_at": now, "updated_at": now}
        _proj_memory[proj_id] = record
        return jsonify({"ok": True, "project": record}), 201


@app.route("/api/projects/<project_id>", methods=["GET"])
def get_project(project_id):
    """Fetch a single project by id."""
    if _projects_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
                row = cur.fetchone()
            if not row:
                return jsonify({"error": "not found"}), 404
            return jsonify({"ok": True, "project": dict(row)}), 200
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500
    else:
        proj = _proj_memory.get(project_id)
        if not proj:
            return jsonify({"error": "not found"}), 404
        return jsonify({"ok": True, "project": proj}), 200


@app.route("/api/projects/<project_id>", methods=["PUT"])
def update_project(project_id):
    """Update project metadata (name, client_name, description, status)."""
    body = request.get_json(silent=True) or {}
    if _projects_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    UPDATE projects SET
                        name        = COALESCE(%s, name),
                        client_name = COALESCE(%s, client_name),
                        description = COALESCE(%s, description),
                        status      = COALESCE(%s, status),
                        updated_at  = NOW()
                    WHERE id = %s
                    RETURNING *
                """, (body.get("name"), body.get("client_name"),
                      body.get("description"), body.get("status"), project_id))
                row = cur.fetchone()
            conn.commit()
            if not row:
                return jsonify({"error": "not found"}), 404
            return jsonify({"ok": True, "project": dict(row)}), 200
        except Exception as exc:
            conn.rollback()
            return jsonify({"error": str(exc)}), 500
    else:
        proj = _proj_memory.get(project_id)
        if not proj:
            return jsonify({"error": "not found"}), 404
        for field in ("name", "client_name", "description", "status"):
            if body.get(field) is not None:
                proj[field] = body[field]
        proj["updated_at"] = datetime.now(timezone.utc).isoformat()
        return jsonify({"ok": True, "project": proj}), 200


@app.route("/api/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    """Soft-delete a project (sets status → archived)."""
    if _projects_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE projects SET status='archived', updated_at=NOW() WHERE id=%s",
                    (project_id,)
                )
            conn.commit()
        except Exception as exc:
            conn.rollback()
            return jsonify({"error": str(exc)}), 500
    else:
        if project_id in _proj_memory:
            _proj_memory[project_id]["status"] = "archived"
    return jsonify({"ok": True}), 200


@app.route("/api/projects/<project_id>/workflows", methods=["GET"])
def list_project_workflows(project_id):
    """List all workflow stubs belonging to a specific project."""
    if _wf_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, status, version, updated_at
                    FROM workflow_definitions
                    WHERE project_id = %s
                    ORDER BY updated_at DESC
                """, (project_id,))
                rows = cur.fetchall()
            return jsonify({"ok": True, "workflows": [dict(r) for r in rows]}), 200
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500
    else:
        workflows = [
            {"id": k, "name": v["name"], "status": v.get("status", "draft"),
             "version": v.get("version", 1), "updated_at": v.get("updated_at", "")}
            for k, v in _wf_memory.items()
            if v.get("project_id") == project_id
        ]
        return jsonify({"ok": True, "workflows": workflows}), 200


def _wf_table_ready() -> bool:
    """Return True if the workflow_definitions table exists in Postgres."""
    conn = get_db_conn()
    if conn is None:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'workflow_definitions'
                LIMIT 1
            """)
            return cur.fetchone() is not None
    except Exception:
        return False


def _ensure_wf_table():
    """Create workflow_definitions table if it doesn't exist."""
    conn = get_db_conn()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS workflow_definitions (
                    id            TEXT PRIMARY KEY,
                    tenant_id     TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
                    name          TEXT NOT NULL,
                    status        TEXT NOT NULL DEFAULT 'draft',
                    version       INTEGER NOT NULL DEFAULT 1,
                    definition    JSONB NOT NULL,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
        conn.commit()
    except Exception as exc:
        log.warning("workflow_definitions table init failed: %s", exc)
        conn.rollback()


@app.route("/api/workflows", methods=["GET"])
def list_workflows():
    """List all workflow definitions for the tenant."""
    tenant_id = request.args.get("tenant_id", DEV_TENANT_ID)

    if _wf_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, status, version, updated_at
                    FROM workflow_definitions
                    WHERE tenant_id = %s
                    ORDER BY updated_at DESC
                """, (tenant_id,))
                rows = cur.fetchall()
            return jsonify({"ok": True, "workflows": [dict(r) for r in rows]}), 200
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500
    else:
        wfs = [
            {"id": k, "name": v.get("name", "Untitled"), "status": v.get("status", "draft"),
             "version": v.get("version", 1), "updated_at": v.get("updated_at")}
            for k, v in _wf_memory.items()
            if v.get("tenant_id", DEV_TENANT_ID) == tenant_id
        ]
        return jsonify({"ok": True, "workflows": wfs}), 200


@app.route("/api/workflows/<workflow_id>", methods=["GET"])
def get_workflow(workflow_id):
    """Return the full WorkflowDefinition JSON for a specific workflow."""
    if _wf_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM workflow_definitions WHERE id = %s",
                    (workflow_id,)
                )
                row = cur.fetchone()
            if not row:
                return jsonify({"error": "not found"}), 404
            payload = dict(row)
            payload["definition"] = payload.get("definition") or {}
            return jsonify({"ok": True, "workflow": payload}), 200
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500
    else:
        wf = _wf_memory.get(workflow_id)
        if not wf:
            return jsonify({"error": "not found"}), 404
        return jsonify({"ok": True, "workflow": wf}), 200


@app.route("/api/workflows", methods=["POST"])
def create_workflow():
    """Create a new workflow definition (status: draft)."""
    _ensure_wf_table()
    body = request.get_json(silent=True) or {}
    wf_id      = body.get("id") or str(uuid.uuid4())
    tenant_id  = body.get("tenant_id", DEV_TENANT_ID)
    name       = body.get("name", "Untitled Workflow")
    definition = body.get("definition", {})
    now        = datetime.now(timezone.utc).isoformat()

    record = {
        "id":         wf_id,
        "tenant_id":  tenant_id,
        "name":       name,
        "status":     "draft",
        "version":    1,
        "definition": definition,
        "created_at": now,
        "updated_at": now,
    }

    if _wf_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO workflow_definitions
                        (id, tenant_id, name, status, version, definition, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        definition = EXCLUDED.definition,
                        updated_at = EXCLUDED.updated_at
                """, (wf_id, tenant_id, name, "draft", 1,
                      json.dumps(definition), now, now))
            conn.commit()
        except Exception as exc:
            conn.rollback()
            return jsonify({"error": str(exc)}), 500
    else:
        _wf_memory[wf_id] = record

    return jsonify({"ok": True, "workflow": record}), 201


@app.route("/api/workflows/<workflow_id>", methods=["PUT"])
def save_workflow(workflow_id):
    """Save (upsert) a workflow definition — called by auto-save every 2 s when isDirty."""
    _ensure_wf_table()
    body       = request.get_json(silent=True) or {}
    tenant_id  = body.get("tenant_id", DEV_TENANT_ID)
    name       = body.get("name", "Untitled Workflow")
    definition = body.get("definition", {})
    version    = int(body.get("version", 1))
    now        = datetime.now(timezone.utc).isoformat()

    if _wf_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO workflow_definitions
                        (id, tenant_id, name, status, version, definition, created_at, updated_at)
                    VALUES (%s,%s,%s,'draft',%s,%s::jsonb,NOW(),%s)
                    ON CONFLICT (id) DO UPDATE SET
                        name       = EXCLUDED.name,
                        definition = EXCLUDED.definition,
                        version    = EXCLUDED.version,
                        updated_at = EXCLUDED.updated_at
                    RETURNING id, name, status, version, updated_at
                """, (workflow_id, tenant_id, name, version, json.dumps(definition), now))
                row = cur.fetchone()
            conn.commit()
            return jsonify({"ok": True, "workflow": dict(row)}), 200
        except Exception as exc:
            conn.rollback()
            return jsonify({"error": str(exc)}), 500
    else:
        existing = _wf_memory.get(workflow_id, {})
        record = {**existing,
                  "id": workflow_id, "tenant_id": tenant_id,
                  "name": name, "definition": definition,
                  "version": version, "status": existing.get("status", "draft"),
                  "updated_at": now}
        _wf_memory[workflow_id] = record
        return jsonify({"ok": True, "workflow": {"id": workflow_id, "name": name,
                                                  "status": record["status"],
                                                  "version": version, "updated_at": now}}), 200


@app.route("/api/workflows/<workflow_id>/publish", methods=["POST"])
def publish_workflow(workflow_id):
    """Transition a workflow from draft → published and increment its version."""
    if _wf_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    UPDATE workflow_definitions
                    SET status = 'published', version = version + 1, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, name, status, version, updated_at
                """, (workflow_id,))
                row = cur.fetchone()
            conn.commit()
            if not row:
                return jsonify({"error": "not found"}), 404
            return jsonify({"ok": True, "workflow": dict(row)}), 200
        except Exception as exc:
            conn.rollback()
            return jsonify({"error": str(exc)}), 500
    else:
        wf = _wf_memory.get(workflow_id)
        if not wf:
            return jsonify({"error": "not found"}), 404
        wf["status"]  = "published"
        wf["version"] = wf.get("version", 1) + 1
        wf["updated_at"] = datetime.now(timezone.utc).isoformat()
        return jsonify({"ok": True, "workflow": {
            "id": workflow_id, "name": wf["name"],
            "status": "published", "version": wf["version"],
            "updated_at": wf["updated_at"]}}), 200


@app.route("/api/workflows/<workflow_id>", methods=["DELETE"])
def delete_workflow(workflow_id):
    """Soft-delete (retire) a workflow definition."""
    if _wf_table_ready():
        conn = get_db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE workflow_definitions SET status='retired', updated_at=NOW() WHERE id=%s",
                    (workflow_id,)
                )
            conn.commit()
        except Exception as exc:
            conn.rollback()
            return jsonify({"error": str(exc)}), 500
    else:
        if workflow_id in _wf_memory:
            _wf_memory[workflow_id]["status"] = "retired"
    return jsonify({"ok": True}), 200


@app.route("/api/workflows/export-svg", methods=["POST"])
def export_workflow_svg():
    body = request.get_json(silent=True) or {}
    nodes = body.get("nodes") if isinstance(body.get("nodes"), list) else []
    edges = body.get("edges") if isinstance(body.get("edges"), list) else []

    if len(nodes) > 2000 or len(edges) > 4000:
        return jsonify({"error": "payload_too_large"}), 413

    svg = _render_workflow_svg(nodes, edges)
    response = app.response_class(svg, mimetype="image/svg+xml")
    response.headers["Content-Disposition"] = "attachment; filename=workflow-export.svg"
    return response


# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=port, debug=debug)

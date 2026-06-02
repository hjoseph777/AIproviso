#!/usr/bin/env python3
"""
seed_dataset.py — AI Proviso workflows_dataset seed (10 records)

Pass 1: insert records with embedding=NULL
Pass 2: generate embeddings for rows where embedding IS NULL

Usage:
    python backend/seed_dataset.py                  # both passes
    python backend/seed_dataset.py --no-embed       # pass 1 only
    python backend/seed_dataset.py --status         # print counts and exit

Requires migration 008 applied first.
"""

import argparse
import json
import os
import sys

import psycopg2
import requests

DATABASE_URL    = os.environ.get("DATABASE_URL", "postgresql://proviso:change-me@localhost:5432/proviso")
OLLAMA_URL      = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL     = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
TENANT_ID       = os.environ.get("TENANT_ID", "00000000-0000-0000-0000-000000000001")

# ── 10 seed records — Canadian SME AP automation scenarios ───────────────────
SEED_RECORDS = [
    {
        "project_name": "Retail AP Automation - QuickBooks Duplicate Control",
        "scenario_text": (
            "Retail SME in Ontario using QuickBooks processes 120 invoices daily. "
            "Frequent duplicate invoices and manual entry errors require OCR extraction "
            "and automated duplicate detection with a 48 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "duplicate_check",
                      "validation", "approval", "erp_sync"]
        },
        "industry": "retail",
        "province": "ON",
        "erp_type": "quickbooks",
        "state_count": 6,
        "threshold_amount": 5000,
        "sla_hours": 48,
        "approval_tiers": 1,
        "touchless_rate": 0.72,
        "complexity": "medium",
        "tags": ["retail", "ocr", "duplicates", "quickbooks"],
        "document_types": ["invoice", "receipt"],
        "pain_points": ["manual entry errors", "duplicate invoices"],
        "metrics": {"error_reduction": "90%", "time_saved": "20 hours/week", "cost_savings": "$5,000/month"},
        "compliance": ["SOX"],
    },
    {
        "project_name": "Manufacturing AP - SAP 3-Way Matching",
        "scenario_text": (
            "Manufacturing company in Ontario using SAP processes 200 invoices daily. "
            "High failure rates in 3-way matching between PO, GRN, and invoices require "
            "automated OCR and reconciliation with 24 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "3_way_matching",
                      "exception_handling", "approval", "payment"]
        },
        "industry": "manufacturing",
        "province": "ON",
        "erp_type": "sap",
        "state_count": 6,
        "threshold_amount": 10000,
        "sla_hours": 24,
        "approval_tiers": 2,
        "touchless_rate": 0.81,
        "complexity": "medium",
        "tags": ["manufacturing", "sap", "3-way-match", "ocr"],
        "document_types": ["invoice", "purchase_order", "goods_receipt_note"],
        "pain_points": ["3-way matching failures", "manual reconciliation"],
        "metrics": {"error_reduction": "85%", "time_saved": "30 hours/week", "cost_savings": "$10,000/month"},
        "compliance": ["ISO 9001"],
    },
    {
        "project_name": "Construction AP - Multi-Level Approval Workflow",
        "scenario_text": (
            "Construction firm in Alberta processes 80 invoices daily with multiple "
            "vendor approvals required. Long approval delays and inconsistent workflows "
            "require structured approval automation with 72 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_capture", "routing", "multi_level_approval",
                      "validation", "payment"]
        },
        "industry": "construction",
        "province": "AB",
        "erp_type": "quickbooks",
        "state_count": 5,
        "threshold_amount": 15000,
        "sla_hours": 72,
        "approval_tiers": 2,
        "touchless_rate": 0.65,
        "complexity": "simple",
        "tags": ["construction", "approvals", "workflow", "vendors"],
        "document_types": ["invoice", "purchase_order"],
        "pain_points": ["long approval delays", "inconsistent workflows"],
        "metrics": {"error_reduction": "70%", "time_saved": "15 hours/week", "cost_savings": "$7,000/month"},
        "compliance": ["Local Building Codes"],
    },
    {
        "project_name": "Logistics AP - Freight Invoice Reconciliation",
        "scenario_text": (
            "Logistics company in British Columbia handling 150 freight invoices daily "
            "struggles with reconciliation mismatches between carrier invoices and "
            "contracts. Needs automated validation with 36 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "contract_match",
                      "validation", "approval"]
        },
        "industry": "logistics",
        "province": "BC",
        "erp_type": "netsuite",
        "state_count": 5,
        "threshold_amount": 8000,
        "sla_hours": 36,
        "approval_tiers": 1,
        "touchless_rate": 0.70,
        "complexity": "simple",
        "tags": ["logistics", "reconciliation", "freight", "netsuite"],
        "document_types": ["invoice", "contract"],
        "pain_points": ["reconciliation mismatches"],
        "metrics": {"error_reduction": "75%", "time_saved": "25 hours/week", "cost_savings": "$8,500/month"},
        "compliance": ["Transportation Regulations"],
    },
    {
        "project_name": "Healthcare AP - Compliance Validation",
        "scenario_text": (
            "Healthcare provider in Ontario processes 90 invoices daily with strict "
            "compliance requirements. Vendor validation and audit tracking needed "
            "with 24 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_capture", "validation", "compliance_check",
                      "approval", "audit_logging", "payment"]
        },
        "industry": "healthcare",
        "province": "ON",
        "erp_type": "oracle",
        "state_count": 6,
        "threshold_amount": 7000,
        "sla_hours": 24,
        "approval_tiers": 2,
        "touchless_rate": 0.78,
        "complexity": "medium",
        "tags": ["healthcare", "compliance", "audit", "validation"],
        "document_types": ["invoice", "compliance_report"],
        "pain_points": ["vendor validation", "audit tracking"],
        "metrics": {"error_reduction": "95%", "time_saved": "10 hours/week", "cost_savings": "$6,000/month"},
        "compliance": ["HIPAA", "SOX"],
    },
    {
        "project_name": "Retail AP - High Volume Processing",
        "scenario_text": (
            "Large retail chain in Quebec processes 400 invoices daily with tight "
            "processing deadlines. Requires automated ingestion and batch processing "
            "with 12 hour SLA."
        ),
        "workflow_json": {
            "steps": ["batch_ingestion", "ocr_extraction", "validation",
                      "batch_approval", "erp_sync"]
        },
        "industry": "retail",
        "province": "QC",
        "erp_type": "sap",
        "state_count": 5,
        "threshold_amount": 3000,
        "sla_hours": 12,
        "approval_tiers": 1,
        "touchless_rate": 0.88,
        "complexity": "simple",
        "tags": ["retail", "high-volume", "batch-processing", "sap"],
        "document_types": ["invoice", "receipt"],
        "pain_points": ["processing backlog", "tight SLA windows"],
        "metrics": {"error_reduction": "80%", "time_saved": "25 hours/week", "cost_savings": "$8,000/month"},
        "compliance": ["PCI DSS"],
    },
    {
        "project_name": "Manufacturing AP - Exception Handling",
        "scenario_text": (
            "Manufacturing SME in Manitoba processes 110 invoices daily with frequent "
            "exceptions in pricing and quantities. Needs automated exception routing "
            "and resolution with 48 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "matching",
                      "exception_routing", "approval", "payment"]
        },
        "industry": "manufacturing",
        "province": "MB",
        "erp_type": "netsuite",
        "state_count": 6,
        "threshold_amount": 9000,
        "sla_hours": 48,
        "approval_tiers": 2,
        "touchless_rate": 0.69,
        "complexity": "medium",
        "tags": ["manufacturing", "exceptions", "routing", "netsuite"],
        "document_types": ["invoice", "purchase_order"],
        "pain_points": ["pricing exceptions", "quantity discrepancies"],
        "metrics": {"error_reduction": "75%", "time_saved": "20 hours/week", "cost_savings": "$7,000/month"},
        "compliance": ["ISO 9001"],
    },
    {
        "project_name": "Construction AP - Paper Invoice Digitization",
        "scenario_text": (
            "Construction SME in Saskatchewan receives mostly paper invoices requiring "
            "digitization. Manual data entry causes delays. Needs OCR and structured "
            "validation with 72 hour SLA."
        ),
        "workflow_json": {
            "steps": ["document_scan", "ocr_extraction", "validation",
                      "approval", "erp_sync"]
        },
        "industry": "construction",
        "province": "SK",
        "erp_type": "quickbooks",
        "state_count": 5,
        "threshold_amount": 6000,
        "sla_hours": 72,
        "approval_tiers": 1,
        "touchless_rate": 0.60,
        "complexity": "simple",
        "tags": ["construction", "ocr", "paper-invoices", "digitization"],
        "document_types": ["invoice", "purchase_order"],
        "pain_points": ["paper invoice processing", "manual data entry"],
        "metrics": {"error_reduction": "85%", "time_saved": "15 hours/week", "cost_savings": "$5,000/month"},
        "compliance": ["Local Building Codes"],
    },
    {
        "project_name": "Logistics AP - Duplicate and Fraud Detection",
        "scenario_text": (
            "Logistics firm in Ontario processes 140 invoices daily and faces duplicate "
            "and potentially fraudulent invoices. Requires validation rules and anomaly "
            "detection with 36 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "duplicate_check",
                      "anomaly_detection", "approval"]
        },
        "industry": "logistics",
        "province": "ON",
        "erp_type": "sap",
        "state_count": 5,
        "threshold_amount": 12000,
        "sla_hours": 36,
        "approval_tiers": 2,
        "touchless_rate": 0.74,
        "complexity": "medium",
        "tags": ["logistics", "fraud-detection", "duplicates", "sap"],
        "document_types": ["invoice", "contract"],
        "pain_points": ["duplicate invoices", "fraud risk"],
        "metrics": {"error_reduction": "90%", "time_saved": "20 hours/week", "cost_savings": "$9,000/month"},
        "compliance": ["SOX"],
    },
    {
        "project_name": "Healthcare AP - Vendor Complexity Management",
        "scenario_text": (
            "Healthcare organization in Nova Scotia manages diverse vendors with varying "
            "invoice formats. Requires normalization and validation with 48 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "format_normalization", "validation",
                      "approval", "payment"]
        },
        "industry": "healthcare",
        "province": "NS",
        "erp_type": "oracle",
        "state_count": 5,
        "threshold_amount": 8000,
        "sla_hours": 48,
        "approval_tiers": 1,
        "touchless_rate": 0.67,
        "complexity": "simple",
        "tags": ["healthcare", "vendor-management", "normalization", "validation"],
        "document_types": ["invoice", "compliance_report"],
        "pain_points": ["vendor invoice format variation", "manual normalization"],
        "metrics": {"error_reduction": "80%", "time_saved": "12 hours/week", "cost_savings": "$6,000/month"},
        "compliance": ["HIPAA"],
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def embedding_text(row: dict) -> str:
    tags        = " ".join(row.get("tags") or [])
    pain        = " ".join(row.get("pain_points") or [])
    doc_types   = " ".join(row.get("document_types") or [])
    compliance  = " ".join(row.get("compliance") or [])
    return (
        f"{row.get('project_name', '')} | {row.get('scenario_text', '')} | "
        f"industry={row.get('industry', '')} province={row.get('province', '')} "
        f"erp={row.get('erp_type', '')} states={row.get('state_count', 0)} "
        f"threshold={row.get('threshold_amount', 0)} sla={row.get('sla_hours', 0)}h "
        f"tags={tags} pain={pain} docs={doc_types} compliance={compliance}"
    )


def get_embedding(text: str) -> list[float] | None:
    # Try /api/embeddings (Ollama ≤0.3)
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": EMBED_MODEL, "prompt": text},
            timeout=60,
        )
        r.raise_for_status()
        emb = (r.json() or {}).get("embedding")
        if isinstance(emb, list) and emb:
            return [float(x) for x in emb]
    except Exception:
        pass

    # Try /api/embed (Ollama ≥0.4)
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/embed",
            json={"model": EMBED_MODEL, "input": text},
            timeout=60,
        )
        r.raise_for_status()
        embs = (r.json() or {}).get("embeddings")
        if isinstance(embs, list) and embs and isinstance(embs[0], list):
            return [float(x) for x in embs[0]]
    except Exception:
        pass

    return None


def vector_literal(emb: list[float] | None) -> str | None:
    if not emb:
        return None
    return "[" + ",".join(f"{float(v):.8f}" for v in emb) + "]"


# ── Two-pass seeder ───────────────────────────────────────────────────────────

def pass_one_insert(conn) -> int:
    inserted = 0
    with conn.cursor() as cur:
        for row in SEED_RECORDS:
            cur.execute(
                "SELECT id FROM workflows_dataset WHERE tenant_id = %s AND project_name = %s LIMIT 1",
                (TENANT_ID, row["project_name"]),
            )
            if cur.fetchone():
                continue  # idempotent — skip existing

            cur.execute(
                """
                INSERT INTO workflows_dataset (
                  tenant_id, project_name, scenario_text,
                  industry, province, erp_type, complexity,
                  state_count, transition_count, approval_tiers,
                  threshold_amount, sla_hours, touchless_rate,
                  tags, document_types, pain_points, metrics, compliance_tags,
                  workflow_json, embedding,
                  type, source, is_sanitized, usage_count, version
                ) VALUES (
                  %s,%s,%s,
                  %s,%s,%s,%s,
                  %s,%s,%s,
                  %s,%s,%s,
                  %s,%s,%s,%s::jsonb,%s,
                  %s::jsonb,NULL,
                  'approval','manual',TRUE,0,'1.0.0'
                )
                """,
                (
                    TENANT_ID,
                    row["project_name"],
                    row["scenario_text"],
                    row["industry"],
                    row["province"],
                    row["erp_type"],
                    row.get("complexity", "medium"),
                    row.get("state_count"),
                    len(row["workflow_json"].get("steps", [])) - 1,
                    row.get("approval_tiers", 1),
                    row.get("threshold_amount"),
                    row.get("sla_hours"),
                    row.get("touchless_rate"),
                    row.get("tags"),
                    row.get("document_types"),
                    row.get("pain_points"),
                    json.dumps(row.get("metrics") or {}),
                    row.get("compliance"),
                    json.dumps(row["workflow_json"]),
                ),
            )
            inserted += 1

    conn.commit()
    return inserted


def pass_two_embed(conn) -> tuple[int, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, project_name, scenario_text, industry, province,
                   erp_type, state_count, touchless_rate, tags,
                   pain_points, document_types, compliance_tags, threshold_amount, sla_hours
            FROM workflows_dataset
            WHERE tenant_id = %s AND embedding IS NULL
            ORDER BY created_at
            """,
            (TENANT_ID,),
        )
        rows = cur.fetchall()

    total = len(rows)
    if total == 0:
        return 0, 0

    done = 0
    with conn.cursor() as cur:
        for idx, row in enumerate(rows, start=1):
            rec = {
                "project_name":    row[1],
                "scenario_text":   row[2],
                "industry":        row[3],
                "province":        row[4],
                "erp_type":        row[5],
                "state_count":     row[6],
                "touchless_rate":  row[7],
                "tags":            row[8] or [],
                "pain_points":     row[9] or [],
                "document_types":  row[10] or [],
                "compliance":      row[11] or [],
                "threshold_amount": row[12],
                "sla_hours":       row[13],
            }
            emb = get_embedding(embedding_text(rec))
            if emb:
                cur.execute(
                    "UPDATE workflows_dataset SET embedding = %s::vector WHERE id = %s",
                    (vector_literal(emb), row[0]),
                )
                done += 1
                conn.commit()
            print(f"  [{idx}/{total}] {'OK' if emb else 'NO-EMBED'} {row[1]}")

    return done, total


def print_status(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*), COUNT(embedding) FROM workflows_dataset WHERE tenant_id = %s",
            (TENANT_ID,),
        )
        total, embedded = cur.fetchone()
    print(f"Dataset status — total={total}  embedded={embedded}  ready={total>0 and total==embedded}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed AI Proviso workflows_dataset (10 records)")
    parser.add_argument("--no-embed", action="store_true", help="Pass 1 only — skip embedding generation")
    parser.add_argument("--status",   action="store_true", help="Print counts and exit")
    args = parser.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    try:
        if args.status:
            print_status(conn)
            return 0

        print(f"=== seed_dataset.py ===  model={EMBED_MODEL}  tenant={TENANT_ID}")

        n = pass_one_insert(conn)
        print(f"Pass 1: {n} records inserted ({len(SEED_RECORDS) - n} already existed)")

        if not args.no_embed:
            done, total = pass_two_embed(conn)
            print(f"Pass 2: {done}/{total} embeddings generated")
            if done < total:
                print(f"  {total - done} records missing embeddings — is Ollama running?")
                print(f"  Re-run to retry: python backend/seed_dataset.py")
        else:
            print("Pass 2 skipped (--no-embed)")

        print()
        print_status(conn)
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

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

    # ── Quebec records — priority market ──────────────────────────────────────

    {
        "project_name": "Quebec Aerospace Manufacturing - SAP AP Automation",
        "scenario_text": (
            "Aerospace manufacturer in Quebec using SAP S/4HANA processes 300 invoices "
            "daily with strict regulatory traceability requirements. Complex 3-tier approval "
            "for purchases over $50,000, mandatory compliance audit trail, and 24 hour SLA "
            "for critical parts suppliers."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "po_matching",
                      "compliance_check", "manager_approval", "director_approval",
                      "cfo_approval", "erp_sync", "audit_logging"]
        },
        "industry": "manufacturing",
        "province": "QC",
        "erp_type": "sap",
        "state_count": 9,
        "threshold_amount": 50000,
        "sla_hours": 24,
        "approval_tiers": 3,
        "touchless_rate": 0.88,
        "complexity": "complex",
        "tags": ["manufacturing", "aerospace", "sap", "3-tier", "compliance", "quebec"],
        "document_types": ["invoice", "purchase_order", "goods_receipt_note", "compliance_report"],
        "pain_points": ["regulatory traceability", "multi-tier approval delays", "audit gaps"],
        "metrics": {"error_reduction": "92%", "time_saved": "40 hours/week", "cost_savings": "$18,000/month"},
        "compliance": ["AS9100", "ISO 9001"],
    },
    {
        "project_name": "Quebec Professional Services - Dynamics 365 Invoice Control",
        "scenario_text": (
            "Montreal consulting firm with 150 employees using Microsoft Dynamics 365 "
            "processes 90 client-reimbursable invoices weekly. Mismatched expense codes "
            "and missing PO references delay client billing. Requires automated validation "
            "and approval routing with 48 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "expense_code_validation",
                      "po_reference_check", "manager_approval", "billing_sync"]
        },
        "industry": "professional_services",
        "province": "QC",
        "erp_type": "dynamics",
        "state_count": 5,
        "threshold_amount": 10000,
        "sla_hours": 48,
        "approval_tiers": 1,
        "touchless_rate": 0.71,
        "complexity": "simple",
        "tags": ["professional-services", "consulting", "dynamics", "expense-codes", "quebec"],
        "document_types": ["invoice", "expense_report", "purchase_order"],
        "pain_points": ["mismatched expense codes", "missing PO references", "billing delays"],
        "metrics": {"error_reduction": "78%", "time_saved": "18 hours/week", "cost_savings": "$6,500/month"},
        "compliance": ["CPA Canada"],
    },
    {
        "project_name": "Quebec Healthcare Network - Oracle AP Compliance",
        "scenario_text": (
            "Regional hospital network in Quebec City using Oracle Fusion processes "
            "200 medical supply invoices daily under strict provincial health authority "
            "procurement rules. Vendor accreditation checks and dual approval required "
            "for purchases over $25,000, with 12 hour SLA for critical medical supplies."
        ),
        "workflow_json": {
            "steps": ["invoice_capture", "vendor_accreditation_check", "validation",
                      "compliance_review", "ap_approval", "director_approval",
                      "audit_logging", "payment"]
        },
        "industry": "healthcare",
        "province": "QC",
        "erp_type": "oracle",
        "state_count": 8,
        "threshold_amount": 25000,
        "sla_hours": 12,
        "approval_tiers": 2,
        "touchless_rate": 0.82,
        "complexity": "complex",
        "tags": ["healthcare", "oracle", "compliance", "vendor-accreditation", "quebec"],
        "document_types": ["invoice", "compliance_report", "vendor_certificate"],
        "pain_points": ["vendor accreditation delays", "provincial procurement rules", "audit trail gaps"],
        "metrics": {"error_reduction": "91%", "time_saved": "28 hours/week", "cost_savings": "$14,000/month"},
        "compliance": ["LSSSS Quebec", "MSSS", "HIPAA"],
    },
    {
        "project_name": "Quebec Food Distribution - QuickBooks AP Automation",
        "scenario_text": (
            "Food distribution company serving Quebec grocery chains processes 250 "
            "supplier invoices daily using QuickBooks. High volume of short-dated goods "
            "invoices require same-day approval with automated price variance detection "
            "and 24 hour SLA to meet supplier payment terms."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "price_variance_check",
                      "approval", "payment", "erp_sync"]
        },
        "industry": "distribution",
        "province": "QC",
        "erp_type": "quickbooks",
        "state_count": 6,
        "threshold_amount": 5000,
        "sla_hours": 24,
        "approval_tiers": 1,
        "touchless_rate": 0.79,
        "complexity": "medium",
        "tags": ["distribution", "food", "quickbooks", "price-variance", "high-volume", "quebec"],
        "document_types": ["invoice", "delivery_note", "purchase_order"],
        "pain_points": ["price variance detection", "tight payment terms", "short-dated goods"],
        "metrics": {"error_reduction": "83%", "time_saved": "22 hours/week", "cost_savings": "$9,000/month"},
        "compliance": ["CFIA", "Food Safety"],
    },
    {
        "project_name": "Montreal Tech Scale-up - NetSuite AP Automation",
        "scenario_text": (
            "Montreal SaaS company with rapid growth using NetSuite processes 120 "
            "vendor invoices monthly across cloud infrastructure, software licences, "
            "and contractor services. Multiple cost centres and project codes require "
            "automated allocation with manager approval under 48 hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "cost_centre_allocation",
                      "project_code_validation", "manager_approval", "netsuite_sync"]
        },
        "industry": "technology",
        "province": "QC",
        "erp_type": "netsuite",
        "state_count": 5,
        "threshold_amount": 8000,
        "sla_hours": 48,
        "approval_tiers": 1,
        "touchless_rate": 0.74,
        "complexity": "simple",
        "tags": ["technology", "saas", "netsuite", "cost-centre", "contractors", "montreal"],
        "document_types": ["invoice", "contractor_agreement", "purchase_order"],
        "pain_points": ["cost centre misallocation", "contractor invoice validation", "project code errors"],
        "metrics": {"error_reduction": "82%", "time_saved": "14 hours/week", "cost_savings": "$5,500/month"},
        "compliance": ["SR&ED eligible"],
    },
    {
        "project_name": "Quebec Infrastructure Construction - SAP Multi-Site AP",
        "scenario_text": (
            "Large construction group managing highway and bridge projects across Quebec "
            "using SAP processes 400 subcontractor invoices weekly across 12 active sites. "
            "Progress billing milestones, holdback calculations, and CNESST compliance "
            "require structured workflow with 72 hour SLA and 3-tier approval above $100,000."
        ),
        "workflow_json": {
            "steps": ["invoice_capture", "site_validation", "progress_billing_check",
                      "holdback_calculation", "cnesst_compliance_check",
                      "project_manager_approval", "vp_approval", "cfo_approval", "payment"]
        },
        "industry": "construction",
        "province": "QC",
        "erp_type": "sap",
        "state_count": 9,
        "threshold_amount": 100000,
        "sla_hours": 72,
        "approval_tiers": 3,
        "touchless_rate": 0.76,
        "complexity": "complex",
        "tags": ["construction", "infrastructure", "sap", "progress-billing", "holdback", "cnesst", "quebec"],
        "document_types": ["invoice", "progress_claim", "purchase_order", "compliance_certificate"],
        "pain_points": ["progress billing disputes", "holdback miscalculation", "CNESST compliance", "multi-site coordination"],
        "metrics": {"error_reduction": "86%", "time_saved": "35 hours/week", "cost_savings": "$22,000/month"},
        "compliance": ["CNESST", "CCQ", "RBQ"],
    },

    # ── Batch 2 — +10 expansion (Session 5B) ─────────────────────────────────

    {
        "project_name": "Ontario Automotive Manufacturer - Oracle AP Control",
        "scenario_text": (
            "Tier-1 automotive supplier in Ontario using Oracle Fusion processes 350 invoices "
            "daily across 8 assembly plants. Just-in-time supply chain requires 4-hour SLA on "
            "critical parts invoices, dual approval over $25,000, and automated PO matching "
            "with GRN reconciliation to maintain production continuity."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "po_matching",
                      "grn_reconciliation", "ap_approval", "director_approval",
                      "erp_sync", "payment"]
        },
        "industry": "manufacturing", "province": "ON", "erp_type": "oracle",
        "state_count": 8, "threshold_amount": 25000, "sla_hours": 4,
        "approval_tiers": 2, "touchless_rate": 0.86, "complexity": "complex",
        "tags": ["manufacturing", "automotive", "oracle", "jit", "po-matching", "ontario"],
        "document_types": ["invoice", "purchase_order", "goods_receipt_note"],
        "pain_points": ["JIT supply chain delays", "GRN reconciliation failures", "multi-plant coordination"],
        "metrics": {"error_reduction": "88%", "time_saved": "32 hours/week", "cost_savings": "$15,000/month"},
        "compliance": ["IATF 16949", "ISO 9001"],
    },
    {
        "project_name": "BC Mining Operations - SAP AP Management",
        "scenario_text": (
            "Mining company in British Columbia with active copper and gold operations uses "
            "SAP S/4HANA to process 180 supplier invoices weekly. Remote site operations "
            "create complex approval chains with 3-tier sign-off for capital equipment over "
            "$100,000, environmental compliance checks, and 72-hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_capture", "ocr_extraction", "environmental_compliance_check",
                      "site_manager_approval", "vp_operations_approval", "cfo_approval",
                      "erp_sync"]
        },
        "industry": "manufacturing", "province": "BC", "erp_type": "sap",
        "state_count": 7, "threshold_amount": 100000, "sla_hours": 72,
        "approval_tiers": 3, "touchless_rate": 0.82, "complexity": "complex",
        "tags": ["mining", "sap", "bc", "environmental", "3-tier", "capital-equipment"],
        "document_types": ["invoice", "purchase_order", "environmental_certificate"],
        "pain_points": ["remote site approval delays", "environmental compliance tracking", "capital equipment validation"],
        "metrics": {"error_reduction": "84%", "time_saved": "28 hours/week", "cost_savings": "$20,000/month"},
        "compliance": ["BC Environmental Assessment", "ISO 14001"],
    },
    {
        "project_name": "Alberta Oil & Gas Services - Dynamics AP Workflow",
        "scenario_text": (
            "Oilfield services company in Alberta using Microsoft Dynamics 365 processes "
            "220 field service invoices weekly. Day-rate billing disputes and equipment "
            "rental reconciliation require automated validation with project-cost-centre "
            "allocation and dual approval for invoices over $15,000 with 48-hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "ocr_extraction", "day_rate_validation",
                      "cost_centre_allocation", "project_manager_approval",
                      "finance_approval", "erp_sync"]
        },
        "industry": "distribution", "province": "AB", "erp_type": "dynamics",
        "state_count": 7, "threshold_amount": 15000, "sla_hours": 48,
        "approval_tiers": 2, "touchless_rate": 0.73, "complexity": "medium",
        "tags": ["oil-gas", "dynamics", "alberta", "day-rate", "cost-centre", "field-services"],
        "document_types": ["invoice", "day_rate_ticket", "equipment_rental_agreement"],
        "pain_points": ["day-rate billing disputes", "cost centre misallocation", "equipment rental reconciliation"],
        "metrics": {"error_reduction": "79%", "time_saved": "22 hours/week", "cost_savings": "$11,000/month"},
        "compliance": ["CAPP", "Energy Safety Canada"],
    },
    {
        "project_name": "Ontario Tech Startup - NetSuite Automated AP",
        "scenario_text": (
            "Fast-growing SaaS company in Ontario uses NetSuite and processes 95 vendor "
            "invoices monthly across cloud infrastructure, SaaS licences, and contractor "
            "engagements. High proportion of subscription and recurring invoices require "
            "automated amortization matching with single approval under $10,000 and 24-hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "subscription_match", "amortization_check",
                      "approval", "netsuite_sync"]
        },
        "industry": "technology", "province": "ON", "erp_type": "netsuite",
        "state_count": 5, "threshold_amount": 10000, "sla_hours": 24,
        "approval_tiers": 1, "touchless_rate": 0.80, "complexity": "simple",
        "tags": ["saas", "netsuite", "ontario", "subscription", "amortization", "startup"],
        "document_types": ["invoice", "subscription_agreement", "contractor_agreement"],
        "pain_points": ["subscription invoice matching", "amortization schedule validation", "contractor vs employee classification"],
        "metrics": {"error_reduction": "85%", "time_saved": "16 hours/week", "cost_savings": "$6,000/month"},
        "compliance": ["SR&ED", "CRA contractor rules"],
    },
    {
        "project_name": "Quebec Retail Chain - Dynamics High-Volume AP",
        "scenario_text": (
            "Quebec grocery and pharmacy retail chain with 45 locations uses Microsoft Dynamics 365 "
            "and processes 600 supplier invoices daily. Promotional pricing reconciliation, "
            "category-based routing, and tight 8-hour SLA for perishables require automated "
            "matching with single approval under $5,000."
        ),
        "workflow_json": {
            "steps": ["batch_ingestion", "ocr_extraction", "promo_price_validation",
                      "category_routing", "approval", "dynamics_sync"]
        },
        "industry": "retail", "province": "QC", "erp_type": "dynamics",
        "state_count": 6, "threshold_amount": 5000, "sla_hours": 8,
        "approval_tiers": 1, "touchless_rate": 0.85, "complexity": "medium",
        "tags": ["retail", "grocery", "dynamics", "quebec", "high-volume", "promotional"],
        "document_types": ["invoice", "promotional_agreement", "receipt"],
        "pain_points": ["promotional price discrepancies", "high-volume processing", "perishables SLA pressure"],
        "metrics": {"error_reduction": "87%", "time_saved": "30 hours/week", "cost_savings": "$12,000/month"},
        "compliance": ["PCI DSS", "MAPAQ"],
    },
    {
        "project_name": "Manitoba Agricultural Co-op - QuickBooks AP",
        "scenario_text": (
            "Grain handling co-operative in Manitoba using QuickBooks processes 140 seasonal "
            "supplier invoices weekly for equipment, chemicals, and seed inputs. Seasonal volume "
            "spikes during planting and harvest require flexible approval routing with single "
            "sign-off under $8,000 and 48-hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "seasonal_classification", "validation",
                      "manager_approval", "quickbooks_sync"]
        },
        "industry": "distribution", "province": "MB", "erp_type": "quickbooks",
        "state_count": 5, "threshold_amount": 8000, "sla_hours": 48,
        "approval_tiers": 1, "touchless_rate": 0.68, "complexity": "simple",
        "tags": ["agriculture", "co-op", "quickbooks", "manitoba", "seasonal", "grain"],
        "document_types": ["invoice", "purchase_order", "delivery_note"],
        "pain_points": ["seasonal volume spikes", "supplier payment timing", "input cost classification"],
        "metrics": {"error_reduction": "77%", "time_saved": "18 hours/week", "cost_savings": "$7,500/month"},
        "compliance": ["CFIA", "Canadian Grain Commission"],
    },
    {
        "project_name": "Ontario Regional Hospital - SAP Healthcare AP",
        "scenario_text": (
            "Regional hospital authority in Ontario operating 3 hospital campuses uses SAP S/4HANA "
            "and processes 280 medical supply and capital invoices daily. MOHLTC procurement rules "
            "require vendor credentialing, dual approval for clinical equipment over $50,000, "
            "mandatory compliance review, and strict 8-hour SLA for patient-care supplies."
        ),
        "workflow_json": {
            "steps": ["invoice_capture", "vendor_credentialing", "mohltc_compliance_check",
                      "ap_approval", "clinical_director_approval",
                      "audit_logging", "sap_sync", "payment"]
        },
        "industry": "healthcare", "province": "ON", "erp_type": "sap",
        "state_count": 8, "threshold_amount": 50000, "sla_hours": 8,
        "approval_tiers": 2, "touchless_rate": 0.83, "complexity": "complex",
        "tags": ["healthcare", "hospital", "sap", "ontario", "mohltc", "compliance", "clinical"],
        "document_types": ["invoice", "vendor_certificate", "purchase_order", "compliance_report"],
        "pain_points": ["MOHLTC procurement compliance", "vendor credentialing delays", "multi-campus routing"],
        "metrics": {"error_reduction": "90%", "time_saved": "35 hours/week", "cost_savings": "$16,000/month"},
        "compliance": ["MOHLTC", "PHIPA", "ISO 13485"],
    },
    {
        "project_name": "BC Professional Services Firm - QuickBooks AP",
        "scenario_text": (
            "Mid-size management consulting firm in Vancouver using QuickBooks processes "
            "75 client disbursement and vendor invoices weekly. Complex billable vs "
            "non-billable classification and client matter code allocation require "
            "manager approval under $7,500 with 48-hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "billable_classification", "matter_code_allocation",
                      "manager_approval", "quickbooks_sync"]
        },
        "industry": "professional_services", "province": "BC", "erp_type": "quickbooks",
        "state_count": 5, "threshold_amount": 7500, "sla_hours": 48,
        "approval_tiers": 1, "touchless_rate": 0.71, "complexity": "simple",
        "tags": ["consulting", "professional-services", "quickbooks", "bc", "billable", "matter-codes"],
        "document_types": ["invoice", "expense_report", "contractor_agreement"],
        "pain_points": ["billable vs non-billable classification errors", "client matter code misallocation"],
        "metrics": {"error_reduction": "80%", "time_saved": "14 hours/week", "cost_savings": "$5,500/month"},
        "compliance": ["CPA Canada", "Law Society (referral clients)"],
    },
    {
        "project_name": "Alberta Oilsands Construction - NetSuite Complex AP",
        "scenario_text": (
            "Oilsands infrastructure contractor in Fort McMurray using NetSuite processes "
            "300 subcontractor and materials invoices weekly on long-duration megaprojects. "
            "Certified payroll compliance, lien holdback at 10%, and ABSA pressure vessel "
            "certification tracking require 3-tier approval over $75,000 with 72-hour SLA."
        ),
        "workflow_json": {
            "steps": ["invoice_capture", "certified_payroll_check", "lien_holdback_calculation",
                      "absa_cert_validation", "project_manager_approval",
                      "vp_approval", "cfo_approval", "payment"]
        },
        "industry": "construction", "province": "AB", "erp_type": "netsuite",
        "state_count": 8, "threshold_amount": 75000, "sla_hours": 72,
        "approval_tiers": 3, "touchless_rate": 0.78, "complexity": "complex",
        "tags": ["construction", "oilsands", "netsuite", "alberta", "lien-holdback", "certified-payroll"],
        "document_types": ["invoice", "certified_payroll", "lien_waiver", "absa_certificate"],
        "pain_points": ["lien holdback miscalculation", "certified payroll compliance", "ABSA certificate tracking"],
        "metrics": {"error_reduction": "85%", "time_saved": "30 hours/week", "cost_savings": "$18,000/month"},
        "compliance": ["AB Employment Standards", "ABSA", "Builders Lien Act"],
    },
    {
        "project_name": "Ontario Law Firm - Dynamics Disbursement AP",

        "scenario_text": (
            "Bay Street law firm in Toronto using Microsoft Dynamics 365 processes 110 "
            "disbursement invoices and court-filing fees weekly. Trust accounting rules "
            "require separation of client disbursements from firm expenses, partner approval "
            "for invoices over $5,000, and 24-hour SLA to meet court filing deadlines."
        ),
        "workflow_json": {
            "steps": ["invoice_ingestion", "trust_account_classification",
                      "client_matter_validation", "partner_approval",
                      "dynamics_sync", "trust_ledger_update"]
        },
        "industry": "professional_services", "province": "ON", "erp_type": "dynamics",
        "state_count": 6, "threshold_amount": 5000, "sla_hours": 24,
        "approval_tiers": 1, "touchless_rate": 0.74, "complexity": "medium",
        "tags": ["legal", "law-firm", "dynamics", "ontario", "trust-accounting", "disbursements"],
        "document_types": ["invoice", "court_filing_receipt", "disbursement_voucher"],
        "pain_points": ["trust vs general account misclassification", "court deadline pressure", "client matter code errors"],
        "metrics": {"error_reduction": "82%", "time_saved": "15 hours/week", "cost_savings": "$7,000/month"},
        "compliance": ["Law Society of Ontario", "CPA Canada trust rules"],
    },

    # ── Batch 3 — +19 expansion to reach 50 target (Session 5B) ─────────────

    {
        "project_name": "Saskatchewan Potash Mining - Dynamics AP Control",
        "scenario_text": (
            "Potash mining company in Saskatchewan using Microsoft Dynamics 365 processes "
            "160 supplier invoices weekly for reagents, equipment parts, and contractor services. "
            "Capital project invoices over $20,000 require dual approval and production continuity "
            "tracking with 48-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "ocr_extraction", "capex_classification",
                                    "production_validation", "ap_approval", "vp_approval", "dynamics_sync"]},
        "industry": "manufacturing", "province": "SK", "erp_type": "dynamics",
        "state_count": 7, "threshold_amount": 20000, "sla_hours": 48,
        "approval_tiers": 2, "touchless_rate": 0.77, "complexity": "medium",
        "tags": ["mining", "potash", "dynamics", "saskatchewan", "capex"],
        "document_types": ["invoice", "purchase_order", "maintenance_record"],
        "pain_points": ["capital vs operational expense classification", "production downtime invoices"],
        "metrics": {"error_reduction": "80%", "time_saved": "20 hours/week", "cost_savings": "$9,500/month"},
        "compliance": ["Saskatchewan Employment Act", "MSHA"],
    },
    {
        "project_name": "Nova Scotia Accounting Firm - QuickBooks Client AP",
        "scenario_text": (
            "Regional accounting and advisory firm in Halifax using QuickBooks Online manages "
            "AP for 12 SME clients on an outsourced basis. Mixed ERP environments and client "
            "billing code isolation require automated segregation and single approval under "
            "$5,000 per client with 72-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "client_segregation", "code_validation",
                                    "approval", "quickbooks_sync"]},
        "industry": "professional_services", "province": "NS", "erp_type": "quickbooks",
        "state_count": 5, "threshold_amount": 5000, "sla_hours": 72,
        "approval_tiers": 1, "touchless_rate": 0.68, "complexity": "simple",
        "tags": ["accounting", "outsourced-ap", "quickbooks", "nova-scotia", "multi-client"],
        "document_types": ["invoice", "client_billing_code", "expense_report"],
        "pain_points": ["multi-client code segregation", "mixed ERP environments"],
        "metrics": {"error_reduction": "78%", "time_saved": "16 hours/week", "cost_savings": "$5,000/month"},
        "compliance": ["CPA Nova Scotia", "CRA"],
    },
    {
        "project_name": "New Brunswick Construction Group - Dynamics AP",
        "scenario_text": (
            "General contracting company in Fredericton using Microsoft Dynamics 365 processes "
            "90 subcontractor and materials invoices weekly on institutional and residential "
            "projects. Statutory holdback at 10%, WHSCC compliance certification, and "
            "dual approval over $25,000 with 72-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_capture", "holdback_calculation", "whscc_compliance_check",
                                    "project_manager_approval", "finance_approval", "payment"]},
        "industry": "construction", "province": "NB", "erp_type": "dynamics",
        "state_count": 6, "threshold_amount": 25000, "sla_hours": 72,
        "approval_tiers": 2, "touchless_rate": 0.71, "complexity": "medium",
        "tags": ["construction", "dynamics", "new-brunswick", "holdback", "whscc"],
        "document_types": ["invoice", "progress_claim", "whscc_certificate"],
        "pain_points": ["statutory holdback tracking", "WHSCC certificate validation"],
        "metrics": {"error_reduction": "77%", "time_saved": "18 hours/week", "cost_savings": "$8,000/month"},
        "compliance": ["NB Construction Act", "WHSCC"],
    },
    {
        "project_name": "Ontario Financial Services Firm - SAP AP Compliance",
        "scenario_text": (
            "Mid-size asset management firm in Toronto regulated under OSFI uses SAP S/4HANA "
            "and processes 130 vendor and custodian invoices monthly. OSFI audit requirements, "
            "fund expense allocation, and 3-tier approval for invoices over $50,000 require "
            "strict compliance tracking with 24-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "fund_expense_allocation", "osfi_compliance_check",
                                    "manager_approval", "compliance_officer_approval", "cfo_approval",
                                    "audit_logging", "sap_sync"]},
        "industry": "professional_services", "province": "ON", "erp_type": "sap",
        "state_count": 8, "threshold_amount": 50000, "sla_hours": 24,
        "approval_tiers": 3, "touchless_rate": 0.85, "complexity": "complex",
        "tags": ["financial-services", "asset-management", "sap", "ontario", "osfi", "compliance"],
        "document_types": ["invoice", "fund_allocation_slip", "compliance_report"],
        "pain_points": ["fund expense misallocation", "OSFI audit trail gaps", "multi-level approval delays"],
        "metrics": {"error_reduction": "91%", "time_saved": "24 hours/week", "cost_savings": "$18,000/month"},
        "compliance": ["OSFI", "NI 81-102", "AML"],
    },
    {
        "project_name": "Quebec Government Agency - Oracle Public Sector AP",
        "scenario_text": (
            "Quebec provincial government agency using Oracle Fusion processes 200 contractor "
            "and supplier invoices monthly under Act Respecting Contracting by Public Bodies. "
            "Mandatory compliance review, Hydro-Quebec utility routing, dual approval over "
            "$25,000, and 30-day statutory payment deadline with 24-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_capture", "rcpba_compliance_check", "utility_routing",
                                    "department_approval", "director_approval",
                                    "audit_logging", "oracle_sync", "payment"]},
        "industry": "professional_services", "province": "QC", "erp_type": "oracle",
        "state_count": 8, "threshold_amount": 25000, "sla_hours": 24,
        "approval_tiers": 2, "touchless_rate": 0.82, "complexity": "complex",
        "tags": ["government", "public-sector", "oracle", "quebec", "rcpba", "compliance"],
        "document_types": ["invoice", "contract", "compliance_attestation"],
        "pain_points": ["RCPBA compliance documentation", "30-day statutory payment tracking"],
        "metrics": {"error_reduction": "88%", "time_saved": "28 hours/week", "cost_savings": "$14,000/month"},
        "compliance": ["RCPBA", "Loi sur la gestion des finances publiques", "CAG"],
    },
    {
        "project_name": "BC University - Dynamics Education AP",
        "scenario_text": (
            "Mid-size university in Vancouver using Microsoft Dynamics 365 processes 300 "
            "vendor invoices weekly across research grants, facilities, and IT procurement. "
            "Research grant fund segregation, tri-agency compliance (NSERC/SSHRC/CIHR), "
            "dual approval over $10,000, and 48-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "grant_fund_segregation",
                                    "tri_agency_compliance_check", "department_approval",
                                    "research_finance_approval", "dynamics_sync"]},
        "industry": "professional_services", "province": "BC", "erp_type": "dynamics",
        "state_count": 6, "threshold_amount": 10000, "sla_hours": 48,
        "approval_tiers": 2, "touchless_rate": 0.76, "complexity": "medium",
        "tags": ["education", "university", "dynamics", "bc", "tri-agency", "research-grants"],
        "document_types": ["invoice", "grant_allocation", "purchase_order"],
        "pain_points": ["research grant fund misallocation", "tri-agency compliance"],
        "metrics": {"error_reduction": "83%", "time_saved": "22 hours/week", "cost_savings": "$10,000/month"},
        "compliance": ["NSERC/SSHRC/CIHR Tri-Agency", "BC FOIPPA"],
    },
    {
        "project_name": "Alberta Investment Firm - NetSuite Portfolio AP",
        "scenario_text": (
            "Private equity investment firm in Calgary using NetSuite manages AP across "
            "7 portfolio companies. Intercompany transactions, management fee invoices, and "
            "due diligence expenses require fund-level approval with single sign-off under "
            "$15,000 and 48-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "fund_classification",
                                    "intercompany_validation", "partner_approval", "netsuite_sync"]},
        "industry": "professional_services", "province": "AB", "erp_type": "netsuite",
        "state_count": 5, "threshold_amount": 15000, "sla_hours": 48,
        "approval_tiers": 1, "touchless_rate": 0.78, "complexity": "simple",
        "tags": ["private-equity", "investment", "netsuite", "alberta", "intercompany", "portfolio"],
        "document_types": ["invoice", "management_fee_agreement", "intercompany_memo"],
        "pain_points": ["intercompany transaction misclassification", "fund-level segregation"],
        "metrics": {"error_reduction": "82%", "time_saved": "15 hours/week", "cost_savings": "$8,000/month"},
        "compliance": ["Alberta Securities Commission", "IFRS 10"],
    },
    {
        "project_name": "Ontario Grocery Retailer - Dynamics Vendor AP",
        "scenario_text": (
            "Independent grocery retailer in Ontario with 12 locations uses Microsoft Dynamics 365 "
            "and processes 400 vendor invoices weekly. Flyer promotion validation, seasonal vendor "
            "contracts, and shrink claims require automated reconciliation with single approval "
            "under $3,000 and 24-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "promo_contract_match",
                                    "shrink_claim_validation", "approval", "dynamics_sync"]},
        "industry": "retail", "province": "ON", "erp_type": "dynamics",
        "state_count": 5, "threshold_amount": 3000, "sla_hours": 24,
        "approval_tiers": 1, "touchless_rate": 0.82, "complexity": "simple",
        "tags": ["retail", "grocery", "dynamics", "ontario", "promo", "vendor-contracts"],
        "document_types": ["invoice", "promotional_agreement", "shrink_claim"],
        "pain_points": ["promo price discrepancies", "shrink claim disputes", "seasonal contract validation"],
        "metrics": {"error_reduction": "84%", "time_saved": "20 hours/week", "cost_savings": "$7,500/month"},
        "compliance": ["CFIA", "Ontario Food Safety"],
    },
    {
        "project_name": "Quebec AI Research Lab - NetSuite R&D AP",
        "scenario_text": (
            "AI research company in Montreal using NetSuite processes 85 vendor invoices "
            "monthly for GPU compute, cloud services, and academic collaboration fees. "
            "SR&ED expense tagging, compute cost centre allocation, and dual approval over "
            "$20,000 with 48-hour SLA to maintain research velocity."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "sred_tagging", "compute_cost_allocation",
                                    "pi_approval", "finance_approval", "netsuite_sync"]},
        "industry": "technology", "province": "QC", "erp_type": "netsuite",
        "state_count": 6, "threshold_amount": 20000, "sla_hours": 48,
        "approval_tiers": 2, "touchless_rate": 0.79, "complexity": "medium",
        "tags": ["ai", "research", "netsuite", "quebec", "sred", "compute", "academic"],
        "document_types": ["invoice", "compute_invoice", "collaboration_agreement"],
        "pain_points": ["SR&ED expense classification", "compute cost attribution", "academic collaboration billing"],
        "metrics": {"error_reduction": "83%", "time_saved": "12 hours/week", "cost_savings": "$6,000/month"},
        "compliance": ["SR&ED CRA", "NSERC", "CIFAR"],
    },
    {
        "project_name": "Ontario Grain Farm - NetSuite Agricultural AP",
        "scenario_text": (
            "Large-scale grain farming operation in Ontario using NetSuite processes 120 "
            "input supplier invoices seasonally for seed, fertilizer, and equipment. "
            "Input cost classification for tax purposes, single approval under $10,000, "
            "and 72-hour SLA during planting season."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "input_cost_classification",
                                    "approval", "netsuite_sync"]},
        "industry": "distribution", "province": "ON", "erp_type": "netsuite",
        "state_count": 4, "threshold_amount": 10000, "sla_hours": 72,
        "approval_tiers": 1, "touchless_rate": 0.72, "complexity": "simple",
        "tags": ["agriculture", "grain", "netsuite", "ontario", "seasonal", "input-costs"],
        "document_types": ["invoice", "purchase_order", "delivery_slip"],
        "pain_points": ["seasonal volume spikes", "CRA input cost classification"],
        "metrics": {"error_reduction": "75%", "time_saved": "14 hours/week", "cost_savings": "$5,500/month"},
        "compliance": ["CFIA", "AgriInvest CRA"],
    },
    {
        "project_name": "BC Community Health Clinic - QuickBooks AP",
        "scenario_text": (
            "Community health clinic in Kelowna using QuickBooks Online processes 60 vendor "
            "and supplier invoices monthly for medical supplies and facility services. "
            "HIBC billing reconciliation and single approval under $5,000 with 48-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "hibc_reconciliation",
                                    "validation", "approval", "quickbooks_sync"]},
        "industry": "healthcare", "province": "BC", "erp_type": "quickbooks",
        "state_count": 5, "threshold_amount": 5000, "sla_hours": 48,
        "approval_tiers": 1, "touchless_rate": 0.65, "complexity": "simple",
        "tags": ["healthcare", "community-clinic", "quickbooks", "bc", "hibc"],
        "document_types": ["invoice", "hibc_billing_slip", "supply_receipt"],
        "pain_points": ["HIBC billing reconciliation", "medical supply invoice validation"],
        "metrics": {"error_reduction": "76%", "time_saved": "10 hours/week", "cost_savings": "$4,000/month"},
        "compliance": ["HIBC", "PHIPA BC", "College of Physicians"],
    },
    {
        "project_name": "Alberta Food Manufacturing - Dynamics AP",
        "scenario_text": (
            "Food processing company in Lethbridge using Microsoft Dynamics 365 processes "
            "190 raw material and packaging invoices weekly. HACCP ingredient traceability, "
            "lot-number matching to purchase orders, and dual approval over $15,000 with "
            "24-hour SLA to maintain production schedule."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "ocr_extraction", "lot_number_validation",
                                    "haccp_traceability_check", "ap_approval", "director_approval",
                                    "dynamics_sync"]},
        "industry": "manufacturing", "province": "AB", "erp_type": "dynamics",
        "state_count": 7, "threshold_amount": 15000, "sla_hours": 24,
        "approval_tiers": 2, "touchless_rate": 0.80, "complexity": "medium",
        "tags": ["food-manufacturing", "dynamics", "alberta", "haccp", "lot-tracking"],
        "document_types": ["invoice", "purchase_order", "lot_certificate"],
        "pain_points": ["HACCP ingredient traceability", "lot-number PO mismatches"],
        "metrics": {"error_reduction": "83%", "time_saved": "22 hours/week", "cost_savings": "$10,000/month"},
        "compliance": ["HACCP", "CFIA Safe Food for Canadians", "ISO 22000"],
    },
    {
        "project_name": "Ontario Distribution Centre - Oracle Logistics AP",
        "scenario_text": (
            "National consumer goods distribution centre in Mississauga using Oracle Fusion "
            "processes 500 carrier and third-party logistics invoices weekly. Freight rate "
            "auditing against contracts, fuel surcharge reconciliation, and dual approval for "
            "invoices over $10,000 with 12-hour SLA to meet carrier payment terms."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "freight_rate_audit",
                                    "fuel_surcharge_reconciliation", "contract_match",
                                    "ap_approval", "logistics_director_approval", "oracle_sync"]},
        "industry": "distribution", "province": "ON", "erp_type": "oracle",
        "state_count": 7, "threshold_amount": 10000, "sla_hours": 12,
        "approval_tiers": 2, "touchless_rate": 0.84, "complexity": "medium",
        "tags": ["distribution", "logistics", "oracle", "ontario", "freight-audit", "carrier"],
        "document_types": ["invoice", "carrier_contract", "rate_sheet"],
        "pain_points": ["freight rate audit discrepancies", "fuel surcharge disputes"],
        "metrics": {"error_reduction": "86%", "time_saved": "28 hours/week", "cost_savings": "$13,000/month"},
        "compliance": ["Canadian Motor Vehicle Safety Act", "Transport Canada"],
    },
    {
        "project_name": "Quebec Engineering Consultancy - NetSuite Project AP",
        "scenario_text": (
            "Civil engineering consultancy in Quebec City using NetSuite processes 100 "
            "subcontractor and equipment rental invoices monthly across active infrastructure "
            "projects. OIQ professional fees, project-code allocation, and dual approval "
            "over $20,000 with 48-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "oiq_compliance_check",
                                    "project_code_allocation", "project_manager_approval",
                                    "finance_approval", "netsuite_sync"]},
        "industry": "professional_services", "province": "QC", "erp_type": "netsuite",
        "state_count": 6, "threshold_amount": 20000, "sla_hours": 48,
        "approval_tiers": 2, "touchless_rate": 0.73, "complexity": "medium",
        "tags": ["engineering", "consulting", "netsuite", "quebec", "oiq", "infrastructure"],
        "document_types": ["invoice", "professional_fee_schedule", "project_contract"],
        "pain_points": ["OIQ compliance documentation", "project code misallocation"],
        "metrics": {"error_reduction": "79%", "time_saved": "18 hours/week", "cost_savings": "$8,500/month"},
        "compliance": ["OIQ", "BNQ standards", "CNESST"],
    },
    {
        "project_name": "BC Technology Firm - SAP Enterprise AP",
        "scenario_text": (
            "Enterprise software company in Vancouver using SAP S/4HANA processes 150 "
            "vendor invoices monthly across global cloud, reseller, and professional service "
            "agreements. Multi-currency processing, reseller margin validation, and 3-tier "
            "approval over $75,000 with 24-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "multi_currency_conversion",
                                    "reseller_margin_validation", "manager_approval",
                                    "vp_approval", "cfo_approval", "sap_sync"]},
        "industry": "technology", "province": "BC", "erp_type": "sap",
        "state_count": 7, "threshold_amount": 75000, "sla_hours": 24,
        "approval_tiers": 3, "touchless_rate": 0.81, "complexity": "complex",
        "tags": ["technology", "software", "sap", "bc", "multi-currency", "reseller", "enterprise"],
        "document_types": ["invoice", "reseller_agreement", "purchase_order"],
        "pain_points": ["multi-currency reconciliation", "reseller margin disputes", "global vendor complexity"],
        "metrics": {"error_reduction": "85%", "time_saved": "20 hours/week", "cost_savings": "$12,000/month"},
        "compliance": ["IFRS", "PCI DSS", "SOX"],
    },
    {
        "project_name": "Manitoba Healthcare Authority - Dynamics Regional AP",
        "scenario_text": (
            "Regional health authority in Winnipeg using Microsoft Dynamics 365 coordinates "
            "AP across 6 community hospitals and clinics, processing 240 invoices weekly. "
            "Shared services model with facility-level routing, dual approval for medical "
            "equipment over $15,000, and 24-hour SLA for patient-care supplies."
        ),
        "workflow_json": {"steps": ["invoice_capture", "facility_routing", "vendor_validation",
                                    "ap_approval", "clinical_director_approval",
                                    "audit_logging", "dynamics_sync"]},
        "industry": "healthcare", "province": "MB", "erp_type": "dynamics",
        "state_count": 7, "threshold_amount": 15000, "sla_hours": 24,
        "approval_tiers": 2, "touchless_rate": 0.79, "complexity": "medium",
        "tags": ["healthcare", "regional-health", "dynamics", "manitoba", "shared-services"],
        "document_types": ["invoice", "purchase_order", "vendor_certificate"],
        "pain_points": ["multi-facility routing complexity", "shared services reconciliation"],
        "metrics": {"error_reduction": "85%", "time_saved": "30 hours/week", "cost_savings": "$13,000/month"},
        "compliance": ["PHIA Manitoba", "WRHA standards", "CCHSA"],
    },
    {
        "project_name": "Saskatchewan Distribution Co - QuickBooks AP",
        "scenario_text": (
            "General merchandise distributor in Regina using QuickBooks Online processes "
            "110 supplier invoices weekly for retail resale goods. Volume rebate tracking, "
            "price protection claims, and single approval under $8,000 with 48-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "rebate_tracking",
                                    "price_protection_validation", "approval", "quickbooks_sync"]},
        "industry": "distribution", "province": "SK", "erp_type": "quickbooks",
        "state_count": 5, "threshold_amount": 8000, "sla_hours": 48,
        "approval_tiers": 1, "touchless_rate": 0.69, "complexity": "simple",
        "tags": ["distribution", "merchandise", "quickbooks", "saskatchewan", "rebates"],
        "document_types": ["invoice", "rebate_agreement", "price_protection_claim"],
        "pain_points": ["volume rebate miscalculation", "price protection disputes"],
        "metrics": {"error_reduction": "76%", "time_saved": "14 hours/week", "cost_savings": "$5,500/month"},
        "compliance": ["Competition Bureau Canada", "CRA GST/HST"],
    },
    {
        "project_name": "Nova Scotia Retail Co-op - QuickBooks Multi-Store AP",
        "scenario_text": (
            "Consumer co-operative retailer in Nova Scotia with 8 locations uses QuickBooks "
            "Online and processes 180 vendor invoices weekly. Member patronage allocation, "
            "produce freshness routing, and single approval under $4,000 with 36-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "store_routing", "patronage_allocation",
                                    "approval", "quickbooks_sync"]},
        "industry": "retail", "province": "NS", "erp_type": "quickbooks",
        "state_count": 5, "threshold_amount": 4000, "sla_hours": 36,
        "approval_tiers": 1, "touchless_rate": 0.66, "complexity": "simple",
        "tags": ["retail", "co-op", "quickbooks", "nova-scotia", "multi-store", "patronage"],
        "document_types": ["invoice", "purchase_order", "produce_delivery_note"],
        "pain_points": ["patronage allocation accuracy", "multi-store routing delays"],
        "metrics": {"error_reduction": "74%", "time_saved": "16 hours/week", "cost_savings": "$5,000/month"},
        "compliance": ["Co-operatives Act NS", "CFIA"],
    },
    {
        "project_name": "Ontario Small Contractor - QuickBooks Residential AP",
        "scenario_text": (
            "Residential renovation contractor in Ottawa using QuickBooks Online processes "
            "55 subcontractor and materials invoices weekly. Lien waiver tracking, "
            "homeowner billing markup, and single approval under $5,000 with 72-hour SLA."
        ),
        "workflow_json": {"steps": ["invoice_ingestion", "lien_waiver_check",
                                    "markup_calculation", "approval", "quickbooks_sync"]},
        "industry": "construction", "province": "ON", "erp_type": "quickbooks",
        "state_count": 5, "threshold_amount": 5000, "sla_hours": 72,
        "approval_tiers": 1, "touchless_rate": 0.64, "complexity": "simple",
        "tags": ["construction", "residential", "quickbooks", "ontario", "lien-waiver", "renovation"],
        "document_types": ["invoice", "lien_waiver", "material_receipt"],
        "pain_points": ["lien waiver collection", "markup billing accuracy"],
        "metrics": {"error_reduction": "73%", "time_saved": "12 hours/week", "cost_savings": "$4,500/month"},
        "compliance": ["Construction Act Ontario", "WSIB"],
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

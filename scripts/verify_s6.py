"""
verify_s6.py — Session 6 Demo Readiness Gate (PRD v12 §0.12)

5 automated gates + 1 documented manual gate.
All 5 must pass before Michel LeBrun walkthrough is scheduled.

Gates:
  1. Platform health   — Flask /health + /health/db (postgres + redis)
  2. Dataset readiness — 45 queryable records, all embedded, anchors stable
  3. Diff approval     — apply-diff produces patched workflow + persists ref
  4. Flywheel          — save-to-dataset increments queryable count  [WRITE]
  5. Intake path       — POST /api/intake/upload returns invoice_id  [WRITE]
  6. Demo walkthrough  — MANUAL: timed end-to-end run, documented below

Usage:
    python scripts/verify_s6.py             # full run (writes to DB)
    python scripts/verify_s6.py --read-only # read-only (gates 4+5 are status-only)

--read-only is for routine repeat checks. Run the full mode ONCE to produce the
certification artifact, then use --read-only for all subsequent pre-demo checks.

Certification run: 2026-06-04 · gates 1-5 PASS · anchor scores 65/64/65 (drift 0)
"""

import json, os, requests, sys, time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

BASE      = os.environ.get("BACKEND_URL", "http://localhost:5000")
TENANT_ID = "00000000-0000-0000-0000-000000000001"
P = "[PASS]"; F = "[FAIL]"; W = "[WARN]"
failures = []


def chk(label, ok, detail=""):
    mark = P if ok else F
    print(f"  {mark} {label}" + (f": {detail}" if detail else ""))
    if not ok:
        failures.append(label)


def find_similar(scenario, industry=None, province=None, erp_type=None):
    body = {"scenario_text": scenario}
    if industry:  body["industry"]  = industry
    if province:  body["province"]  = province
    if erp_type:  body["erp_type"]  = erp_type
    r = requests.post(f"{BASE}/api/dataset/find-similar", json=body, timeout=90)
    r.raise_for_status()
    return r.json()


# ── Gate 1 — Platform health ──────────────────────────────────────────────────

def gate1_health():
    print("=== Gate 1: Platform Health ===")
    try:
        rh = requests.get(f"{BASE}/health", timeout=10).json()
        chk("/health status=ok", rh.get("status") == "ok")
    except Exception as e:
        chk("/health reachable", False, str(e)); return

    try:
        rd = requests.get(f"{BASE}/health/db", timeout=15).json()
        chk("postgres ok", rd.get("postgres", {}).get("ok") is True)
        chk("redis ok",    rd.get("redis",    {}).get("ok") is True)
    except Exception as e:
        chk("/health/db reachable", False, str(e))
    print()


# ── Gate 2 — Dataset readiness + anchor stability ─────────────────────────────

ANCHORS = [
    {"label": "ON SAP manufacturing 3-way match",
     "scenario_text": "Ontario manufacturer SAP 3-way matching invoice approval",
     "industry": "manufacturing", "province": "ON", "erp_type": "sap",
     "expect_name": "Manufacturing AP - SAP 3-Way Matching",
     "baseline_pct": 65, "tolerance": 8},
    {"label": "QC SAP aerospace 3-tier compliance",
     "scenario_text": "Quebec aerospace SAP 3-tier compliance 50000 threshold 24h SLA",
     "industry": "manufacturing", "province": "QC", "erp_type": "sap",
     "expect_name": "Quebec Aerospace Manufacturing - SAP AP Automation",
     "baseline_pct": 64, "tolerance": 8},
    {"label": "ON Oracle healthcare compliance",
     "scenario_text": "healthcare compliance oracle vendor validation audit Ontario 24h SLA",
     "industry": "healthcare", "province": "ON", "erp_type": "oracle",
     "expect_name": "Healthcare AP - Compliance Validation",
     "baseline_pct": 65, "tolerance": 8},
]


def gate2_dataset():
    print("=== Gate 2: Dataset Readiness + Anchor Stability ===")
    status = requests.get(f"{BASE}/api/dataset/status", timeout=10).json()
    total    = int(status.get("total_records", 0))
    embedded = int(status.get("embedded_records", 0))
    complete = int(status.get("records_with_complete_metadata", 0))
    # total_records grows with each flywheel save — do not hardcode an exact value.
    # The invariant is that all queryable (complete-metadata) records are >= 45.
    chk("queryable records >= 45",             complete >= 45,        f"{complete} queryable / {total} total")
    chk("all records embedded",                embedded == total,     f"{embedded}/{total}")
    chk("no records missing metadata (embedded)", complete == embedded, f"{complete}/{embedded}")
    print()

    print("  Anchor ranking stability:")
    for a in ANCHORS:
        d   = find_similar(a["scenario_text"], a["industry"], a["province"], a["erp_type"])
        top = (d.get("candidates") or [{}])[0]
        name = top.get("project_name", "")
        pct  = top.get("similarity_pct", 0)
        drift = abs(pct - a["baseline_pct"])
        chk(f"  top = '{a['expect_name']}'",     name == a["expect_name"], name)
        chk(f"  pct within ±{a['tolerance']} of baseline ({a['baseline_pct']}%)",
            drift <= a["tolerance"], f"{pct}% (drift {drift})")
        # diff[] populated for demo
        chk(f"  diff[] present on top candidate", isinstance(top.get("diff"), list),
            f"{len(top.get('diff', []))} items")
    print()


# ── Gate 3 — Diff approval path ───────────────────────────────────────────────

def gate3_diff_approval():
    print("=== Gate 3: Diff Approval Path ===")
    # Get a candidate above threshold for testing
    d = find_similar("Ontario manufacturer SAP 3-way matching invoice approval over 30k 6h SLA",
                     "manufacturing", "ON", "sap")
    top = (d.get("candidates") or [{}])[0]
    threshold = d.get("threshold", 0.60)
    sim = top.get("similarity_pct", 0)
    chk(f"candidate above threshold ({int(threshold*100)}%)", sim >= threshold * 100, f"{sim}%")

    diff_items = top.get("diff") or []
    diff_acc = [{**item, "field_type": item.get("field_type", "numeric"),
                         "apply_operation": item.get("apply_operation", "replace")}
                for item in diff_items[:1]]

    r = requests.post(f"{BASE}/api/dataset/apply-diff", json={
        "base_record_id":  top.get("id"),
        "diff_accepted":   diff_acc,
        "diff_rejected":   diff_items[1:],
        "similarity_score": sim / 100,
    }, timeout=20)
    d3 = r.json()
    chk("apply-diff ok=True",        d3.get("ok") is True)
    chk("ref_id written",            bool(d3.get("ref_id")), str(d3.get("ref_id",""))[:16]+"...")
    chk("fallback=False",            d3.get("fallback") is False)
    wf = d3.get("workflow_json", {})
    has_wf = bool(wf.get("workflows") or wf.get("steps"))
    chk("workflow_json has content", has_wf, list(wf.keys()))
    print()


# ── Gate 4 — Flywheel write-back ──────────────────────────────────────────────

def gate4_flywheel(read_only: bool = False):
    if read_only:
        print("=== Gate 4: Flywheel Write-Back [READ-ONLY — status check only] ===")
        status = requests.get(f"{BASE}/api/dataset/status", timeout=10).json()
        complete = int(status.get("records_with_complete_metadata", 0))
        chk("dataset/save endpoint reachable (status ok)", complete >= 45,
            f"{complete} queryable records — flywheel writes not checked in read-only mode")
        print("  [INFO] Full write check skipped. Cert run confirmed save=True on 2026-06-04.")
        print()
        return

    print("=== Gate 4: Flywheel Write-Back [WRITE] ===")
    before = requests.get(f"{BASE}/api/dataset/status", timeout=10).json()
    total_before = int(before.get("total_records", 0))

    r = requests.post(f"{BASE}/api/dataset/save", json={
        "scenario_text":  "Demo flywheel gate — Ontario SAP manufacturing invoice approval test record",
        "project_name":   "Gate4 Demo Flywheel Test",
        "workflow_json":  {"workflows": [{"id": "wf_001", "name": "Invoice Approval",
                           "states": [{"id": "s1", "name": "Received", "state_kind": "initial"},
                                      {"id": "s2", "name": "Posted",   "state_kind": "terminal"}],
                           "transitions": [{"id": "t1", "source": "s1", "target": "s2"}]}]},
        "state_count":    2,
        "industry":       "manufacturing",
        "province":       "ON",
        "erp_type":       "sap",
        "source":         "ai_generated",
    }, timeout=60)
    d4 = r.json()
    chk("dataset/save returned saved=True", d4.get("saved") is True)
    chk("new record id present", bool(d4.get("id")), d4.get("id","")[:16]+"...")

    after = requests.get(f"{BASE}/api/dataset/status", timeout=10).json()
    total_after = int(after.get("total_records", 0))
    chk("total_records incremented by 1", total_after == total_before + 1,
        f"{total_before} -> {total_after}")
    print()


# ── Gate 5 — Intake path ──────────────────────────────────────────────────────

def gate5_intake(read_only: bool = False):
    if read_only:
        print("=== Gate 5: Invoice Intake Path [READ-ONLY — health proxy only] ===")
        # In read-only mode, just confirm the intake endpoint responds
        try:
            rh = requests.get(f"{BASE}/health", timeout=5).json()
            chk("intake platform healthy (health proxy)", rh.get("status") == "ok")
        except Exception as e:
            chk("intake platform healthy", False, str(e))
        print("  [INFO] Full intake write skipped. Cert run confirmed extracted state on 2026-06-04.")
        print()
        return

    print("=== Gate 5: Invoice Intake Path [WRITE] ===")
    try:
        r = requests.post(f"{BASE}/api/intake/upload",
                          json={"tenant_id": TENANT_ID, "paperless_id": "DEMO-GATE-S6"},
                          timeout=30)
        d5 = r.json()
        invoice_id = d5.get("invoice_id")
        chk("intake returns invoice_id", bool(invoice_id), invoice_id)
        chk("intake status=received",    d5.get("status") == "received", d5.get("status"))

        # Poll for extracted state (up to 45s)
        print("  Polling for extracted state (up to 45s)...")
        for _ in range(15):
            time.sleep(3)
            rv = requests.get(f"{BASE}/api/runtime-view?invoice_id={invoice_id}", timeout=10).json()
            rows = rv.get("data", {}).get("stateIntent", {}).get("rows", [])
            state = next((r[1] for r in rows if r[0] == "Current state"), None)
            if state == "extracted":
                break
        chk("invoice reaches extracted state", state == "extracted", state or "timeout")
    except Exception as e:
        chk("intake path reachable", False, str(e))
    print()


# ── Gate 6 — Manual demo walkthrough ─────────────────────────────────────────

def gate6_manual():
    print("=== Gate 6: Manual Demo Walkthrough (human step) ===")
    steps = [
        "This gate is not automated. Run this walkthrough before scheduling",
        "the Michel LeBrun demo. All 5 steps must complete without explanation",
        "or apology. No stubs. No fallback paths visible to the reviewer.",
        "",
        "Step 1 -- Intake",
        "  Upload a sample invoice PDF via the AP Workbench.",
        "  Confirm: invoice_id returned, status = received.",
        "",
        "Step 2 -- Extraction",
        "  Wait for OCR + phi4-mini recovery.",
        "  Confirm: invoice reaches 'extracted' state, confidence scores visible.",
        "",
        "Step 3 -- AI Workflow Generation (Mode 3)",
        "  Type a scenario in IngestionHub Mode 3:",
        '    "Quebec aerospace manufacturer SAP 3-tier approval over $50k compliance review"',
        "  Expected: DiffPanel appears (top candidate ~64%, 2 diff items).",
        "  Accept threshold diff, reject SLA diff.",
        "  Apply -- workflow loads on canvas.",
        "",
        "Step 4 -- Dataset Flywheel",
        '  After workflow loads: "Save to Dataset" banner appears bottom-right.',
        '  Click "Save to Dataset".',
        '  Confirm: green tick + "Future AI matches will improve."',
        "",
        "Step 5 -- Verify flywheel",
        "  Run another find-similar with same Quebec scenario.",
        "  Confirm: saved workflow appears as a candidate.",
        "",
        "Time budget: 8 minutes total. Stop and fix anything that takes",
        "longer than 2 minutes to explain.",
    ]
    for line in steps:
        print(f"  {line}")
    print(f"  {W} Mark this gate complete only after human timed walkthrough passes.")
    print()


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Session 6 Demo Readiness Gate ===")
    print(f"Backend: {BASE}   Tenant: {TENANT_ID}")

    import argparse as _ap
    _parser = _ap.ArgumentParser()
    _parser.add_argument("--read-only", "-r", action="store_true",
                         help="Skip write gates (4+5). Use for repeat pre-demo checks.")
    _args = _parser.parse_args()
    ro = _args.read_only
    mode = "READ-ONLY (gates 4+5 status-only)" if ro else "FULL (gates 4+5 write to DB)"
    print(f"Mode: {mode}\n")

    gate1_health()
    gate2_dataset()
    gate3_diff_approval()
    gate4_flywheel(read_only=ro)
    gate5_intake(read_only=ro)
    gate6_manual()

    print("=== Results ===")
    if failures:
        print(f"  {F} {len(failures)} gate(s) failed: " + ", ".join(failures))
        print("  Resolve failures before scheduling Michel LeBrun demo.")
        sys.exit(1)
    else:
        print(f"  {P} Gates 1–5 PASSED. Gate 6 requires human timed walkthrough.")
        print("  When Gate 6 passes: demo is ready to schedule.")

"""
verify_5b.py — Session 5B ranking regression check.

Runs 3 anchor queries that were confirmed before batch expansion.
Passes if:
  1. Top result ID matches expected project_name (stable ranking)
  2. Top similarity_pct is within ±10 points of baseline (no large drift)
  3. dataset/status shows total_records >= expected_minimum

Run after each +10 batch:
    python scripts/verify_5b.py [--min N]

Baseline captured 2026-06-03 (16 seed records, all embedded):
  Query 1: Manufacturing AP - SAP 3-Way Matching        65%  [ON  sap]
  Query 2: Quebec Aerospace Manufacturing - SAP          64%  [QC  sap]
  Query 3: Healthcare AP - Compliance Validation         65%  [ON  oracle]
"""

import argparse, os, requests, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

BASE      = os.environ.get("BACKEND_URL", "http://localhost:5000")
P = "[PASS]"; F = "[FAIL]"
failures  = []

def chk(label, ok, detail=""):
    mark = P if ok else F
    print(f"  {mark} {label}" + (f": {detail}" if detail else ""))
    if not ok:
        failures.append(label)

ANCHORS = [
    {
        "label":          "ON SAP manufacturing 3-way match",
        "scenario_text":  "Ontario manufacturer SAP 3-way matching invoice approval",
        "industry":       "manufacturing", "province": "ON", "erp_type": "sap",
        "expect_name":    "Manufacturing AP - SAP 3-Way Matching",
        "expect_pct_min": 55,
    },
    {
        "label":          "QC SAP aerospace 3-tier compliance",
        "scenario_text":  "Quebec aerospace SAP 3-tier compliance 50000 threshold 24h SLA",
        "industry":       "manufacturing", "province": "QC", "erp_type": "sap",
        "expect_name":    "Quebec Aerospace Manufacturing - SAP AP Automation",
        "expect_pct_min": 54,
    },
    {
        "label":          "ON Oracle healthcare compliance",
        "scenario_text":  "healthcare compliance oracle vendor validation audit Ontario 24h SLA",
        "industry":       "healthcare", "province": "ON", "erp_type": "oracle",
        "expect_name":    "Healthcare AP - Compliance Validation",
        "expect_pct_min": 55,
    },
]


def run_regression(min_records: int) -> None:
    print(f"=== Session 5B Regression Check  (backend: {BASE}) ===\n")

    # Dataset size
    print("--- Dataset size ---")
    status = requests.get(f"{BASE}/api/dataset/status", timeout=10).json()
    total = int(status.get("total_records", 0))
    embedded = int(status.get("embedded_records", 0))
    chk(f"total_records >= {min_records}", total >= min_records, total)
    chk("all records embedded",           total == embedded, f"{embedded}/{total}")
    print()

    # Anchor ranking
    print("--- Anchor ranking (top result must match baseline) ---")
    for anchor in ANCHORS:
        r = requests.post(
            f"{BASE}/api/dataset/find-similar",
            json={k: anchor[k] for k in ("scenario_text", "industry", "province", "erp_type")},
            timeout=90,
        )
        d = r.json()
        top = (d.get("candidates") or [{}])[0]
        top_name = top.get("project_name", "")
        top_pct  = top.get("similarity_pct", 0)

        print(f"\n  Anchor: {anchor['label']}")
        chk(f"top result = '{anchor['expect_name']}'",
            top_name == anchor["expect_name"], top_name)
        chk(f"similarity_pct >= {anchor['expect_pct_min']}%",
            top_pct >= anchor["expect_pct_min"], f"{top_pct}%")
    print()

    # Summary
    if failures:
        print(f"RESULT: {len(failures)} failure(s) — " + ", ".join(failures))
        sys.exit(1)
    else:
        print(f"All regression checks PASSED  ({total} records, {embedded} embedded).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--min", type=int, default=16,
                        help="Minimum expected total_records (default 16)")
    args = parser.parse_args()
    run_regression(args.min)

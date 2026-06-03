"""Session 4 DoD verification — run from repo root with system Python 3.11."""
import requests, sys

BASE = "http://localhost:5000"
P = "[PASS]"; F = "[FAIL]"
failures = []

def chk(label, ok, detail=""):
    mark = P if ok else F
    print(f"  {mark} {label}" + (f": {detail}" if detail else ""))
    if not ok:
        failures.append(label)

print("=== Session 4 DoD Verification ===\n")

# DoD 1+2: threshold server-traceable + in find-similar response
print("--- 1+2: Threshold in find-similar response ---")
r = requests.post(f"{BASE}/api/dataset/find-similar",
    json={"scenario_text": "Ontario manufacturer SAP 3-way matching invoice approval",
          "industry": "manufacturing", "province": "ON", "erp_type": "sap"},
    timeout=90)
d = r.json()
threshold = d.get("threshold")
top = (d.get("candidates") or [{}])[0]

chk("threshold=0.60 in response", threshold == 0.60, threshold)
chk("top similarity >= 50%", top.get("similarity_pct", 0) >= 50, f"{top.get('similarity_pct')}%")
print(f"       top: {top.get('project_name')}")
print()

# DoD 1 server enforcement: score below threshold -> 400
print("--- 1 server: apply-diff rejects similarity_score < threshold ---")
r2 = requests.post(f"{BASE}/api/dataset/apply-diff",
    json={"base_record_id": top.get("id", "x"),
          "diff_accepted": [], "diff_rejected": [],
          "similarity_score": 0.30},
    timeout=10)
chk("HTTP 400 for score 0.30", r2.status_code == 400, r2.json().get("error"))
print()

# DoD 3+4: single write, replayable shape
print("--- 3+4: Single write + replayable diff shape ---")
diff_acc = [{
    "field": "threshold_amount", "from_value": 10000, "to_value": 12000,
    "reason": "DoD test", "field_type": "numeric", "apply_operation": "replace",
}]
r3 = requests.post(f"{BASE}/api/dataset/apply-diff",
    json={"base_record_id": top.get("id"),
          "diff_accepted": diff_acc, "diff_rejected": [],
          "similarity_score": top.get("similarity_pct", 65) / 100},
    timeout=20)
d3 = r3.json()
chk("apply-diff ok=True",      d3.get("ok") is True)
chk("ref_id written",          bool(d3.get("ref_id")),    str(d3.get("ref_id", ""))[:16] + "...")
chk("threshold_used=0.60",     d3.get("threshold_used") == 0.60, d3.get("threshold_used"))
chk("fallback=False",          d3.get("fallback") is False, d3.get("fallback"))
wf = d3.get("workflow_json", {})
chk("workflow_json returned",  bool(wf), list(wf.keys()))
print()

# DoD 4 safe fallback: bad UUID -> 200 or 404, never 500
print("--- 4 fallback: bad record_id does not 500 ---")
r4 = requests.post(f"{BASE}/api/dataset/apply-diff",
    json={"base_record_id": "00000000-0000-0000-0000-000000000000",
          "diff_accepted": [], "diff_rejected": [],
          "similarity_score": 0.90},
    timeout=10)
chk("status is 200 or 404 (not 500)", r4.status_code in (200, 404), r4.status_code)
print()

# DoD 7: smoke gate proxy (health endpoints)
print("--- 7: Backend health ---")
rh = requests.get(f"{BASE}/health", timeout=5).json()
rd = requests.get(f"{BASE}/health/db", timeout=10).json()
chk("/health ok",   rh.get("status") == "ok")
chk("postgres ok",  rd.get("postgres", {}).get("ok") is True)
chk("redis ok",     rd.get("redis",    {}).get("ok") is True)
print()

# Summary
if failures:
    print(f"RESULT: {len(failures)} failure(s) — " + ", ".join(failures))
    sys.exit(1)
else:
    print("All DoD checks PASSED.")

from dataclasses import dataclass
from typing import Optional, Any
import json
import math
import os

import requests

WEIGHTS = {
    "semantic": 0.40,
    "structural": 0.30,
    "config": 0.20,
    "context": 0.10,
}

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")


@dataclass
class SimilarityInput:
    scenario_text: str
    state_count_hint: Optional[int] = None
    threshold_hint: Optional[float] = None
    sla_hours_hint: Optional[float] = None
    industry: Optional[str] = None
    province: Optional[str] = None
    erp_type: Optional[str] = None


@dataclass
class SimilarityScore:
    record_id: str
    project_name: str
    semantic_score: float
    structural_score: float
    config_score: float
    context_score: float
    combined_score: float
    similarity_pct: int


def _vector_literal(vec: Optional[list[float]]) -> Optional[str]:
    if not vec:
        return None
    return "[" + ",".join(f"{float(v):.8f}" for v in vec) + "]"


def get_embedding(text: str) -> Optional[list[float]]:
    # When OLLAMA_BASE_URL points to host.docker.internal (Docker network hostname),
    # add localhost:11434 as a fallback for when Flask runs directly on the host.
    base_urls = [OLLAMA_BASE_URL]
    if "host.docker.internal" in OLLAMA_BASE_URL or "ollama:" in OLLAMA_BASE_URL:
        base_urls.append("http://localhost:11434")

    for base_url in base_urls:
        # Try /api/embeddings first (Ollama ≤0.3 style)
        try:
            resp = requests.post(
                f"{base_url}/api/embeddings",
                json={"model": OLLAMA_EMBED_MODEL, "prompt": text},
                timeout=15,
            )
            resp.raise_for_status()
            emb = (resp.json() or {}).get("embedding")
            if isinstance(emb, list) and emb:
                return [float(x) for x in emb]
        except Exception:
            pass

        # Try /api/embed (Ollama ≥0.4 style)
        try:
            resp = requests.post(
                f"{base_url}/api/embed",
                json={"model": OLLAMA_EMBED_MODEL, "input": text},
                timeout=15,
            )
            resp.raise_for_status()
            embs = (resp.json() or {}).get("embeddings")
            if isinstance(embs, list) and embs and isinstance(embs[0], list):
                return [float(x) for x in embs[0]]
        except Exception:
            pass

    return None


def structural_score(candidate_states: int, query_states: Optional[int]) -> float:
    if query_states is None:
        return 0.5

    diff = abs(int(candidate_states or 0) - int(query_states or 0))
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.85
    if diff == 2:
        return 0.70
    if diff <= 4:
        return 0.45
    return 0.20


def config_score(
    candidate_threshold: Optional[float],
    candidate_sla: Optional[float],
    query_threshold: Optional[float],
    query_sla: Optional[float],
) -> float:
    scores = []

    if candidate_threshold is not None and query_threshold is not None:
        max_diff = 200000.0
        diff = abs(float(candidate_threshold) - float(query_threshold))
        scores.append(max(0.0, 1.0 - (diff / max_diff)))

    if candidate_sla is not None and query_sla is not None:
        max_diff = 72.0
        diff = abs(float(candidate_sla) - float(query_sla))
        scores.append(max(0.0, 1.0 - (diff / max_diff)))

    if not scores:
        return 0.5
    return sum(scores) / len(scores)


def context_score(
    candidate_industry: Optional[str],
    candidate_province: Optional[str],
    candidate_erp: Optional[str],
    query_industry: Optional[str],
    query_province: Optional[str],
    query_erp: Optional[str],
) -> float:
    score = 0.0

    if query_erp and candidate_erp and candidate_erp.lower() == query_erp.lower():
        score += 0.50

    if query_province and candidate_province and candidate_province.upper() == query_province.upper():
        score += 0.30

    if query_industry and candidate_industry and candidate_industry.lower() == query_industry.lower():
        score += 0.20

    return min(score, 1.0)


def combine(semantic: float, structural: float, config: float, context: float) -> float:
    return (
        semantic * WEIGHTS["semantic"]
        + structural * WEIGHTS["structural"]
        + config * WEIGHTS["config"]
        + context * WEIGHTS["context"]
    )


def _safe_json(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            val = json.loads(raw)
            return val if isinstance(val, dict) else {}
        except Exception:
            return {}
    return {}


def _extract_float_from_json(workflow_json: dict, key: str) -> Optional[float]:
    cfg = workflow_json.get("config") if isinstance(workflow_json.get("config"), dict) else {}
    val = cfg.get(key)
    if val is None:
        return None
    try:
        return float(val)
    except Exception:
        return None


def _fetch_candidates(conn, tenant_id: str, embed_vec: Optional[str], limit: int = 50) -> tuple[list[dict], int]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM workflows_dataset WHERE tenant_id = %s AND embedding IS NOT NULL",
            (tenant_id,),
        )
        searched = int(cur.fetchone()[0])

        if embed_vec:
            cur.execute(
                """
                SELECT id, project_name, scenario_text, industry, province, erp_type,
                       state_count, touchless_rate, tags, workflow_json,
                       threshold_amount, sla_hours,
                       1 - (embedding <=> %s::vector) AS semantic_score
                FROM workflows_dataset
                WHERE tenant_id = %s AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (embed_vec, tenant_id, embed_vec, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, project_name, scenario_text, industry, province, erp_type,
                       state_count, touchless_rate, tags, workflow_json,
                       threshold_amount, sla_hours,
                       0.0 AS semantic_score
                FROM workflows_dataset
                WHERE tenant_id = %s
                LIMIT %s
                """,
                (tenant_id, limit),
            )

        cols = [d.name if hasattr(d, "name") else d[0] for d in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]

    return rows, searched


def find_similar(conn, tenant_id: str, query: SimilarityInput, top_n: int = 3) -> dict:
    top_n = max(1, min(10, int(top_n or 3)))

    embedding = get_embedding(query.scenario_text)
    vec = _vector_literal(embedding)

    rows, searched = _fetch_candidates(conn, tenant_id, vec, limit=50)

    results = []
    for row in rows:
        wf = _safe_json(row.get("workflow_json"))

        sem = float(row.get("semantic_score") or 0.0)
        stru = structural_score(int(row.get("state_count") or 0), query.state_count_hint)

        c_threshold = row.get("threshold_amount")
        if c_threshold is None:
            c_threshold = _extract_float_from_json(wf, "threshold_amount")
        c_sla = row.get("sla_hours")
        if c_sla is None:
            c_sla = _extract_float_from_json(wf, "sla_hours")

        cfg = config_score(c_threshold, c_sla, query.threshold_hint, query.sla_hours_hint)
        ctx = context_score(
            row.get("industry"),
            row.get("province"),
            row.get("erp_type"),
            query.industry,
            query.province,
            query.erp_type,
        )

        combined = combine(sem, stru, cfg, ctx)
        score = SimilarityScore(
            record_id=str(row.get("id")),
            project_name=row.get("project_name") or "Untitled",
            semantic_score=round(sem, 3),
            structural_score=round(stru, 3),
            config_score=round(cfg, 3),
            context_score=round(ctx, 3),
            combined_score=round(combined, 3),
            similarity_pct=int(round(combined * 100)),
        )

        results.append(
            {
                "id": score.record_id,
                "project_name": score.project_name,
                "scenario_text": row.get("scenario_text"),
                "similarity_pct": score.similarity_pct,
                "semantic_score": score.semantic_score,
                "structural_score": score.structural_score,
                "config_score": score.config_score,
                "context_score": score.context_score,
                "industry": row.get("industry"),
                "province": row.get("province"),
                "erp_type": row.get("erp_type"),
                "state_count": row.get("state_count"),
                "touchless_rate": float(row.get("touchless_rate") or 0.0),
                "tags": row.get("tags") or [],
                "workflow_json": wf,
            }
        )

    results.sort(key=lambda x: x["similarity_pct"], reverse=True)
    return {
        "candidates":     results[:top_n],
        "records_searched": searched,
        "embed_model":    OLLAMA_EMBED_MODEL,
        "threshold":      float(os.environ.get("SIMILARITY_DIFF_THRESHOLD", "0.60")),
    }


def save_to_dataset(conn, tenant_id: str, body: dict) -> str:
    scenario_text = (body.get("scenario_text") or "").strip()
    workflow_json = body.get("workflow_json")
    if not scenario_text:
        raise ValueError("scenario_text required")
    if not isinstance(workflow_json, dict):
        raise ValueError("workflow_json object required")

    emb = get_embedding(scenario_text)
    vec = _vector_literal(emb)

    project_name = body.get("project_name") or workflow_json.get("name") or "Untitled Project"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO workflows_dataset (
              tenant_id, project_name, scenario_text, industry, province,
              erp_type, state_count, touchless_rate, tags,
              version, workflow_json, parent_id, embedding,
              type, complexity, source,
              threshold_amount, sla_hours, transition_count, approval_tiers
            ) VALUES (
              %s,%s,%s,%s,%s,
              %s,%s,%s,%s,
              %s,%s::jsonb,%s,%s::vector,
              %s,%s,%s,
              %s,%s,%s,%s
            )
            RETURNING id
            """,
            (
                tenant_id,
                project_name,
                scenario_text,
                body.get("industry"),
                body.get("province"),
                body.get("erp_type"),
                body.get("state_count"),
                body.get("touchless_rate"),
                body.get("tags") or [],
                body.get("version") or "1.0.0",
                json.dumps(workflow_json),
                body.get("parent_id"),
                vec,
                body.get("type") or "approval",
                body.get("complexity") or "medium",
                body.get("source") or "ai_customized",
                body.get("threshold_amount"),
                body.get("sla_hours"),
                body.get("transition_count"),
                body.get("approval_tiers"),
            ),
        )
        row_id = str(cur.fetchone()[0])
    conn.commit()
    return row_id

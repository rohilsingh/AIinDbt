"""C3 — Data Quality Scoring.

Computes a 0–100 health score per model:
  - 40 pts: documentation (model + column descriptions)
  - 40 pts: test coverage (tests defined in manifest)
  - 20 pts: freshness (has a freshness config or recently-loaded source)
"""
from __future__ import annotations

from .. import dbt_client
from ..state import SETTINGS


def _doc_score(node: dict) -> float:
    cols = node.get("columns", {}) or {}
    if not cols and not node.get("description"):
        return 0.0
    model_doc = 1.0 if node.get("description") else 0.0
    col_doc = 0.0
    if cols:
        documented = sum(1 for c in cols.values() if (c or {}).get("description"))
        col_doc = documented / len(cols)
    return 40.0 * (0.3 * model_doc + 0.7 * col_doc)


def _test_score(node_id: str, manifest: dict) -> float:
    tests = [
        n for n in manifest.get("nodes", {}).values()
        if n.get("resource_type") == "test"
        and node_id in (n.get("depends_on") or {}).get("nodes", [])
    ]
    if not tests:
        return 0.0
    # plateau at 4 tests
    return 40.0 * min(len(tests) / 4.0, 1.0)


def _freshness_score(node: dict) -> float:
    if node.get("resource_type") == "source":
        return 20.0 if (node.get("freshness") or {}) else 0.0
    cfg = node.get("config") or {}
    if cfg.get("materialized") == "incremental":
        return 20.0
    return 10.0  # batch-built but no freshness signal


def score_all() -> list[dict]:
    manifest = SETTINGS.manifest
    out = []
    for n in dbt_client.models():
        doc = _doc_score(n)
        test = _test_score(n.get("unique_id"), manifest)
        fresh = _freshness_score(n)
        total = doc + test + fresh
        grade = "A" if total >= 85 else "B" if total >= 70 else "C" if total >= 50 else "D"
        out.append({
            "name": n.get("name"),
            "score": round(total, 1),
            "grade": grade,
            "documentation_score": round(doc, 1),
            "test_score": round(test, 1),
            "freshness_score": round(fresh, 1),
            "materialized": (n.get("config") or {}).get("materialized"),
        })
    out.sort(key=lambda r: r["score"])
    return out

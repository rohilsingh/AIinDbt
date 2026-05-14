"""D3 — Model Health Dashboard. Aggregates quality + lineage stats."""
from __future__ import annotations

from .. import dbt_client
from . import quality


def overview() -> dict:
    scores = quality.score_all()
    total = len(scores)
    if not total:
        return {"total_models": 0}

    avg = sum(s["score"] for s in scores) / total
    by_grade = {"A": 0, "B": 0, "C": 0, "D": 0}
    for s in scores:
        by_grade[s["grade"]] = by_grade.get(s["grade"], 0) + 1

    # coverage stats
    fully_documented = sum(
        1 for n in dbt_client.models()
        if n.get("description") and all(
            (c or {}).get("description") for c in (n.get("columns") or {}).values()
        )
    )
    has_tests = sum(1 for s in scores if s["test_score"] > 0)
    incrementals = sum(
        1 for n in dbt_client.models()
        if (n.get("config") or {}).get("materialized") == "incremental"
    )

    return {
        "total_models": total,
        "average_score": round(avg, 1),
        "by_grade": by_grade,
        "fully_documented": fully_documented,
        "models_with_tests": has_tests,
        "incremental_models": incrementals,
        "worst_offenders": scores[:10],
        "top_performers": list(reversed(scores))[:10],
    }

"""A4 — Incremental Model Advisor.

Heuristic + LLM rewrite: a model is a good incremental candidate if
- it's currently table/view
- its SQL touches a timestamp/date column
- (optionally) its catalog row count is large

We return a verdict + a rewritten incremental version.
"""
from __future__ import annotations

import re

from .. import dbt_client, llm
from ..state import SETTINGS


_TS_PAT = re.compile(r"\b(created_at|updated_at|event_time|loaded_at|_etl_loaded_at|timestamp)\b", re.I)


def _row_count(node: dict) -> int | None:
    cat = SETTINGS.catalog or {}
    nodes = cat.get("nodes", {})
    entry = nodes.get(node.get("unique_id"), {})
    stats = entry.get("stats") or {}
    rc = stats.get("row_count") or stats.get("num_rows")
    if isinstance(rc, dict):
        rc = rc.get("value")
    try:
        return int(rc) if rc is not None else None
    except (ValueError, TypeError):
        return None


PROMPT = """Rewrite this dbt model to be incremental using a {strategy} strategy
on the column `{ts_col}`. Keep the SQL logic identical otherwise.

Original SQL:
{sql}

Return JSON with keys: "sql" (the rewritten model), "config_block"
(the {{{{ config(...) }}}} block), "notes" (one-paragraph rationale)."""


def analyze() -> list[dict]:
    results = []
    for n in dbt_client.models():
        sql = (n.get("raw_code") or n.get("raw_sql") or "")
        mat = (n.get("config") or {}).get("materialized")
        ts_hits = _TS_PAT.findall(sql)
        rc = _row_count(n)
        score = 0
        if mat in ("table", "view"):
            score += 1
        if ts_hits:
            score += 2
        if rc and rc > 1_000_000:
            score += 2
        results.append({
            "name": n.get("name"),
            "current_materialization": mat,
            "row_count": rc,
            "timestamp_columns_found": list(set(c.lower() for c in ts_hits)),
            "incremental_score": score,
            "recommend_incremental": score >= 3,
        })
    results.sort(key=lambda r: -r["incremental_score"])
    return results


def rewrite(model_name: str, ts_col: str, strategy: str = "merge") -> dict:
    n = dbt_client.find_model(model_name)
    if not n:
        raise ValueError(f"Model {model_name!r} not found.")
    sql = n.get("raw_code") or n.get("raw_sql") or ""
    return llm.chat_json(PROMPT.format(
        strategy=strategy, ts_col=ts_col, sql=sql[:8000],
    ))

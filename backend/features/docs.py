"""A1 — AI Documentation Generator.

For a chosen model, send its SQL and column list to Claude and get back a
YAML block ready to paste into schema.yml.
"""
from __future__ import annotations

from .. import dbt_client, llm


PROMPT = """You are documenting a dbt model. Produce a valid schema.yml block
with a one-sentence model description and one-line descriptions for every
column listed.

Model name: {name}
Existing description: {desc}
Columns: {cols}

SQL:
{sql}

Return YAML only, starting at `  - name: {name}`. Two-space indent. No fences."""


def generate(model_name: str) -> dict:
    node = dbt_client.find_model(model_name)
    if not node:
        raise ValueError(f"Model {model_name!r} not found in manifest.")
    s = dbt_client.model_summary(node)
    yaml = llm.chat(PROMPT.format(
        name=s["name"],
        desc=s["description"] or "(none)",
        cols=", ".join(s["columns"].keys()) or "(no columns in manifest — infer from SQL)",
        sql=s["raw_sql"][:6000],
    ))
    return {"model": s["name"], "yaml": yaml.strip()}


def list_undocumented() -> list[dict]:
    out = []
    for n in dbt_client.models():
        cols = n.get("columns", {}) or {}
        documented = sum(1 for c in cols.values() if (c or {}).get("description"))
        if not n.get("description") or documented < len(cols):
            out.append({
                "name": n.get("name"),
                "description": n.get("description") or "",
                "column_count": len(cols),
                "documented_columns": documented,
            })
    return out

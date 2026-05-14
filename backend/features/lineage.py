"""D1 — Interactive Lineage Explorer (data) and
   D2 — Column-Level Lineage (best-effort via sqlglot)."""
from __future__ import annotations

from typing import Any

from .. import dbt_client

try:
    import sqlglot
    from sqlglot import exp
except ImportError:  # pragma: no cover
    sqlglot = None  # type: ignore


def graph() -> dict[str, Any]:
    """Returns {nodes:[{id,name,kind,materialized}], edges:[{from,to}]}."""
    nodes_out, edges_out = [], []
    for n in dbt_client.all_nodes().values():
        kind = n.get("resource_type")
        if kind not in ("model", "source", "seed"):
            continue
        nodes_out.append({
            "id": n.get("unique_id"),
            "name": n.get("name"),
            "kind": kind,
            "materialized": (n.get("config") or {}).get("materialized"),
            "schema": n.get("schema"),
            "description": (n.get("description") or "")[:160],
        })
        for parent in (n.get("depends_on") or {}).get("nodes", []) or []:
            edges_out.append({"from": parent, "to": n.get("unique_id")})
    return {"nodes": nodes_out, "edges": edges_out}


def _model_dialect_guess() -> str:
    # Best-effort default; sqlglot tolerates close-enough dialects.
    return "snowflake"


def column_lineage(model_name: str, column: str) -> dict[str, Any]:
    """Walks upstream models trying to trace where `column` came from."""
    if sqlglot is None:
        return {"error": "sqlglot not installed"}

    visited: set[str] = set()
    trail: list[dict[str, Any]] = []

    def walk(model_name: str, col: str, depth: int = 0) -> None:
        if depth > 6 or model_name in visited:
            return
        visited.add(model_name)
        node = dbt_client.find_model(model_name)
        if not node:
            return
        sql = node.get("raw_code") or node.get("raw_sql") or ""
        # strip jinja: replace {{ ref('x') }} with x, {{ source('a','b') }} with b
        cleaned = sql
        for m in list(_find_jinja_refs(sql)):
            cleaned = cleaned.replace(m["match"], m["alias"])

        try:
            tree = sqlglot.parse_one(cleaned, dialect=_model_dialect_guess())
        except Exception as e:
            trail.append({"model": model_name, "column": col, "note": f"parse error: {e}"})
            return

        sources_for_col: list[tuple[str, str]] = []
        for proj in tree.find_all(exp.Select):
            for e in proj.expressions:
                alias = e.alias_or_name
                if alias and alias.lower() == col.lower():
                    base = e.unalias() if hasattr(e, "unalias") else e
                    for c in base.find_all(exp.Column):
                        sources_for_col.append((c.table or "", c.name))

        trail.append({"model": model_name, "column": col, "from": sources_for_col})

        # Find parent model names from refs and recurse.
        parents = [r["alias"] for r in _find_jinja_refs(sql)]
        for p in parents:
            # recurse on same column name if it appears unchanged, plus any
            # source columns we found
            cols_to_chase = {col} | {c for _, c in sources_for_col}
            for cc in cols_to_chase:
                walk(p, cc, depth + 1)

    walk(model_name, column)
    return {"model": model_name, "column": column, "trail": trail}


def _find_jinja_refs(sql: str) -> list[dict[str, str]]:
    """Yields {match, alias} for each ref()/source() call."""
    import re
    out = []
    for m in re.finditer(r"\{\{\s*ref\(\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}", sql):
        out.append({"match": m.group(0), "alias": m.group(1)})
    for m in re.finditer(
        r"\{\{\s*source\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}",
        sql,
    ):
        out.append({"match": m.group(0), "alias": m.group(2)})
    return out

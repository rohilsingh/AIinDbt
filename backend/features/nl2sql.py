"""B2 — Natural Language → SQL against the warehouse.

Generates SQL using the manifest as schema context. Optional execution
is left as a TODO (depends on which warehouse the user wires up).
"""
from __future__ import annotations

from .. import llm
from . import search


SYSTEM = """You translate business questions into warehouse SQL. Use the
provided dbt model schema as ground truth — do not invent columns. Output
SQL only — no prose, no markdown fences — unless asked to explain."""


def _schema_block(question: str) -> str:
    hits = search.search(question, limit=10)
    if not hits:
        return "(no models found — output a placeholder query)"
    parts = []
    for h in hits:
        parts.append(
            f"-- {h['kind']} {h['name']}\n"
            f"-- columns: {', '.join(h.get('columns', []))}"
        )
    return "\n".join(parts)


def translate(question: str, dialect: str = "snowflake") -> dict:
    schema = _schema_block(question)
    prompt = (
        f"Dialect: {dialect}\n\n"
        f"Schema:\n{schema}\n\n"
        f"Question: {question}\n\n"
        f"Return a single SQL query. Reference dbt models by their physical name."
    )
    sql = llm.chat(prompt, system=SYSTEM)
    return {"sql": sql.strip(), "schema_used": schema}

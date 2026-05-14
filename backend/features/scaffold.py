"""A2 — Model Scaffolding from a plain-English brief."""
from __future__ import annotations

from .. import dbt_client, llm


PROMPT = """Generate a complete dbt model from this brief.

Project context (available sources and models):
{context}

Brief: {brief}
Target layer: {layer}
Materialization: {materialization}

Return JSON with these keys:
  "name":        snake_case file name (no .sql)
  "sql":         the full model SQL using ref() / source() — Jinja allowed
  "yaml":        a schema.yml entry with description + column docs + sensible tests

Use only refs/sources that exist in the project context."""


def _project_context() -> str:
    items = dbt_client.project_index()
    lines = []
    for it in items[:200]:
        kind = it["kind"]
        if kind == "source":
            lines.append(f"source: {it['name']} (cols: {', '.join(it['columns'][:8])})")
        else:
            lines.append(f"{kind}: {it['name']} (cols: {', '.join(it['columns'][:8])})")
    return "\n".join(lines) or "(no manifest uploaded)"


def generate(brief: str, layer: str = "marts", materialization: str = "table") -> dict:
    return llm.chat_json(PROMPT.format(
        context=_project_context(),
        brief=brief,
        layer=layer,
        materialization=materialization,
    ))

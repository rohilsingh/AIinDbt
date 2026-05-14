"""A3 — Staging Layer Generator. Reads a source table and produces stg_*."""
from __future__ import annotations

from .. import dbt_client, llm


PROMPT = """Generate a dbt staging model for this RAW source table.

Source: {source_name}.{table_name}
Columns (name : type):
{cols}

Apply these conventions:
- Rename columns to snake_case
- Cast obvious timestamps to TIMESTAMP and ids to the right numeric type
- Surface a single CTE pattern: with source as (...), renamed as (select ...)
- Use {{{{ source('{source_name}', '{table_name}') }}}}

Return JSON with keys: "name" (e.g. stg_{source_name}__{table_name}),
"sql", "yaml" (schema.yml block with not_null on id columns)."""


def generate(source_name: str, table_name: str, columns: list[dict] | None = None) -> dict:
    if columns is None:
        # try to find it in the manifest sources
        for s in dbt_client.sources():
            if s.get("source_name") == source_name and s.get("name") == table_name:
                columns = [
                    {"name": c, "type": (info or {}).get("data_type", "")}
                    for c, info in (s.get("columns") or {}).items()
                ]
                break
    if not columns:
        raise ValueError("Provide columns or upload a manifest that contains this source.")

    col_text = "\n".join(f"  - {c['name']} : {c.get('type','?')}" for c in columns)
    return llm.chat_json(PROMPT.format(
        source_name=source_name, table_name=table_name, cols=col_text,
    ))

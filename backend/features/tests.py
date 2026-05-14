"""C1 — AI Test Generator.

Given sample rows (pasted CSV or JSON) and a model name, generate a
schema.yml `tests:` block: unique, not_null, accepted_values, relationships.
"""
from __future__ import annotations

import csv
import io

from .. import dbt_client, llm


PROMPT = """You are generating dbt tests for the model `{model}`.

Columns (with sample values):
{profile}

Existing project refs (use these for relationships when appropriate):
{refs}

For each column decide which of these tests apply:
  - not_null
  - unique
  - accepted_values (with values list, only if cardinality <= 12)
  - relationships (to: ref('other_model'), field: 'id', only if the column
    looks like a foreign key matching another model's primary key)

Return YAML only — the `columns:` block for this model. No fences."""


def _profile_csv(csv_text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        return []
    cols = reader.fieldnames or []
    out = []
    for c in cols:
        values = [r.get(c) for r in rows]
        non_null = [v for v in values if v not in (None, "")]
        distinct = sorted(set(non_null))
        out.append({
            "column": c,
            "n_rows": len(rows),
            "n_null": len(values) - len(non_null),
            "n_distinct": len(distinct),
            "sample": distinct[:12],
        })
    return out


def generate(model: str, csv_text: str) -> dict:
    profile = _profile_csv(csv_text)
    if not profile:
        raise ValueError("Could not parse CSV. Make sure it has a header row.")
    profile_lines = []
    for p in profile:
        profile_lines.append(
            f"  - {p['column']}: rows={p['n_rows']} nulls={p['n_null']} "
            f"distinct={p['n_distinct']} sample={p['sample']}"
        )
    refs = ", ".join(m["name"] for m in dbt_client.models()[:80]) or "(no manifest)"
    yaml = llm.chat(PROMPT.format(
        model=model, profile="\n".join(profile_lines), refs=refs,
    ))
    return {"model": model, "profile": profile, "yaml": yaml.strip()}

"""B1 — Chat with your dbt project.

Uses cheap keyword search to pull a handful of relevant models, then asks
Claude to answer using only that context.
"""
from __future__ import annotations

from .. import llm
from . import search


SYSTEM = """You are an analytics-engineering assistant. Answer the user's
question using ONLY the dbt project context provided. If the answer requires
SQL, write SQL that references the models with {{ ref('model_name') }}. If
the context is insufficient, say so plainly and list what's missing."""


def _context_block(query: str) -> str:
    hits = search.search(query, limit=8)
    if not hits:
        return "(no matching models found in this project)"
    lines = []
    for h in hits:
        lines.append(
            f"- {h['kind']} `{h['name']}`: {h.get('description','') or '(no description)'}\n"
            f"  columns: {', '.join(h.get('columns', [])[:25])}"
        )
    return "\n".join(lines)


def ask(question: str) -> dict:
    ctx = _context_block(question)
    prompt = f"dbt project context:\n{ctx}\n\nQuestion: {question}"
    answer = llm.chat(prompt, system=SYSTEM)
    return {"answer": answer, "context_used": ctx}

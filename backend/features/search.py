"""B3 — Semantic Search over dbt docs.

Lightweight: TF-IDF-like keyword ranking with token overlap. Avoids the
cost of embeddings — fine for repos with up to a few thousand models.
"""
from __future__ import annotations

import re
from collections import Counter

from .. import dbt_client


_TOK = re.compile(r"[a-zA-Z0-9_]+")


def _tokens(text: str) -> list[str]:
    return [t.lower() for t in _TOK.findall(text or "")]


def _doc_text(item: dict) -> str:
    return " ".join([
        item.get("name", ""),
        item.get("description", "") or "",
        " ".join(item.get("columns", [])),
    ])


def search(query: str, limit: int = 10) -> list[dict]:
    qtoks = _tokens(query)
    if not qtoks:
        return []
    qset = set(qtoks)
    qcount = Counter(qtoks)
    results = []
    for item in dbt_client.project_index():
        toks = _tokens(_doc_text(item))
        if not toks:
            continue
        tset = set(toks)
        overlap = qset & tset
        if not overlap:
            continue
        tcount = Counter(toks)
        score = sum(qcount[t] * min(tcount[t], 3) for t in overlap)
        # bonus if the model name matches
        if any(t in _tokens(item["name"]) for t in qtoks):
            score += 5
        results.append({**item, "score": score})
    results.sort(key=lambda r: -r["score"])
    return results[:limit]

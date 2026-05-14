"""Command router for chat surfaces (Teams).

Parses slash-style commands like `/docs dim_customers` and dispatches to the
right feature. Anything that isn't a recognized command falls through to the
B1 chat feature so users can just ask questions naturally.
"""
from __future__ import annotations

import shlex
from typing import Callable

from . import (
    anomaly, chat, docs, health, incremental, lineage, nl2sql,
    quality, scaffold, search, staging,
)


MAX_REPLY_CHARS = 16000  # Teams hard limit is ~28k; stay well under


HELP = """**AIinDbt commands** (or just ask a question for B1 chat)

`/help` — this message
`/health` — overall project health KPIs (D3)
`/quality [n]` — worst-N models by quality score, default 10 (C3)
`/search <query>` — semantic search over models (B3)
`/sql <question>` [`| dialect=snowflake`] — NL → SQL (B2)
`/docs <model>` — generate schema.yml for a model (A1)
`/undocumented` — list models missing docs (A1)
`/scaffold <brief>` [`| layer=marts mat=table`] — new model from a brief (A2)
`/staging <source> <table>` — staging model from a manifest source (A3)
`/incremental` — list candidates (A4)
`/incremental <model> <ts_column>` — rewrite as incremental (A4)
`/anomaly <model>` — Elementary anomaly tests (C2)
`/lineage <model> <column>` — column-level lineage (D2)
"""


def dispatch(text: str) -> str:
    """Returns a Teams-friendly (markdown) reply for any user text."""
    text = (text or "").strip()
    if not text:
        return HELP

    if not text.startswith("/"):
        return _safe(lambda: chat.ask(text)["answer"])

    parts = _split(text)
    cmd, args = parts[0].lower(), parts[1:]
    handler = COMMANDS.get(cmd)
    if not handler:
        return f"Unknown command `{cmd}`.\n\n{HELP}"
    return _safe(lambda: handler(args, text))


# ---- helpers ---------------------------------------------------------------

def _split(text: str) -> list[str]:
    try:
        return shlex.split(text)
    except ValueError:
        return text.split()


def _safe(fn: Callable[[], str]) -> str:
    try:
        out = fn()
    except Exception as e:
        return f"⚠️ Error: {e}"
    if len(out) > MAX_REPLY_CHARS:
        out = out[:MAX_REPLY_CHARS] + "\n\n…(truncated)"
    return out


def _kv_tail(raw: str) -> dict[str, str]:
    """Pulls `key=value` pairs after a `|` separator. Example:
    `/scaffold daily revenue | layer=marts mat=incremental`"""
    if "|" not in raw:
        return {}
    tail = raw.split("|", 1)[1].strip()
    out: dict[str, str] = {}
    for tok in tail.split():
        if "=" in tok:
            k, v = tok.split("=", 1)
            out[k.strip().lower()] = v.strip()
    return out


def _brief_before_pipe(raw: str, cmd: str) -> str:
    body = raw[len(cmd):].strip()
    return body.split("|", 1)[0].strip()


def _fmt_table(rows: list[dict], cols: list[str], limit: int = 15) -> str:
    if not rows:
        return "_no rows_"
    rows = rows[:limit]
    header = "| " + " | ".join(cols) + " |"
    sep = "| " + " | ".join(["---"] * len(cols)) + " |"
    body = "\n".join(
        "| " + " | ".join(str(r.get(c, ""))[:40] for c in cols) + " |"
        for r in rows
    )
    return "\n".join([header, sep, body])


# ---- command handlers ------------------------------------------------------

def _cmd_help(_args, _raw):
    return HELP


def _cmd_health(_args, _raw):
    h = health.overview()
    if not h.get("total_models"):
        return "No manifest uploaded yet. Use the web UI Settings tab."
    g = h["by_grade"]
    lines = [
        f"**Project health**",
        f"- Models: **{h['total_models']}**  ·  Avg score: **{h['average_score']}**",
        f"- Grades: A {g['A']} · B {g['B']} · C {g['C']} · D {g['D']}",
        f"- Fully documented: {h['fully_documented']}  ·  With tests: {h['models_with_tests']}  ·  Incremental: {h['incremental_models']}",
        "",
        "**Worst offenders**",
        _fmt_table(h["worst_offenders"], ["name", "score", "grade"], limit=10),
    ]
    return "\n".join(lines)


def _cmd_quality(args, _raw):
    n = int(args[0]) if args and args[0].isdigit() else 10
    rows = quality.score_all()[:n]
    return f"**Bottom {len(rows)} by quality score**\n" + _fmt_table(
        rows, ["name", "score", "grade", "documentation_score", "test_score"], limit=n,
    )


def _cmd_search(args, _raw):
    if not args:
        return "Usage: `/search <query>`"
    q = " ".join(args)
    rows = search.search(q, limit=10)
    if not rows:
        return f"No matches for `{q}`."
    return f"**Search:** _{q}_\n" + _fmt_table(
        rows, ["name", "kind", "description", "score"], limit=10,
    )


def _cmd_sql(args, raw):
    if not args:
        return "Usage: `/sql <question>` [`| dialect=snowflake`]"
    kv = _kv_tail(raw)
    question = _brief_before_pipe(raw, "/sql")
    dialect = kv.get("dialect", "snowflake")
    r = nl2sql.translate(question, dialect)
    return f"```sql\n{r['sql']}\n```"


def _cmd_docs(args, _raw):
    if not args:
        return "Usage: `/docs <model_name>`"
    r = docs.generate(args[0])
    return f"```yaml\n{r['yaml']}\n```"


def _cmd_undocumented(_args, _raw):
    rows = docs.list_undocumented()
    if not rows:
        return "🎉 All models are fully documented."
    return f"**Undocumented models** ({len(rows)})\n" + _fmt_table(
        rows, ["name", "column_count", "documented_columns"], limit=20,
    )


def _cmd_scaffold(args, raw):
    if not args:
        return "Usage: `/scaffold <brief>` [`| layer=marts mat=table`]"
    brief = _brief_before_pipe(raw, "/scaffold")
    kv = _kv_tail(raw)
    r = scaffold.generate(brief, kv.get("layer", "marts"), kv.get("mat", "table"))
    return (f"**{r.get('name','model')}.sql**\n```sql\n{r.get('sql','')}\n```\n\n"
            f"**schema.yml**\n```yaml\n{r.get('yaml','')}\n```")


def _cmd_staging(args, _raw):
    if len(args) < 2:
        return "Usage: `/staging <source_name> <table_name>`"
    r = staging.generate(args[0], args[1])
    return (f"**{r.get('name','model')}.sql**\n```sql\n{r.get('sql','')}\n```\n\n"
            f"**schema.yml**\n```yaml\n{r.get('yaml','')}\n```")


def _cmd_incremental(args, _raw):
    if not args:
        rows = incremental.analyze()[:10]
        return "**Top incremental candidates**\n" + _fmt_table(
            rows,
            ["name", "current_materialization", "row_count",
             "incremental_score", "recommend_incremental"],
            limit=10,
        )
    if len(args) < 2:
        return "Usage: `/incremental <model> <ts_column>` [strategy]"
    strategy = args[2] if len(args) > 2 else "merge"
    r = incremental.rewrite(args[0], args[1], strategy)
    return (f"```sql\n{r.get('config_block','')}\n\n{r.get('sql','')}\n```\n\n"
            f"_{r.get('notes','')}_")


def _cmd_anomaly(args, _raw):
    if not args:
        return "Usage: `/anomaly <model_name>`"
    r = anomaly.suggest_for(args[0])
    return f"```yaml\n{r['yaml']}\n```\nRequires the `{r['package_required']}` dbt package."


def _cmd_lineage(args, _raw):
    if len(args) < 2:
        return "Usage: `/lineage <model> <column>`"
    r = lineage.column_lineage(args[0], args[1])
    if r.get("error"):
        return f"⚠️ {r['error']}"
    trail = r.get("trail", [])
    if not trail:
        return f"No lineage trail found for `{args[0]}.{args[1]}`."
    lines = [f"**Column lineage:** `{args[0]}.{args[1]}`"]
    for step in trail:
        srcs = step.get("from") or []
        src_text = ", ".join(f"{t or '?'}.{c}" for t, c in srcs) or "(literal/derived)"
        note = f" — {step['note']}" if step.get("note") else ""
        lines.append(f"- `{step['model']}.{step['column']}` ← {src_text}{note}")
    return "\n".join(lines)


COMMANDS: dict[str, Callable[[list[str], str], str]] = {
    "/help": _cmd_help,
    "/health": _cmd_health,
    "/quality": _cmd_quality,
    "/search": _cmd_search,
    "/sql": _cmd_sql,
    "/nl2sql": _cmd_sql,
    "/docs": _cmd_docs,
    "/undocumented": _cmd_undocumented,
    "/scaffold": _cmd_scaffold,
    "/staging": _cmd_staging,
    "/incremental": _cmd_incremental,
    "/anomaly": _cmd_anomaly,
    "/lineage": _cmd_lineage,
}

"""C2 — Anomaly Detection Tests.

Emits ready-to-paste dbt tests using the elementary-data package
(`elementary.volume_anomalies`, `elementary.freshness_anomalies`,
`elementary.dimension_anomalies`, `elementary.all_columns_anomalies`).

Heuristics decide which tests apply to which model based on its columns.
"""
from __future__ import annotations

from .. import dbt_client


_TS_CANDIDATES = {"created_at", "updated_at", "loaded_at", "event_time",
                  "occurred_at", "_etl_loaded_at", "ingested_at"}
_DIM_HINTS = {"status", "type", "category", "country", "channel", "source",
              "tier", "plan", "segment"}


def suggest_for(model_name: str) -> dict:
    n = dbt_client.find_model(model_name)
    if not n:
        raise ValueError(f"Model {model_name!r} not found.")
    cols = list((n.get("columns") or {}).keys())
    ts_cols = [c for c in cols if c.lower() in _TS_CANDIDATES]
    dim_cols = [c for c in cols if c.lower() in _DIM_HINTS]

    tests: list[str] = []
    tests.append("      - elementary.volume_anomalies")
    if ts_cols:
        tests.append(
            "      - elementary.freshness_anomalies:\n"
            f"          timestamp_column: {ts_cols[0]}"
        )
    for d in dim_cols[:3]:
        tests.append(
            "      - elementary.dimension_anomalies:\n"
            f"          dimensions: ['{d}']"
        )
    tests.append("      - elementary.all_columns_anomalies")

    yaml = (
        f"models:\n"
        f"  - name: {model_name}\n"
        f"    tests:\n" + "\n".join(tests) + "\n"
    )
    return {
        "model": model_name,
        "timestamp_columns": ts_cols,
        "dimension_columns": dim_cols,
        "yaml": yaml,
        "package_required": "elementary-data/elementary",
    }


def suggest_all() -> list[dict]:
    out = []
    for m in dbt_client.models():
        try:
            out.append(suggest_for(m["name"]))
        except Exception:
            continue
    return out

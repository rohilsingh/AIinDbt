"""Read dbt project info from manifest.json (preferred) or dbt Cloud API."""
from __future__ import annotations

from typing import Any
import httpx

from .state import SETTINGS


def all_nodes() -> dict[str, dict[str, Any]]:
    """Returns merged map of node_id -> node from manifest.nodes + manifest.sources."""
    m = SETTINGS.manifest
    if not m:
        return {}
    out: dict[str, dict[str, Any]] = {}
    out.update(m.get("nodes", {}))
    out.update(m.get("sources", {}))
    return out


def models() -> list[dict[str, Any]]:
    return [n for n in all_nodes().values() if n.get("resource_type") == "model"]


def sources() -> list[dict[str, Any]]:
    return [n for n in all_nodes().values() if n.get("resource_type") == "source"]


def find_model(name_or_id: str) -> dict[str, Any] | None:
    nodes = all_nodes()
    if name_or_id in nodes:
        return nodes[name_or_id]
    for n in nodes.values():
        if n.get("name") == name_or_id:
            return n
    return None


def model_summary(node: dict[str, Any]) -> dict[str, Any]:
    """Compact, LLM-friendly view of a model."""
    cols = node.get("columns", {}) or {}
    return {
        "id": node.get("unique_id"),
        "name": node.get("name"),
        "resource_type": node.get("resource_type"),
        "description": node.get("description") or "",
        "schema": node.get("schema"),
        "database": node.get("database"),
        "depends_on": (node.get("depends_on") or {}).get("nodes", []),
        "materialized": (node.get("config") or {}).get("materialized"),
        "columns": {
            c: {
                "description": (cols[c] or {}).get("description", ""),
                "data_type": (cols[c] or {}).get("data_type", ""),
            }
            for c in cols
        },
        "raw_sql": node.get("raw_code") or node.get("raw_sql") or "",
    }


def project_index() -> list[dict[str, Any]]:
    """Cheap searchable index for the chat / search features."""
    out = []
    for n in all_nodes().values():
        if n.get("resource_type") not in ("model", "source", "seed"):
            continue
        cols = n.get("columns", {}) or {}
        out.append({
            "id": n.get("unique_id"),
            "name": n.get("name"),
            "kind": n.get("resource_type"),
            "description": n.get("description") or "",
            "columns": list(cols.keys()),
            "depends_on": (n.get("depends_on") or {}).get("nodes", []),
        })
    return out


# -- dbt Cloud API helpers ---------------------------------------------------


def cloud_get(path: str) -> Any:
    if not SETTINGS.dbt_cloud_token:
        raise RuntimeError("dbt Cloud token not configured.")
    url = f"https://{SETTINGS.dbt_cloud_host}{path}"
    r = httpx.get(
        url,
        headers={"Authorization": f"Token {SETTINGS.dbt_cloud_token}"},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()

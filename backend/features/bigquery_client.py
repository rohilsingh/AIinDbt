"""BigQuery integration — optional. Gracefully unavailable if package not installed."""
from __future__ import annotations

from typing import Any

from ..state import SETTINGS

try:
    from google.cloud import bigquery as _bq
    from google.oauth2 import service_account as _sa
    HAS_BQ = True
except ImportError:
    HAS_BQ = False


def _client():
    if not HAS_BQ:
        raise RuntimeError(
            "google-cloud-bigquery is not installed. "
            "Run: pip install google-cloud-bigquery google-auth"
        )
    if not SETTINGS.bigquery_project_id:
        raise RuntimeError("BigQuery project ID not configured.")
    sa = SETTINGS.bigquery_service_account
    if sa:
        creds = _sa.Credentials.from_service_account_info(
            sa, scopes=["https://www.googleapis.com/auth/bigquery"]
        )
        return _bq.Client(project=SETTINGS.bigquery_project_id, credentials=creds)
    # Fall back to Application Default Credentials
    return _bq.Client(project=SETTINGS.bigquery_project_id)


def test_connection() -> dict[str, Any]:
    client = _client()
    ds = list(client.list_datasets(max_results=3))
    return {
        "ok": True,
        "project": SETTINGS.bigquery_project_id,
        "sample_datasets": [d.dataset_id for d in ds],
    }


def run_query(sql: str, max_rows: int = 500) -> dict[str, Any]:
    client = _client()
    job = client.query(sql)
    result = job.result()
    schema = [{"name": f.name, "type": f.field_type} for f in result.schema]
    rows = []
    for i, row in enumerate(result):
        if i >= max_rows:
            break
        rows.append(dict(row))
    return {
        "schema": schema,
        "rows": rows,
        "total_rows": result.total_rows,
        "truncated": (result.total_rows or 0) > max_rows,
        "bytes_processed": job.total_bytes_processed,
    }

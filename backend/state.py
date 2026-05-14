"""In-memory session state. Nothing is persisted to disk."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Settings:
    llm_api_key: str = ""
    llm_base_url: str = ""        # blank = Anthropic direct
    llm_model: str = "claude-sonnet-4-6"

    # dbt project access — either manifest OR cloud creds
    manifest: dict[str, Any] = field(default_factory=dict)
    catalog: dict[str, Any] = field(default_factory=dict)

    dbt_cloud_host: str = "cloud.getdbt.com"
    dbt_cloud_account_id: str = ""
    dbt_cloud_project_id: str = ""
    dbt_cloud_token: str = ""

    # warehouse (optional, only needed to execute SQL)
    warehouse_type: str = ""      # "snowflake" | "bigquery" | "postgres" | ...
    warehouse_dsn: str = ""       # connection string

    # Slack (optional)
    slack_bot_token: str = ""
    slack_signing_secret: str = ""


SETTINGS = Settings()


def configured() -> dict[str, bool]:
    return {
        "llm": bool(SETTINGS.llm_api_key),
        "manifest": bool(SETTINGS.manifest),
        "dbt_cloud": bool(SETTINGS.dbt_cloud_token and SETTINGS.dbt_cloud_account_id),
        "warehouse": bool(SETTINGS.warehouse_dsn),
        "slack": bool(SETTINGS.slack_bot_token),
    }

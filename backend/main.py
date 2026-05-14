"""AIinDbt FastAPI entrypoint. Wires all features behind /api/* routes and
serves the unified single-page UI from /."""
from __future__ import annotations

import json
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import dbt_client
from .state import SETTINGS, configured
from .features import (
    anomaly, chat, docs, health, incremental, lineage,
    nl2sql, quality, scaffold, search, staging, teams, tests,
)


app = FastAPI(title="AIinDbt")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


# ---- error wrapper ---------------------------------------------------------

@app.exception_handler(Exception)
async def _err(_request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
    return JSONResponse(
        {"error": str(exc), "trace": traceback.format_exc()},
        status_code=500,
    )


# ---- settings --------------------------------------------------------------

class SettingsIn(BaseModel):
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model: str | None = None
    dbt_cloud_host: str | None = None
    dbt_cloud_account_id: str | None = None
    dbt_cloud_project_id: str | None = None
    dbt_cloud_token: str | None = None
    warehouse_type: str | None = None
    warehouse_dsn: str | None = None
    teams_outgoing_secret: str | None = None
    teams_incoming_webhook: str | None = None


@app.get("/api/settings")
def get_settings() -> dict:
    return {
        "llm_base_url": SETTINGS.llm_base_url,
        "llm_model": SETTINGS.llm_model,
        "llm_key_set": bool(SETTINGS.llm_api_key),
        "dbt_cloud_host": SETTINGS.dbt_cloud_host,
        "dbt_cloud_account_id": SETTINGS.dbt_cloud_account_id,
        "dbt_cloud_project_id": SETTINGS.dbt_cloud_project_id,
        "dbt_cloud_token_set": bool(SETTINGS.dbt_cloud_token),
        "warehouse_type": SETTINGS.warehouse_type,
        "warehouse_dsn_set": bool(SETTINGS.warehouse_dsn),
        "teams_outgoing_secret_set": bool(SETTINGS.teams_outgoing_secret),
        "teams_incoming_webhook_set": bool(SETTINGS.teams_incoming_webhook),
        "configured": configured(),
        "manifest_models": len(dbt_client.models()),
    }


@app.post("/api/settings")
def set_settings(s: SettingsIn) -> dict:
    for f, v in s.model_dump(exclude_none=True).items():
        if v != "":
            setattr(SETTINGS, f, v)
    return get_settings()


@app.post("/api/manifest")
async def upload_manifest(file: UploadFile) -> dict:
    raw = await file.read()
    try:
        SETTINGS.manifest = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"manifest is not valid JSON: {e}")
    return {"models": len(dbt_client.models()), "sources": len(dbt_client.sources())}


@app.post("/api/catalog")
async def upload_catalog(file: UploadFile) -> dict:
    raw = await file.read()
    try:
        SETTINGS.catalog = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"catalog is not valid JSON: {e}")
    return {"ok": True}


# ---- A1 docs ---------------------------------------------------------------

class DocsIn(BaseModel):
    model: str


@app.get("/api/docs/undocumented")
def docs_undocumented() -> list[dict]:
    return docs.list_undocumented()


@app.post("/api/docs/generate")
def docs_generate(p: DocsIn) -> dict:
    return docs.generate(p.model)


# ---- A2 scaffold -----------------------------------------------------------

class ScaffoldIn(BaseModel):
    brief: str
    layer: str = "marts"
    materialization: str = "table"


@app.post("/api/scaffold")
def scaffold_endpoint(p: ScaffoldIn) -> dict:
    return scaffold.generate(p.brief, p.layer, p.materialization)


# ---- A3 staging ------------------------------------------------------------

class StagingIn(BaseModel):
    source_name: str
    table_name: str
    columns: list[dict] | None = None


@app.post("/api/staging")
def staging_endpoint(p: StagingIn) -> dict:
    return staging.generate(p.source_name, p.table_name, p.columns)


# ---- A4 incremental --------------------------------------------------------

class RewriteIn(BaseModel):
    model: str
    ts_column: str
    strategy: str = "merge"


@app.get("/api/incremental/analyze")
def incr_analyze() -> list[dict]:
    return incremental.analyze()


@app.post("/api/incremental/rewrite")
def incr_rewrite(p: RewriteIn) -> dict:
    return incremental.rewrite(p.model, p.ts_column, p.strategy)


# ---- B1 chat ---------------------------------------------------------------

class ChatIn(BaseModel):
    question: str


@app.post("/api/chat")
def chat_endpoint(p: ChatIn) -> dict:
    return chat.ask(p.question)


# ---- B2 nl2sql -------------------------------------------------------------

class NL2SQLIn(BaseModel):
    question: str
    dialect: str = "snowflake"


@app.post("/api/nl2sql")
def nl2sql_endpoint(p: NL2SQLIn) -> dict:
    return nl2sql.translate(p.question, p.dialect)


# ---- B3 search -------------------------------------------------------------

@app.get("/api/search")
def search_endpoint(q: str, limit: int = 10) -> list[dict]:
    return search.search(q, limit=limit)


# ---- C1 tests --------------------------------------------------------------

class TestsIn(BaseModel):
    model: str
    csv: str


@app.post("/api/tests/generate")
def tests_endpoint(p: TestsIn) -> dict:
    return tests.generate(p.model, p.csv)


# ---- C2 anomaly ------------------------------------------------------------

@app.get("/api/anomaly/suggest")
def anomaly_suggest(model: str | None = None) -> dict | list[dict]:
    if model:
        return anomaly.suggest_for(model)
    return anomaly.suggest_all()


# ---- C3 quality + D3 health -----------------------------------------------

@app.get("/api/quality")
def quality_endpoint() -> list[dict]:
    return quality.score_all()


@app.get("/api/health")
def health_endpoint() -> dict:
    return health.overview()


# ---- D1 lineage / D2 column lineage ---------------------------------------

@app.get("/api/lineage")
def lineage_endpoint() -> dict:
    return lineage.graph()


@app.get("/api/lineage/column")
def column_lineage_endpoint(model: str, column: str) -> dict:
    return lineage.column_lineage(model, column)


# ---- E2 Microsoft Teams ----------------------------------------------------

@app.post("/api/teams/events")
async def teams_events(request: Request) -> dict:
    return await teams.handle_event(request)


class TeamsTestIn(BaseModel):
    text: str = "Hello from AIinDbt"


@app.post("/api/teams/test")
def teams_test(p: TeamsTestIn) -> dict:
    return teams.test_send(p.text)


# ---- frontend --------------------------------------------------------------

@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

"""AIinDbt FastAPI entrypoint. Wires all features behind /api/* routes and
serves the unified single-page UI from /."""
from __future__ import annotations

import json
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import httpx

from . import dbt_client
from .state import SETTINGS, configured
from .features import (
    anomaly, bigquery_client, chat, docs, export, health, incremental, lineage,
    nl2sql, quality, router, scaffold, search, staging, teams, tests,
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
    gitlab_base_url: str | None = None
    gitlab_token: str | None = None
    gitlab_project: str | None = None
    gitlab_branch: str | None = None


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
        "gitlab_base_url": SETTINGS.gitlab_base_url,
        "gitlab_token_set": bool(SETTINGS.gitlab_token),
        "gitlab_project": SETTINGS.gitlab_project,
        "gitlab_branch": SETTINGS.gitlab_branch,
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


class CommandIn(BaseModel):
    text: str


@app.post("/api/command")
def run_command(p: CommandIn) -> dict:
    """Run a Teams-style slash command from the web UI, no Teams required."""
    return {"reply": router.dispatch(p.text)}


# ---- autocomplete ----------------------------------------------------------

@app.get("/api/models/list")
def models_list() -> dict:
    models_out = [
        {"name": n.get("name"), "kind": "model",
         "schema": n.get("schema"), "materialized": (n.get("config") or {}).get("materialized")}
        for n in dbt_client.models()
    ]
    sources_out = [
        {"name": n.get("name"), "kind": "source",
         "source_name": n.get("source_name"), "schema": n.get("schema")}
        for n in dbt_client.sources()
    ]
    # source tables: unique (source_name, table_name) pairs
    src_tables_out = list({
        (n.get("source_name", ""), n.get("name", "")): {
            "source_name": n.get("source_name", ""),
            "table_name": n.get("name", ""),
            "kind": "source_table",
        }
        for n in dbt_client.sources()
    }.values())
    return {
        "models": models_out,
        "sources": sources_out,
        "source_tables": src_tables_out,
        "all": [m["name"] for m in models_out] + [s["name"] for s in sources_out],
    }


# ---- export ----------------------------------------------------------------

class ExportIn(BaseModel):
    rows: list[dict]
    columns: list[str]
    filename: str = "export"
    sheet: str = "Data"


@app.post("/api/export/excel")
def export_excel(p: ExportIn) -> Response:
    data = export.to_excel(p.rows, p.columns, p.sheet)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{p.filename}.xlsx"'},
    )


# ---- BigQuery --------------------------------------------------------------

class BQQueryIn(BaseModel):
    sql: str
    max_rows: int = 500


@app.post("/api/bigquery/upload-key")
async def bq_upload_key(file: UploadFile) -> dict:
    raw = await file.read()
    try:
        sa = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Service account JSON is invalid: {e}")
    if sa.get("type") != "service_account":
        raise HTTPException(400, "File does not look like a service account JSON (missing 'type': 'service_account').")
    SETTINGS.bigquery_service_account = sa
    SETTINGS.bigquery_project_id = sa.get("project_id", SETTINGS.bigquery_project_id)
    return {"ok": True, "project_id": SETTINGS.bigquery_project_id}


class BQProjectIn(BaseModel):
    project_id: str


@app.post("/api/bigquery/project")
def bq_set_project(p: BQProjectIn) -> dict:
    SETTINGS.bigquery_project_id = p.project_id
    return {"ok": True, "project_id": p.project_id}


@app.post("/api/bigquery/test")
def bq_test() -> dict:
    return bigquery_client.test_connection()


@app.post("/api/bigquery/query")
def bq_query(p: BQQueryIn) -> dict:
    return bigquery_client.run_query(p.sql, p.max_rows)


# ---- SQL optimizer ---------------------------------------------------------

class SqlOptimizeIn(BaseModel):
    sql: str
    vendor: str = "snowflake"


@app.post("/api/sql/optimize")
def sql_optimize(p: SqlOptimizeIn) -> dict:
    import re
    from . import llm as _llm
    prompt = (
        f"You are a {p.vendor} SQL performance expert. Analyze the following dbt SQL model "
        f"and suggest concrete optimizations for {p.vendor}. "
        "Respond ONLY with valid JSON matching exactly this schema:\n"
        '{"issues": [{"severity":"high|medium|low","description":"..."}], '
        '"optimized_sql": "...", '
        '"changes": ["change 1", "change 2"], '
        '"improvement_estimate": "e.g. ~40% faster"}\n\n'
        f"SQL:\n```sql\n{p.sql}\n```"
    )
    raw = _llm.chat(prompt)
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return {"issues": [], "optimized_sql": p.sql, "changes": [], "improvement_estimate": "N/A", "raw": raw}
    try:
        return json.loads(m.group())
    except json.JSONDecodeError:
        return {"issues": [], "optimized_sql": p.sql, "changes": [], "improvement_estimate": "N/A", "raw": raw}


# ---- GitLab ----------------------------------------------------------------

def _gl_headers() -> dict:
    return {"PRIVATE-TOKEN": SETTINGS.gitlab_token, "Content-Type": "application/json"}


def _gl_base() -> str:
    return SETTINGS.gitlab_base_url.rstrip("/")


@app.get("/api/gitlab/branches")
def gitlab_branches() -> list[str]:
    if not SETTINGS.gitlab_token or not SETTINGS.gitlab_project:
        raise HTTPException(400, "GitLab token and project are required")
    encoded = SETTINGS.gitlab_project.replace("/", "%2F")
    url = f"{_gl_base()}/api/v4/projects/{encoded}/repository/branches?per_page=50"
    r = httpx.get(url, headers=_gl_headers(), timeout=10)
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.text[:200])
    return [b["name"] for b in r.json()]


class GitlabPushIn(BaseModel):
    file_path: str        # e.g. "models/marts/fct_orders.sql"
    content: str
    branch: str = ""      # blank = use SETTINGS.gitlab_branch
    commit_message: str = "feat: add generated dbt model via AIinDbt"


@app.post("/api/gitlab/push")
def gitlab_push(p: GitlabPushIn) -> dict:
    if not SETTINGS.gitlab_token or not SETTINGS.gitlab_project:
        raise HTTPException(400, "GitLab token and project are required")
    branch = p.branch or SETTINGS.gitlab_branch or "main"
    encoded_proj = SETTINGS.gitlab_project.replace("/", "%2F")
    encoded_path = p.file_path.replace("/", "%2F")
    base_url = f"{_gl_base()}/api/v4/projects/{encoded_proj}/repository/files/{encoded_path}"

    # try PUT (update) first, then POST (create)
    payload = {
        "branch": branch,
        "content": p.content,
        "commit_message": p.commit_message,
    }
    r = httpx.put(base_url, headers=_gl_headers(), json=payload, timeout=15)
    if r.status_code == 400:  # file doesn't exist
        r = httpx.post(base_url, headers=_gl_headers(), json=payload, timeout=15)
    if r.status_code not in (200, 201):
        raise HTTPException(r.status_code, r.text[:300])
    return {"ok": True, "branch": branch, "file_path": p.file_path}


# ---- frontend --------------------------------------------------------------

@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

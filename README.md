# AIinDbt — Unified AI Copilot for dbt

A single web UI that bundles the best AI features from the dbt open-source
ecosystem. Drop in your **Cline / Anthropic API key** and your **dbt project**
(local `manifest.json` or dbt Cloud creds), and use any of the features below
from one browser tab.

## Features

| Group | Feature | Description |
|-------|---------|-------------|
| A1 | AI Doc Generator | Auto-writes YAML descriptions for undocumented models/columns |
| A2 | Model Scaffolding | Generates a full dbt model (SQL + YAML) from a plain-English brief |
| A3 | Staging Layer Generator | Turns a RAW source table into a clean staging model |
| A4 | Incremental Model Advisor | Detects models that should be incremental and rewrites them |
| B1 | Chat with your dbt Project | Plain-English Q&A using your real model graph |
| B2 | Natural Language → SQL | Business question → runnable warehouse SQL |
| B3 | Semantic Search | RAG over your model docs |
| C1 | AI Test Generator | Generates `schema.yml` tests from sample data |
| C2 | Anomaly Detection Tests | Drops in statistical anomaly tests (row count / freshness / distribution) |
| C3 | Data Quality Scoring | Per-model health score (tests + docs + freshness) |
| D1 | Interactive Lineage Explorer | Drag-and-filter DAG of your project |
| D2 | Column-Level Lineage | Traces columns across models |
| D3 | Model Health Dashboard | Coverage + freshness + test pass rates |
| E2 | Teams Bot | Business users ask data questions in Microsoft Teams |

## Run it

### macOS / Linux

```bash
pip install -r requirements.txt
./run.sh
```

### Windows (Command Prompt)

```cmd
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Windows (PowerShell)

```powershell
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Windows — recommended: use a virtual environment

```cmd
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Then open <http://localhost:8000> in any browser.

> **Python version:** 3.10 or newer required.  
> Download from <https://www.python.org/downloads/> and tick
> **"Add Python to PATH"** during installation.

## Configure

In the **Settings** tab paste:

1. **LLM API key** — your Cline key, Anthropic key, or OpenRouter key
2. **LLM base URL** — leave blank for Anthropic direct, or use your Cline
   gateway URL (e.g. `https://api.cline.bot/v1` or `https://openrouter.ai/api/v1`)
3. **Model** — defaults to `claude-sonnet-4-6`
4. **dbt project** — either:
   - Upload your local `target/manifest.json`, **or**
   - Paste a dbt Cloud account ID, project ID, and service token
5. **(Optional) Warehouse** — to actually *run* generated SQL, paste warehouse
   creds. Without these, B2/C2 will only generate SQL, not execute it.
6. **(Optional) Microsoft Teams** — either:
   - **Outgoing Webhook** HMAC secret (lets users @mention the bot in a Teams
     channel; configure the webhook in Teams to call `POST /api/teams/events`)
   - **Incoming Webhook** URL (lets AIinDbt push messages into a channel)

All settings are kept in-memory on the server for the session and never
persisted to disk.

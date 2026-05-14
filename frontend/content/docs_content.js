export const DOCS_PAGES = [
  // ---- Getting Started ----
  {
    id: "gs-overview", section: "Getting Started", title: "Overview",
    body: `
      <p>AIinDbt is a self-hosted web application that brings AI-powered features directly into your dbt workflow. Run it locally or on a VM — no cloud signup required beyond your existing API keys.</p>
      <h2>What it does</h2>
      <ul>
        <li><b>Documentation generation</b> — auto-writes YAML descriptions for any model or column</li>
        <li><b>Model scaffolding</b> — generates a full dbt model from a plain-English brief</li>
        <li><b>Natural language SQL</b> — ask a business question, get a warehouse-ready query</li>
        <li><b>Test & anomaly coverage</b> — AI-generates schema tests and Elementary anomaly monitors</li>
        <li><b>Lineage & health</b> — interactive DAG, column-level trace, quality scoring</li>
        <li><b>Teams bot</b> — slash commands and freeform Q&A inside Microsoft Teams channels</li>
        <li><b>BigQuery runner</b> — run generated SQL directly against your warehouse</li>
      </ul>
      <h2>Prerequisites</h2>
      <ul>
        <li>Python 3.10+</li>
        <li>A Cline, Anthropic, or OpenRouter API key with Claude access</li>
        <li>A <code>target/manifest.json</code> from your dbt project (<code>dbt parse</code> or <code>dbt docs generate</code>)</li>
      </ul>
    `,
  },
  {
    id: "gs-install", section: "Getting Started", title: "Installation & Running",
    body: `
      <h2>macOS / Linux</h2>
      <pre>pip install -r requirements.txt
./run.sh</pre>
      <h2>Windows (PowerShell or CMD)</h2>
      <p>Use <code>python -m</code> to avoid PATH issues:</p>
      <pre>python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre>
      <p>If <code>python</code> isn't found, use the Windows launcher <code>py</code> instead:</p>
      <pre>py -m pip install -r requirements.txt
py -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre>
      <h2>Recommended: virtual environment (Windows)</h2>
      <pre>py -m venv .venv
.venv\\Scripts\\python -m pip install -r requirements.txt
.venv\\Scripts\\python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre>
      <p>Then open <b>http://localhost:8000</b> in any browser.</p>
      <div class="callout">Settings are stored in memory only — nothing is ever written to disk. Re-enter them after restarting the server.</div>
    `,
  },
  {
    id: "gs-settings", section: "Getting Started", title: "Settings",
    body: `
      <h2>LLM (Cline / Anthropic / OpenRouter)</h2>
      <p>In the <b>Settings</b> panel, paste your API key. The base URL field controls which gateway is used:</p>
      <table><thead><tr><th>Gateway</th><th>Base URL</th><th>Auth header</th></tr></thead><tbody>
        <tr><td>Anthropic direct</td><td>(leave blank)</td><td>x-api-key</td></tr>
        <tr><td>OpenRouter / Cline</td><td>https://openrouter.ai/api/v1</td><td>Bearer</td></tr>
        <tr><td>Self-hosted Ollama</td><td>http://localhost:11434/v1</td><td>Bearer (any)</td></tr>
      </tbody></table>
      <h2>dbt project</h2>
      <p>Either upload <code>target/manifest.json</code> (from <code>dbt parse</code>) or provide dbt Cloud credentials. The manifest unlocks autocomplete, lineage, docs generation, and all model-aware features.</p>
      <h2>Optional: catalog.json</h2>
      <p>Upload <code>target/catalog.json</code> (from <code>dbt docs generate</code>) to enable row-count signals in the Incremental Advisor.</p>
    `,
  },
  // ---- Features ----
  {
    id: "feat-docs", section: "Features", title: "A1 — AI Doc Generator",
    body: `
      <p>Generates a ready-to-paste <code>schema.yml</code> block for any model, including model-level and column-level descriptions.</p>
      <h2>How to use</h2>
      <ol>
        <li>Upload your manifest.json so the tool knows the model's SQL and columns</li>
        <li>Click <b>List undocumented</b> to see which models need attention</li>
        <li>Type a model name in the input field (autocomplete will suggest options)</li>
        <li>Click <b>Generate YAML</b></li>
        <li>Copy the output and paste into your <code>models/schema.yml</code></li>
      </ol>
      <h2>Tips</h2>
      <ul>
        <li>The richer the SQL, the better the descriptions — models with CTEs and meaningful column names produce the best output</li>
        <li>Run on your lowest-scoring models first (see C3 Quality Scores)</li>
      </ul>
    `,
  },
  {
    id: "feat-scaffold", section: "Features", title: "A2 — Model Scaffolding",
    body: `
      <p>Generates a complete new dbt model (SQL + YAML) from a plain-English brief. The model uses <code>ref()</code> and <code>source()</code> calls that match your actual project.</p>
      <h2>How to use</h2>
      <ol>
        <li>Write a brief describing what the model should do (1–3 sentences)</li>
        <li>Choose the target layer (staging / intermediate / marts)</li>
        <li>Choose materialization (table / view / incremental)</li>
        <li>Click <b>Generate</b></li>
        <li>Copy the SQL to <code>models/&lt;layer&gt;/model_name.sql</code> and the YAML to <code>schema.yml</code></li>
      </ol>
      <h2>Example briefs</h2>
      <ul>
        <li><i>Daily revenue by country joining orders and customers, last 90 days</i></li>
        <li><i>Monthly active users grouped by plan tier using events table</i></li>
      </ul>
    `,
  },
  {
    id: "feat-staging", section: "Features", title: "A3 — Staging Generator",
    body: `
      <p>Reads a RAW source table definition and produces a clean <code>stg_*</code> model following the CTE pattern: <code>with source as (...), renamed as (select ...)</code>.</p>
      <h2>How to use</h2>
      <ol>
        <li>Enter the dbt source name (e.g. <code>stripe</code>) and table name (e.g. <code;>charges</code>)</li>
        <li>If the source exists in your manifest, columns are loaded automatically</li>
        <li>Otherwise, paste columns in <code>name,type</code> CSV format (one per line)</li>
        <li>Click <b>Generate</b></li>
      </ol>
      <div class="callout">The generated model renames columns to snake_case and applies sensible type casts. Always review before committing.</div>
    `,
  },
  {
    id: "feat-incremental", section: "Features", title: "A4 — Incremental Advisor",
    body: `
      <p>Scans all models and scores each one on how well it fits an incremental materialization. Then rewrites the chosen model as a proper incremental model.</p>
      <h2>Scoring criteria</h2>
      <ul>
        <li>+1 — currently a table or view (not already incremental)</li>
        <li>+2 — SQL contains a timestamp column (<code>created_at</code>, <code>updated_at</code>, etc.)</li>
        <li>+2 — row count > 1M (requires catalog.json)</li>
      </ul>
      <p>Models scoring ≥ 3 are flagged as recommended candidates.</p>
      <h2>Rewriting</h2>
      <p>Enter the model name, timestamp column, and strategy (merge / append / delete+insert), then click <b>Rewrite</b>. The output includes a <code>{{ config(...) }}</code> block and the full rewritten SQL.</p>
    `,
  },
  {
    id: "feat-chat", section: "Features", title: "B1 — Chat with dbt project",
    body: `
      <p>Ask plain-English questions about your dbt project. The assistant uses your manifest as context — it answers based on your real models, not generic SQL knowledge.</p>
      <h2>What it can answer</h2>
      <ul>
        <li>"Where is monthly active users calculated?"</li>
        <li>"Which models depend on stg_stripe__charges?"</li>
        <li>"Write a query for top 10 customers by LTV"</li>
        <li>"What columns does fct_orders have?"</li>
      </ul>
      <h2>Bookmarks</h2>
      <p>Click 🔖 on any AI response to save it. Open the bookmarks drawer from the top bar to review saved answers. Bookmarks persist in browser localStorage.</p>
    `,
  },
  {
    id: "feat-nl2sql", section: "Features", title: "B2 — Natural Language → SQL",
    body: `
      <p>Translates a business question into runnable warehouse SQL, using your manifest as the schema reference.</p>
      <h2>How to use</h2>
      <ol>
        <li>Type your question in plain English</li>
        <li>Select the SQL dialect (Snowflake, BigQuery, Redshift, Postgres…)</li>
        <li>Click <b>Generate</b></li>
        <li>Review the SQL, then optionally click <b>Run in BigQuery</b> if BigQuery is configured</li>
      </ol>
      <div class="callout warning">Always review generated SQL before running it in production. Check for correct table references and unintended full-table scans.</div>
    `,
  },
  {
    id: "feat-tests", section: "Features", title: "C1 — AI Test Generator",
    body: `
      <p>Generates a <code>schema.yml</code> tests block for a model by analysing a sample of its data.</p>
      <h2>How to use</h2>
      <ol>
        <li>Enter the model name</li>
        <li>Paste a CSV sample (with header row, at least 10 rows for best results)</li>
        <li>Click <b>Generate tests</b></li>
      </ol>
      <p>The tool infers: <code>not_null</code>, <code>unique</code>, <code>accepted_values</code> (if cardinality ≤ 12), and <code>relationships</code> for columns that look like foreign keys.</p>
      <p>Export the sample data from your warehouse with:</p>
      <pre>SELECT * FROM my_model LIMIT 50</pre>
    `,
  },
  {
    id: "feat-anomaly", section: "Features", title: "C2 — Anomaly Detection",
    body: `
      <p>Generates <a href="https://docs.elementary-data.com" target="_blank">Elementary Data</a> anomaly detection tests based on your model's column names.</p>
      <h2>Tests generated</h2>
      <ul>
        <li><b>volume_anomalies</b> — detects unexpected row count changes</li>
        <li><b>freshness_anomalies</b> — flags stale data (requires a timestamp column)</li>
        <li><b>dimension_anomalies</b> — monitors distribution of low-cardinality columns (status, type, country…)</li>
        <li><b>all_columns_anomalies</b> — broad sweep across all columns</li>
      </ul>
      <div class="callout">Requires <code>elementary-data/elementary</code> dbt package. Add it to <code>packages.yml</code> and run <code>dbt deps</code>.</div>
    `,
  },
  {
    id: "feat-quality", section: "Features", title: "C3 — Quality Scoring",
    body: `
      <p>Assigns every model a 0–100 health score based on three dimensions:</p>
      <table><thead><tr><th>Dimension</th><th>Max pts</th><th>What earns points</th></tr></thead><tbody>
        <tr><td>Documentation</td><td>40</td><td>Model description (30%) + column descriptions (70%)</td></tr>
        <tr><td>Tests</td><td>40</td><td>Plateaus at 4 tests per model</td></tr>
        <tr><td>Freshness</td><td>20</td><td>Source freshness config or incremental materialization</td></tr>
      </tbody></table>
      <p>Grades: A ≥ 85, B ≥ 70, C ≥ 50, D &lt; 50.</p>
      <p>Use the <b>Export Excel</b> button to download all scores for stakeholder reporting.</p>
    `,
  },
  {
    id: "feat-lineage", section: "Features", title: "D1 — Lineage Explorer",
    body: `
      <p>Interactive DAG of your entire dbt project. Nodes are colour-coded by layer.</p>
      <h2>Controls</h2>
      <ul>
        <li><b>Search</b> — type a model name to highlight it; other nodes fade out</li>
        <li><b>Zoom in / out / fit</b> — toolbar buttons; also scroll-wheel and trackpad pinch</li>
        <li><b>Physics toggle</b> — enable to let the graph auto-arrange; disable to freeze positions</li>
        <li><b>Click a node</b> — shows a detail panel with kind, schema, materialization, and description</li>
        <li><b>Drag</b> — pan the canvas; drag a node to reposition it</li>
      </ul>
      <h2>Colour legend</h2>
      <ul>
        <li>🟡 Source, 🟣 Seed, 🔵 Staging, 🟢 Intermediate, 🔴 Marts / Fact / Dim</li>
      </ul>
    `,
  },
  {
    id: "feat-collineage", section: "Features", title: "D2 — Column Lineage",
    body: `
      <p>Traces where a specific column came from across the upstream model chain. Uses sqlglot to parse SQL and walk dependencies.</p>
      <h2>How to use</h2>
      <ol>
        <li>Enter the model name (autocomplete available)</li>
        <li>Enter the column name exactly as it appears in the model</li>
        <li>Click <b>Trace</b></li>
      </ol>
      <p>The result shows each step in the lineage: <code>model.column ← upstream_model.source_column</code>.</p>
      <div class="callout warning">Column lineage is best-effort — Jinja templating limits what can be parsed statically. Complex macros may not resolve fully.</div>
    `,
  },
  // ---- Integrations ----
  {
    id: "int-teams", section: "Integrations", title: "Microsoft Teams Setup",
    body: `
      <p>Connect AIinDbt to a Teams channel so your team can use slash commands and natural language queries without opening the web UI.</p>
      <h2>Option A — Outgoing Webhook (users @mention the bot)</h2>
      <div class="setup-step">
        <div class="step-num">1</div>
        <div class="step-body">
          <div class="step-title">Open Teams channel settings</div>
          <div class="step-desc">Go to the channel → click <b>⋯</b> (More options) → <b>Connectors</b> → <b>Outgoing Webhooks</b>.</div>
        </div>
      </div>
      <div class="setup-step">
        <div class="step-num">2</div>
        <div class="step-body">
          <div class="step-title">Create the webhook</div>
          <div class="step-desc">Give it a name (e.g. <b>AIinDbt</b>), set the <b>Callback URL</b> to your server: <code>https://&lt;your-host&gt;/api/teams/events</code>. If running locally, use a tunnel like <a href="https://ngrok.com" target="_blank">ngrok</a>: <code>ngrok http 8000</code>.</div>
        </div>
      </div>
      <div class="setup-step">
        <div class="step-num">3</div>
        <div class="step-body">
          <div class="step-title">Copy the HMAC secret</div>
          <div class="step-desc">Teams shows a base64 HMAC secret after you create the webhook. Paste it into <b>Settings → Outgoing Webhook HMAC secret</b>.</div>
        </div>
      </div>
      <div class="setup-step">
        <div class="step-num">4</div>
        <div class="step-body">
          <div class="step-title">Test it</div>
          <div class="step-desc">In the channel, type <code>@AIinDbt /help</code>. You should get a command list back within a few seconds.</div>
        </div>
      </div>
      <h2>Option B — Incoming Webhook (push messages from the app)</h2>
      <div class="setup-step">
        <div class="step-num">1</div>
        <div class="step-body">
          <div class="step-title">Add Incoming Webhook connector</div>
          <div class="step-desc">Channel → <b>⋯</b> → <b>Connectors</b> → search for <b>Incoming Webhook</b> → Configure.</div>
        </div>
      </div>
      <div class="setup-step">
        <div class="step-num">2</div>
        <div class="step-body">
          <div class="step-title">Copy the webhook URL</div>
          <div class="step-desc">Paste the full URL (starts with <code>https://outlook.office.com/webhook/…</code>) into <b>Settings → Incoming Webhook URL</b>.</div>
        </div>
      </div>
      <div class="setup-step">
        <div class="step-num">3</div>
        <div class="step-body">
          <div class="step-title">Send a test message</div>
          <div class="step-desc">Go to the <b>Teams</b> tab, enter a message in <b>Push to channel</b>, and click Send.</div>
        </div>
      </div>
      <h2>Available commands</h2>
      <p>Type these in any channel where the bot is configured (or use the web UI's Teams tab to preview without Teams):</p>
      <table><thead><tr><th>Command</th><th>Feature</th></tr></thead><tbody>
        <tr><td><code>/help</code></td><td>List all commands</td></tr>
        <tr><td><code>/health</code></td><td>Project health KPIs (D3)</td></tr>
        <tr><td><code>/quality [n]</code></td><td>Bottom-N quality scores (C3)</td></tr>
        <tr><td><code>/search &lt;query&gt;</code></td><td>Semantic search (B3)</td></tr>
        <tr><td><code>/sql &lt;question&gt;</code></td><td>NL → SQL (B2)</td></tr>
        <tr><td><code>/docs &lt;model&gt;</code></td><td>Generate YAML (A1)</td></tr>
        <tr><td><code>/scaffold &lt;brief&gt;</code></td><td>New model (A2)</td></tr>
        <tr><td><code>/staging &lt;src&gt; &lt;table&gt;</code></td><td>Staging model (A3)</td></tr>
        <tr><td><code>/incremental</code></td><td>Candidate list (A4)</td></tr>
        <tr><td><code>/anomaly &lt;model&gt;</code></td><td>Anomaly tests (C2)</td></tr>
        <tr><td><code>/lineage &lt;model&gt; &lt;col&gt;</code></td><td>Column lineage (D2)</td></tr>
        <tr><td><i>(anything else)</i></td><td>Chat with project (B1)</td></tr>
      </tbody></table>
    `,
  },
  {
    id: "int-bigquery", section: "Integrations", title: "BigQuery Setup",
    body: `
      <p>Connect a BigQuery project to run SQL queries directly from the app (useful after generating NL→SQL).</p>
      <h2>Step 1 — Create a service account</h2>
      <ol>
        <li>Open <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank">Google Cloud Console → Service Accounts</a></li>
        <li>Click <b>Create Service Account</b></li>
        <li>Grant the role <b>BigQuery Data Viewer</b> + <b>BigQuery Job User</b></li>
        <li>Click <b>Keys → Add key → JSON</b> — this downloads a <code>.json</code> file</li>
      </ol>
      <h2>Step 2 — Upload the key</h2>
      <p>In the <b>BigQuery</b> panel, use the <b>Upload service account JSON</b> button. The project ID is auto-read from the file.</p>
      <h2>Step 3 — Test and run</h2>
      <p>Click <b>Test connection</b> — it lists your first few datasets. Then paste or generate SQL and click <b>Run query</b>.</p>
      <div class="callout warning">Results are capped at 500 rows by default. Queries are billed to your GCP project. Always check the estimated bytes before running large queries.</div>
      <h2>Alternative: Application Default Credentials</h2>
      <p>If AIinDbt runs on GCP (Cloud Run, GCE, etc.) or you've run <code>gcloud auth application-default login</code>, set the project ID in Settings and leave the service account blank — the SDK will use ADC automatically.</p>
    `,
  },
  // ---- Troubleshooting ----
  {
    id: "trbl-common", section: "Troubleshooting", title: "Common Issues",
    body: `
      <h2>LLM API key errors</h2>
      <p><b>401 / "invalid api key"</b> — re-check the key in Settings. For Cline/OpenRouter, make sure the Base URL is set to the gateway URL.</p>
      <p><b>Model not found</b> — verify the model name matches exactly what the gateway expects (e.g. <code>anthropic/claude-sonnet-4-6</code> on OpenRouter vs <code>claude-sonnet-4-6</code> on Anthropic direct).</p>
      <h2>Manifest not loading</h2>
      <p>Run <code>dbt parse</code> (fast) or <code>dbt docs generate</code> and upload <code>target/manifest.json</code>. The file can be large (10–50 MB for big projects) — be patient on upload.</p>
      <h2>Lineage is empty</h2>
      <p>The lineage panel needs a manifest. Check the status dots in the sidebar — the "Project" dot should be green.</p>
      <h2>Teams bot not responding</h2>
      <p>Check that your server is publicly reachable. Use ngrok for local testing: <code>ngrok http 8000</code>. The HMAC secret must be exact (copy from Teams, base64 encoded).</p>
      <h2>BigQuery query fails</h2>
      <p>Ensure the service account has <b>BigQuery Job User</b> + <b>BigQuery Data Viewer</b> roles. For cross-project queries, the service account also needs access to the source project.</p>
      <h2>Windows: uvicorn not found</h2>
      <p>Use <code>python -m uvicorn</code> instead of <code>uvicorn</code> directly. See the Installation page for full commands.</p>
    `,
  },
];

// ============================================================
// app.js — boot, routing, API helper, feature wiring
// ============================================================
import { toast, esc, examplesBar, kpiCard, codeBlock, gradeBadge, spinner } from "./components/ui.js";
import { DataTable } from "./components/table_tools.js";
import { attachAutocomplete, warmCache } from "./components/autocomplete.js";
import { ChatPanel, renderBookmarksDrawer, toggleBookmarksDrawer } from "./components/chat_panel.js";
import { LineageViewer } from "./components/lineage_viewer.js";
import { DocsViewer } from "./components/docs_viewer.js";

// ============================================================
// API helper
// ============================================================
async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: opts.body && !(opts.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {},
    ...opts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
const $ = id => document.getElementById(id);

// ============================================================
// Sidebar routing
// ============================================================
function show(panelId) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".sidebar-item").forEach(i => i.classList.remove("active"));
  const panel = $(`panel-${panelId}`);
  if (panel) panel.classList.add("active");
  const item = document.querySelector(`.sidebar-item[data-panel="${panelId}"]`);
  if (item) item.classList.add("active");
  const sub = document.querySelector(`.topbar-subtitle`);
  if (sub && item) sub.textContent = item.querySelector(".label")?.textContent || "";
  // close mobile sidebar
  document.getElementById("sidebar")?.classList.remove("open");
}

document.querySelectorAll(".sidebar-item[data-panel]").forEach(item =>
  item.addEventListener("click", () => show(item.dataset.panel))
);

$("hamburger")?.addEventListener("click", () =>
  document.getElementById("sidebar")?.classList.toggle("open")
);
$("open-bookmarks")?.addEventListener("click", toggleBookmarksDrawer);
$("close-bookmarks")?.addEventListener("click", toggleBookmarksDrawer);

// ============================================================
// Status bar
// ============================================================
async function loadStatus() {
  try {
    const s = await api("/api/settings");
    const cfg = s.configured || {};
    const dots = [
      ["LLM", cfg.llm], ["Project", cfg.manifest || cfg.dbt_cloud],
      ["BigQuery", cfg.bigquery], ["Teams", cfg.teams],
    ];
    const row = $("status-row");
    if (row) row.innerHTML = dots.map(([l, ok]) =>
      `<span class="status-dot ${ok ? "ok" : ""}">${l}</span>`
    ).join("");
    if (s.manifest_models) {
      const badge = document.querySelector('.sidebar-item[data-panel="lineage"] .badge');
      if (badge) badge.textContent = s.manifest_models;
    }
    // pre-fill visible settings fields (non-secret)
    _setIfEl("llm_base_url", s.llm_base_url || "");
    _setIfEl("llm_model", s.llm_model || "");
    _setIfEl("dbt_cloud_host", s.dbt_cloud_host || "");
    _setIfEl("dbt_cloud_account_id", s.dbt_cloud_account_id || "");
    _setIfEl("dbt_cloud_project_id", s.dbt_cloud_project_id || "");
    _setIfEl("bq_project_id", s.bigquery_project_id || "");
    _setIfEl("teams_url_display", `${location.origin}/api/teams/events`);
  } catch (_) {}
  warmCache();
}
function _setIfEl(id, val) { const el = $(id); if (el) el.value = val; }
loadStatus();

// ============================================================
// SETTINGS
// ============================================================
$("save-settings")?.addEventListener("click", async () => {
  try {
    const body = {
      llm_api_key: $("llm_api_key")?.value || undefined,
      llm_base_url: $("llm_base_url")?.value,
      llm_model: $("llm_model")?.value || undefined,
      dbt_cloud_host: $("dbt_cloud_host")?.value || undefined,
      dbt_cloud_account_id: $("dbt_cloud_account_id")?.value || undefined,
      dbt_cloud_project_id: $("dbt_cloud_project_id")?.value || undefined,
      dbt_cloud_token: $("dbt_cloud_token")?.value || undefined,
      teams_outgoing_secret: $("teams_outgoing_secret")?.value || undefined,
      teams_incoming_webhook: $("teams_incoming_webhook")?.value || undefined,
    };
    await api("/api/settings", { method: "POST", body: JSON.stringify(body) });
    for (const [field, path] of [["manifest_file", "/api/manifest"], ["catalog_file", "/api/catalog"]]) {
      const file = $(field)?.files[0];
      if (file) {
        const fd = new FormData(); fd.append("file", file);
        const r = await fetch(path, { method: "POST", body: fd });
        if (!r.ok) { toast(`Upload failed for ${field}`, "error"); continue; }
        toast(`${field} uploaded`, "success");
      }
    }
    await loadStatus();
    toast("Settings saved", "success");
  } catch (e) { toast("Save failed: " + e.message, "error"); }
});

// ============================================================
// HEALTH — D3
// ============================================================
$("load-health")?.addEventListener("click", loadHealth);
async function loadHealth() {
  try {
    const h = await api("/api/health");
    if (!h.total_models) { $("health_kpis").innerHTML = `<p style="color:#94a3b8">Upload a manifest first.</p>`; return; }
    const g = h.by_grade || {};
    const gradeColor = { A: "#15803d", B: "#1d4ed8", C: "#b45309", D: "#dc2626" };
    $("health_kpis").innerHTML = `<div class="kpi-grid">
      ${kpiCard(h.total_models, "Total Models")}
      ${kpiCard(h.average_score, "Avg Score")}
      ${kpiCard(h.fully_documented, "Fully Documented")}
      ${kpiCard(h.models_with_tests, "With Tests")}
      ${kpiCard(h.incremental_models, "Incremental")}
      ${kpiCard(g.A || 0, "Grade A", gradeColor.A)}
      ${kpiCard(g.B || 0, "Grade B", gradeColor.B)}
      ${kpiCard(g.C || 0, "Grade C", gradeColor.C)}
      ${kpiCard(g.D || 0, "Grade D", gradeColor.D)}
    </div>`;
    healthWorstTable.load(h.worst_offenders || []);
    healthTopTable.load([...(h.top_performers || [])].reverse());
  } catch (e) { toast(e.message, "error"); }
}
const healthWorstTable = new DataTable("health-worst-table", {
  exportName: "health-worst",
  columns: [
    { key: "name", label: "Model" },
    { key: "score", label: "Score" },
    { key: "grade", label: "Grade", render: v => gradeBadge(v) },
    { key: "documentation_score", label: "Docs" },
    { key: "test_score", label: "Tests" },
    { key: "freshness_score", label: "Freshness" },
  ],
});
const healthTopTable = new DataTable("health-top-table", {
  exportName: "health-top",
  columns: [
    { key: "name", label: "Model" },
    { key: "score", label: "Score" },
    { key: "grade", label: "Grade", render: v => gradeBadge(v) },
    { key: "documentation_score", label: "Docs" },
    { key: "test_score", label: "Tests" },
  ],
});

// ============================================================
// QUALITY — C3
// ============================================================
$("load-quality")?.addEventListener("click", async () => {
  try {
    const rows = await api("/api/quality");
    qualityTable.load(rows);
  } catch (e) { toast(e.message, "error"); }
});
const qualityTable = new DataTable("quality-table", {
  exportName: "dbt-quality-scores",
  columns: [
    { key: "name", label: "Model" },
    { key: "score", label: "Score" },
    { key: "grade", label: "Grade", render: v => gradeBadge(v) },
    { key: "documentation_score", label: "Docs (40)" },
    { key: "test_score", label: "Tests (40)" },
    { key: "freshness_score", label: "Fresh (20)" },
    { key: "materialized", label: "Materialization" },
  ],
});

// ============================================================
// LINEAGE — D1
// ============================================================
const lineageViewer = new LineageViewer("lineage-net", "lineage-detail");
$("load-lineage")?.addEventListener("click", async () => {
  try {
    const g = await api("/api/lineage");
    lineageViewer.load(g);
    toast(`Loaded ${g.nodes.length} nodes`, "success");
  } catch (e) { toast(e.message, "error"); }
});
$("lineage-search")?.addEventListener("input", e => lineageViewer.search(e.target.value));
$("lineage-fit")?.addEventListener("click", () => lineageViewer.fitView());
$("lineage-zoomin")?.addEventListener("click", () => lineageViewer.zoomIn());
$("lineage-zoomout")?.addEventListener("click", () => lineageViewer.zoomOut());
$("lineage-physics")?.addEventListener("change", e => lineageViewer.setPhysics(e.target.checked));

// ============================================================
// COLUMN LINEAGE — D2
// ============================================================
$("run-collineage")?.addEventListener("click", async () => {
  const model = $("col_model")?.value.trim();
  const col = $("col_column")?.value.trim();
  if (!model || !col) { toast("Enter model and column", "error"); return; }
  try {
    const r = await api(`/api/lineage/column?model=${encodeURIComponent(model)}&column=${encodeURIComponent(col)}`);
    const trail = r.trail || [];
    if (!trail.length) { $("col_out").textContent = "No lineage trail found."; return; }
    const lines = trail.map(step => {
      const srcs = (step.from || []).map(([t, c]) => `${t || "?"}.${c}`).join(", ") || "(literal/derived)";
      const note = step.note ? ` — ${step.note}` : "";
      return `${step.model}.${step.column}  ←  ${srcs}${note}`;
    });
    $("col_out").textContent = lines.join("\n");
  } catch (e) { toast(e.message, "error"); }
});
attachAutocomplete($("col_model"), { filterKind: "model" });

// ============================================================
// SEARCH — B3
// ============================================================
_addExamples("search-examples", [
  "monthly revenue", "customer lifetime value", "active users", "orders by country",
], v => { if ($("search_q")) $("search_q").value = v; });
$("run-search")?.addEventListener("click", async () => {
  const q = $("search_q")?.value.trim();
  if (!q) return;
  try {
    const rows = await api(`/api/search?q=${encodeURIComponent(q)}&limit=20`);
    searchTable.load(rows);
  } catch (e) { toast(e.message, "error"); }
});
const searchTable = new DataTable("search-table", {
  exportName: "search-results",
  columns: [
    { key: "name", label: "Model" },
    { key: "kind", label: "Kind" },
    { key: "description", label: "Description" },
    { key: "score", label: "Score" },
  ],
});

// ============================================================
// CHAT — B1
// ============================================================
_addExamples("chat-examples", [
  "Where is monthly active users calculated?",
  "Which models depend on stg_stripe__charges?",
  "What columns does fct_orders have?",
  "How is revenue defined?",
], v => { if ($("chat_input")) { $("chat_input").value = v; } });
const chatPanel = new ChatPanel("chat-history", "chat_input", "chat_send");
chatPanel.onSend(async q => api("/api/chat", { method: "POST", body: JSON.stringify({ question: q }) }));

// ============================================================
// NL2SQL — B2
// ============================================================
_addExamples("nl2sql-examples", [
  "Top 10 customers by revenue last quarter",
  "Monthly active users by country",
  "Churn rate by plan tier",
  "Average order value by product category",
], v => { if ($("nl_q")) $("nl_q").value = v; });
$("run-nl2sql")?.addEventListener("click", async () => {
  const q = $("nl_q")?.value.trim();
  if (!q) return;
  try {
    const r = await api("/api/nl2sql", { method: "POST", body: JSON.stringify({ question: q, dialect: $("nl_dialect")?.value || "snowflake" }) });
    $("nl_out").textContent = r.sql;
    // show BigQuery run button if configured
    const bqBtn = $("nl-run-bq");
    if (bqBtn) { bqBtn.style.display = "inline-flex"; bqBtn.dataset.sql = r.sql; }
  } catch (e) { toast(e.message, "error"); }
});
$("nl-run-bq")?.addEventListener("click", async function () {
  const sql = this.dataset.sql;
  if (!sql) return;
  try {
    const r = await api("/api/bigquery/query", { method: "POST", body: JSON.stringify({ sql }) });
    renderBQResult("nl-bq-result", r);
  } catch (e) { toast(e.message, "error"); }
});

// ============================================================
// DOCS — A1
// ============================================================
$("load-undocumented")?.addEventListener("click", async () => {
  try {
    const rows = await api("/api/docs/undocumented");
    undocTable.load(rows);
  } catch (e) { toast(e.message, "error"); }
});
const undocTable = new DataTable("undoc-table", {
  exportName: "undocumented-models",
  columns: [
    { key: "name", label: "Model" },
    { key: "description", label: "Current description" },
    { key: "column_count", label: "Columns" },
    { key: "documented_columns", label: "Documented" },
  ],
});
attachAutocomplete($("doc_model"), { filterKind: "model" });
$("run-docs")?.addEventListener("click", async () => {
  const model = $("doc_model")?.value.trim();
  if (!model) return;
  $("doc_out").innerHTML = spinner() + " Generating…";
  try {
    const r = await api("/api/docs/generate", { method: "POST", body: JSON.stringify({ model }) });
    $("doc_out").innerHTML = codeBlock(r.yaml, "yaml");
  } catch (e) { toast(e.message, "error"); $("doc_out").textContent = ""; }
});

// ============================================================
// SCAFFOLD — A2
// ============================================================
_addExamples("scaffold-examples", [
  "Daily revenue by country joining orders and customers",
  "Monthly active users grouped by plan tier",
  "Cohort retention table from events",
  "Inventory levels by warehouse and SKU",
], v => { if ($("scaf_brief")) $("scaf_brief").value = v; });
$("run-scaffold")?.addEventListener("click", async () => {
  const brief = $("scaf_brief")?.value.trim();
  if (!brief) return;
  $("scaf_out").innerHTML = spinner() + " Generating…";
  try {
    const r = await api("/api/scaffold", { method: "POST", body: JSON.stringify({
      brief, layer: $("scaf_layer")?.value, materialization: $("scaf_mat")?.value,
    }) });
    $("scaf_out").innerHTML = `
      <div class="card"><div class="card-title">${esc(r.name)}.sql</div>${codeBlock(r.sql, "sql")}</div>
      <div class="card"><div class="card-title">schema.yml</div>${codeBlock(r.yaml, "yaml")}</div>`;
  } catch (e) { toast(e.message, "error"); $("scaf_out").textContent = ""; }
});

// ============================================================
// STAGING — A3
// ============================================================
_addExamples("staging-examples", [
  "stripe · charges", "salesforce · accounts", "postgres · users", "shopify · orders",
], v => {
  const [src, tbl] = v.split("·").map(s => s.trim());
  if ($("stg_src")) $("stg_src").value = src;
  if ($("stg_tbl")) $("stg_tbl").value = tbl;
});
attachAutocomplete($("stg_src"), { filterKind: "source" });
$("run-staging")?.addEventListener("click", async () => {
  const raw = $("stg_cols")?.value.trim();
  let columns = null;
  if (raw) {
    columns = raw.split("\n").map(l => {
      const [name, type = ""] = l.split(",").map(s => s.trim());
      return { name, type };
    }).filter(c => c.name);
  }
  $("stg_out").innerHTML = spinner() + " Generating…";
  try {
    const r = await api("/api/staging", { method: "POST", body: JSON.stringify({
      source_name: $("stg_src")?.value, table_name: $("stg_tbl")?.value, columns,
    }) });
    $("stg_out").innerHTML = `
      <div class="card"><div class="card-title">${esc(r.name)}.sql</div>${codeBlock(r.sql, "sql")}</div>
      <div class="card"><div class="card-title">schema.yml</div>${codeBlock(r.yaml, "yaml")}</div>`;
  } catch (e) { toast(e.message, "error"); $("stg_out").textContent = ""; }
});

// ============================================================
// INCREMENTAL — A4
// ============================================================
$("load-incr-analyze")?.addEventListener("click", async () => {
  try { const rows = await api("/api/incremental/analyze"); incrTable.load(rows); }
  catch (e) { toast(e.message, "error"); }
});
const incrTable = new DataTable("incr-table", {
  exportName: "incremental-candidates",
  columns: [
    { key: "name", label: "Model" },
    { key: "current_materialization", label: "Materialization" },
    { key: "row_count", label: "Row count" },
    { key: "incremental_score", label: "Score" },
    { key: "recommend_incremental", label: "Recommended", render: v => v ? "✅ Yes" : "—" },
  ],
});
attachAutocomplete($("incr_model"), { filterKind: "model" });
$("run-incr-rewrite")?.addEventListener("click", async () => {
  const model = $("incr_model")?.value.trim();
  if (!model) return;
  $("incr_out").innerHTML = spinner() + " Rewriting…";
  try {
    const r = await api("/api/incremental/rewrite", { method: "POST", body: JSON.stringify({
      model, ts_column: $("incr_ts")?.value, strategy: $("incr_strategy")?.value,
    }) });
    $("incr_out").innerHTML = `
      <div class="card">${codeBlock((r.config_block || "") + "\n\n" + (r.sql || ""), "sql")}</div>
      <p style="color:#64748b;font-size:.85rem;margin-top:.5rem">${esc(r.notes || "")}</p>`;
  } catch (e) { toast(e.message, "error"); $("incr_out").textContent = ""; }
});

// ============================================================
// TESTS — C1
// ============================================================
_addExamples("tests-examples", [
  "dim_customers · id,email,status,created_at",
  "fct_orders · order_id,customer_id,amount,status",
], v => {
  const [model, cols] = v.split("·").map(s => s.trim());
  if ($("test_model")) $("test_model").value = model;
  if ($("test_csv")) $("test_csv").value = cols.split(",").join(",") + "\n(paste your CSV sample below)";
});
attachAutocomplete($("test_model"), { filterKind: "model" });
$("run-tests")?.addEventListener("click", async () => {
  const model = $("test_model")?.value.trim();
  const csv = $("test_csv")?.value.trim();
  if (!model || !csv) { toast("Enter model name and CSV sample", "error"); return; }
  $("test_out").textContent = "Generating…";
  try {
    const r = await api("/api/tests/generate", { method: "POST", body: JSON.stringify({ model, csv }) });
    $("test_out").innerHTML = codeBlock(r.yaml, "yaml");
  } catch (e) { toast(e.message, "error"); $("test_out").textContent = ""; }
});

// ============================================================
// ANOMALY — C2
// ============================================================
attachAutocomplete($("anom_model"), { filterKind: "model" });
$("run-anomaly")?.addEventListener("click", async () => {
  const m = $("anom_model")?.value.trim();
  try {
    const r = await api(`/api/anomaly/suggest${m ? "?model=" + encodeURIComponent(m) : ""}`);
    const items = Array.isArray(r) ? r : [r];
    $("anom_out").innerHTML = items.map(x =>
      `<div class="card"><div class="card-title">${esc(x.model)}</div>
       ${codeBlock(x.yaml, "yaml")}
       <p style="font-size:.78rem;color:#64748b;margin-top:.5rem">Requires: <code>${x.package_required}</code></p></div>`
    ).join("");
  } catch (e) { toast(e.message, "error"); }
});

// ============================================================
// TEAMS — E2
// ============================================================
_addExamples("cmd-examples", [
  "/help", "/health", "/quality 5", "/sql top customers by revenue",
  "/docs dim_customers", "/anomaly fct_orders",
], v => { if ($("cmd_in")) $("cmd_in").value = v; });
$("run-command")?.addEventListener("click", async () => {
  const text = $("cmd_in")?.value.trim();
  if (!text) return;
  $("cmd_out").textContent = "Running…";
  try {
    const r = await api("/api/command", { method: "POST", body: JSON.stringify({ text }) });
    $("cmd_out").textContent = r.reply;
  } catch (e) { toast(e.message, "error"); }
});
$("run-teams-test")?.addEventListener("click", async () => {
  const text = $("tm_txt")?.value;
  try {
    const r = await api("/api/teams/test", { method: "POST", body: JSON.stringify({ text }) });
    $("tm_out").textContent = JSON.stringify(r, null, 2);
  } catch (e) { toast(e.message, "error"); }
});

// ============================================================
// BIGQUERY
// ============================================================
$("bq-upload-key")?.addEventListener("click", async () => {
  const file = $("bq_key_file")?.files[0];
  if (!file) { toast("Select a service account JSON file", "error"); return; }
  const fd = new FormData(); fd.append("file", file);
  try {
    const r = await fetch("/api/bigquery/upload-key", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    _setIfEl("bq_project_id", d.project_id || "");
    toast("Service account uploaded — project: " + d.project_id, "success");
    await loadStatus();
  } catch (e) { toast(e.message, "error"); }
});
$("bq-set-project")?.addEventListener("click", async () => {
  const pid = $("bq_project_id")?.value.trim();
  if (!pid) return;
  try {
    await api("/api/bigquery/project", { method: "POST", body: JSON.stringify({ project_id: pid }) });
    toast("Project ID saved", "success");
    await loadStatus();
  } catch (e) { toast(e.message, "error"); }
});
$("bq-test")?.addEventListener("click", async () => {
  try {
    const r = await api("/api/bigquery/test", { method: "POST", body: "{}" });
    $("bq_status").textContent = `✅ Connected to ${r.project} — datasets: ${r.sample_datasets?.join(", ")}`;
    $("bq_status").style.color = "#15803d";
  } catch (e) {
    $("bq_status").textContent = "❌ " + e.message;
    $("bq_status").style.color = "#dc2626";
  }
});
_addExamples("bq-examples", [
  "SELECT * FROM `project.dataset.table` LIMIT 100",
  "SELECT DATE(created_at), COUNT(*) as n FROM orders GROUP BY 1 ORDER BY 1 DESC",
], v => { if ($("bq_sql")) $("bq_sql").value = v; });
$("run-bq-query")?.addEventListener("click", async () => {
  const sql = $("bq_sql")?.value.trim();
  if (!sql) return;
  $("bq_result").innerHTML = spinner() + " Running…";
  try {
    const r = await api("/api/bigquery/query", { method: "POST", body: JSON.stringify({ sql }) });
    renderBQResult("bq_result", r);
  } catch (e) { toast(e.message, "error"); $("bq_result").innerHTML = ""; }
});

function renderBQResult(containerId, r) {
  const el = $(containerId);
  if (!el) return;
  const cols = (r.schema || []).map(f => ({ key: f.name, label: `${f.name} (${f.type})` }));
  const infoHtml = `<div class="bq-result-info">
    <span>Rows: <strong>${r.rows?.length ?? 0}${r.truncated ? "+" : ""}</strong></span>
    ${r.bytes_processed ? `<span>Scanned: <strong>${(r.bytes_processed / 1e6).toFixed(1)} MB</strong></span>` : ""}
    ${r.truncated ? `<span style="color:#b45309">⚠ Results truncated</span>` : ""}
  </div>`;
  const tableId = `bq-tbl-${Date.now()}`;
  el.innerHTML = infoHtml + `<div id="${tableId}"></div>`;
  const tbl = new DataTable(tableId, { columns: cols, exportName: "bigquery-result" });
  tbl.load(r.rows || []);
}
window.renderBQResult = renderBQResult;

// ============================================================
// DOCS VIEWER
// ============================================================
new DocsViewer("docs-sidebar-nav", "docs-content-area", "docs-search");

// ============================================================
// Helper: inject examples bar into a container
// ============================================================
function _addExamples(containerId, examples, onPick) {
  const el = $(containerId);
  if (!el) return;
  el.appendChild(examplesBar(examples, onPick));
}

// Start on health panel
show("health");
loadHealth();

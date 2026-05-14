// ---- tab routing -----------------------------------------------------------
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

function show(tab) {
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  panels.forEach(p => p.classList.toggle("hidden", p.dataset.panel !== tab));
}
tabs.forEach(t => t.addEventListener("click", () => show(t.dataset.tab)));
show("settings");

// ---- helpers ---------------------------------------------------------------
async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
const $ = id => document.getElementById(id);
const esc = s => (s ?? "").toString()
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderStatus(cfg) {
  const items = [
    ["LLM", cfg.llm], ["Project", cfg.manifest || cfg.dbt_cloud],
    ["Warehouse", cfg.warehouse], ["Teams", cfg.teams],
  ];
  $("status-pill").innerHTML = items.map(([k, v]) =>
    `<span class="${v ? 'ok' : 'bad'} text-white">${k} ${v ? '✓' : '✗'}</span>`
  ).join("");
}

async function loadStatus() {
  const s = await api("/api/settings");
  $("llm_base_url").value = s.llm_base_url || "";
  $("llm_model").value = s.llm_model || "";
  $("dbt_cloud_host").value = s.dbt_cloud_host || "";
  $("dbt_cloud_account_id").value = s.dbt_cloud_account_id || "";
  $("dbt_cloud_project_id").value = s.dbt_cloud_project_id || "";
  $("warehouse_type") && ($("warehouse_type").value = s.warehouse_type || "");
  renderStatus(s.configured);
  $("teams_url").textContent = `${window.location.origin}/api/teams/events`;
}
loadStatus();

// ---- settings --------------------------------------------------------------
async function saveSettings() {
  const body = {
    llm_api_key: $("llm_api_key").value || undefined,
    llm_base_url: $("llm_base_url").value,
    llm_model: $("llm_model").value || undefined,
    dbt_cloud_host: $("dbt_cloud_host").value || undefined,
    dbt_cloud_account_id: $("dbt_cloud_account_id").value || undefined,
    dbt_cloud_project_id: $("dbt_cloud_project_id").value || undefined,
    dbt_cloud_token: $("dbt_cloud_token").value || undefined,
    teams_outgoing_secret: $("teams_outgoing_secret").value || undefined,
    teams_incoming_webhook: $("teams_incoming_webhook").value || undefined,
  };
  await api("/api/settings", { method: "POST", body: JSON.stringify(body) });
  for (const f of ["manifest_file", "catalog_file"]) {
    const file = $(f).files[0];
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const path = f === "manifest_file" ? "/api/manifest" : "/api/catalog";
      const r = await fetch(path, { method: "POST", body: fd });
      if (!r.ok) alert(`upload failed for ${f}`);
    }
  }
  await loadStatus();
  alert("Saved.");
}
window.saveSettings = saveSettings;

// ---- HEALTH (D3) -----------------------------------------------------------
async function loadHealth() {
  const h = await api("/api/health");
  if (!h.total_models) { $("health_out").innerHTML = "<p class='muted'>Upload a manifest first.</p>"; return; }
  const kpi = (l, v) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const grade = (g, n) => `<span class="grade-${g}">${g}: ${n}</span>`;
  $("health_out").innerHTML = `
    <div>${kpi("Models", h.total_models)}${kpi("Avg score", h.average_score)}${kpi("Fully documented", h.fully_documented)}${kpi("With tests", h.models_with_tests)}${kpi("Incremental", h.incremental_models)}</div>
    <p class="my-3">${grade("A", h.by_grade.A)} · ${grade("B", h.by_grade.B)} · ${grade("C", h.by_grade.C)} · ${grade("D", h.by_grade.D)}</p>
    <h3 class="h3">Worst offenders</h3>
    ${renderTable(h.worst_offenders, ["name","score","grade","documentation_score","test_score","freshness_score"])}
    <h3 class="h3 mt-4">Top performers</h3>
    ${renderTable(h.top_performers, ["name","score","grade","documentation_score","test_score","freshness_score"])}
  `;
}
window.loadHealth = loadHealth;

// ---- QUALITY (C3) ----------------------------------------------------------
async function loadQuality() {
  const rows = await api("/api/quality");
  $("quality_out").innerHTML = renderTable(rows,
    ["name","score","grade","documentation_score","test_score","freshness_score","materialized"]);
}
window.loadQuality = loadQuality;

function renderTable(rows, cols) {
  if (!rows.length) return "<p class='muted'>No data.</p>";
  const head = cols.map(c => `<th>${c}</th>`).join("");
  const body = rows.map(r => "<tr>" + cols.map(c => {
    if (c === "grade") return `<td class="grade-${r[c]}">${r[c]}</td>`;
    return `<td>${esc(r[c])}</td>`;
  }).join("") + "</tr>").join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// ---- LINEAGE (D1) ----------------------------------------------------------
let lineageNetwork, lineageData;
async function loadLineage() {
  const g = await api("/api/lineage");
  const colorFor = k => k === "source" ? "#fbbf24" : k === "seed" ? "#a78bfa" : "#60a5fa";
  const nodes = g.nodes.map(n => ({
    id: n.id, label: n.name, title: `${n.kind} — ${n.description || ""}`,
    color: colorFor(n.kind), shape: n.kind === "source" ? "box" : "ellipse",
  }));
  const edges = g.edges.map(e => ({ from: e.from, to: e.to, arrows: "to" }));
  lineageData = { nodes, edges, raw: g };
  const container = $("lineage_net");
  lineageNetwork = new vis.Network(container, {
    nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges),
  }, {
    layout: { hierarchical: { direction: "LR", sortMethod: "directed", levelSeparation: 200 } },
    physics: false,
    nodes: { font: { size: 12 } },
    edges: { smooth: { type: "cubicBezier" } },
  });
}
function filterLineage() {
  if (!lineageData) return;
  const q = $("lineage_filter").value.toLowerCase();
  const ns = lineageData.raw.nodes.filter(n =>
    !q || n.name.toLowerCase().includes(q));
  const ids = new Set(ns.map(n => n.id));
  const es = lineageData.raw.edges.filter(e => ids.has(e.from) && ids.has(e.to));
  lineageNetwork.setData({
    nodes: new vis.DataSet(ns.map(n => ({ id: n.id, label: n.name, title: n.description }))),
    edges: new vis.DataSet(es.map(e => ({ from: e.from, to: e.to, arrows: "to" }))),
  });
}
window.loadLineage = loadLineage;
window.filterLineage = filterLineage;

// ---- COLUMN LINEAGE (D2) ---------------------------------------------------
async function runColumnLineage() {
  const r = await api(`/api/lineage/column?model=${encodeURIComponent($("col_model").value)}&column=${encodeURIComponent($("col_column").value)}`);
  $("col_out").textContent = JSON.stringify(r, null, 2);
}
window.runColumnLineage = runColumnLineage;

// ---- SEARCH (B3) -----------------------------------------------------------
async function runSearch() {
  const q = $("search_q").value;
  const rows = await api("/api/search?q=" + encodeURIComponent(q));
  $("search_out").innerHTML = renderTable(rows, ["name","kind","description","score"]);
}
window.runSearch = runSearch;

// ---- CHAT (B1) -------------------------------------------------------------
async function runChat() {
  const r = await api("/api/chat", { method: "POST", body: JSON.stringify({ question: $("chat_q").value }) });
  $("chat_out").innerHTML = `<div class="card"><b>Answer</b><pre>${esc(r.answer)}</pre><details><summary>Context used</summary><pre>${esc(r.context_used)}</pre></details></div>`;
}
window.runChat = runChat;

// ---- NL2SQL (B2) -----------------------------------------------------------
async function runNL2SQL() {
  const r = await api("/api/nl2sql", { method: "POST", body: JSON.stringify({ question: $("nl_q").value, dialect: $("nl_dialect").value }) });
  $("nl_out").textContent = r.sql;
}
window.runNL2SQL = runNL2SQL;

// ---- DOCS (A1) -------------------------------------------------------------
async function loadUndocumented() {
  const rows = await api("/api/docs/undocumented");
  $("undoc_out").innerHTML = renderTable(rows, ["name","description","column_count","documented_columns"]);
}
async function runDocs() {
  const r = await api("/api/docs/generate", { method: "POST", body: JSON.stringify({ model: $("doc_model").value }) });
  $("doc_out").textContent = r.yaml;
}
window.loadUndocumented = loadUndocumented;
window.runDocs = runDocs;

// ---- SCAFFOLD (A2) ---------------------------------------------------------
async function runScaffold() {
  const r = await api("/api/scaffold", { method: "POST", body: JSON.stringify({
    brief: $("scaf_brief").value, layer: $("scaf_layer").value, materialization: $("scaf_mat").value,
  }) });
  $("scaf_out").innerHTML = `<div class="card"><h3 class="h3">${esc(r.name)}.sql</h3><pre>${esc(r.sql)}</pre><h3 class="h3">schema.yml</h3><pre>${esc(r.yaml)}</pre></div>`;
}
window.runScaffold = runScaffold;

// ---- STAGING (A3) ----------------------------------------------------------
async function runStaging() {
  const raw = $("stg_cols").value.trim();
  let columns = null;
  if (raw) {
    columns = raw.split("\n").map(l => {
      const [name, type] = l.split(",").map(s => s.trim());
      return { name, type };
    }).filter(c => c.name);
  }
  const r = await api("/api/staging", { method: "POST", body: JSON.stringify({
    source_name: $("stg_src").value, table_name: $("stg_tbl").value, columns,
  }) });
  $("stg_out").innerHTML = `<div class="card"><h3 class="h3">${esc(r.name)}.sql</h3><pre>${esc(r.sql)}</pre><h3 class="h3">schema.yml</h3><pre>${esc(r.yaml)}</pre></div>`;
}
window.runStaging = runStaging;

// ---- INCREMENTAL (A4) ------------------------------------------------------
async function loadIncrAnalyze() {
  const rows = await api("/api/incremental/analyze");
  $("incr_table").innerHTML = renderTable(rows,
    ["name","current_materialization","row_count","timestamp_columns_found","incremental_score","recommend_incremental"]);
}
async function runIncrRewrite() {
  const r = await api("/api/incremental/rewrite", { method: "POST", body: JSON.stringify({
    model: $("incr_model").value, ts_column: $("incr_ts").value, strategy: $("incr_strategy").value,
  }) });
  $("incr_out").innerHTML = `<div class="card"><pre>${esc(r.config_block || "")}</pre><pre>${esc(r.sql || "")}</pre><p>${esc(r.notes || "")}</p></div>`;
}
window.loadIncrAnalyze = loadIncrAnalyze;
window.runIncrRewrite = runIncrRewrite;

// ---- TESTS (C1) ------------------------------------------------------------
async function runTests() {
  const r = await api("/api/tests/generate", { method: "POST", body: JSON.stringify({
    model: $("test_model").value, csv: $("test_csv").value,
  }) });
  $("test_out").textContent = r.yaml;
}
window.runTests = runTests;

// ---- ANOMALY (C2) ----------------------------------------------------------
async function runAnomaly() {
  const m = $("anom_model").value.trim();
  const r = await api("/api/anomaly/suggest" + (m ? `?model=${encodeURIComponent(m)}` : ""));
  if (Array.isArray(r)) {
    $("anom_out").innerHTML = r.map(x => `<div class="card"><h3 class="h3">${esc(x.model)}</h3><pre>${esc(x.yaml)}</pre></div>`).join("");
  } else {
    $("anom_out").innerHTML = `<div class="card"><pre>${esc(r.yaml)}</pre></div>`;
  }
}
window.runAnomaly = runAnomaly;

// ---- TEAMS (E2) ------------------------------------------------------------
async function runCommand() {
  const r = await api("/api/command", { method: "POST", body: JSON.stringify({ text: $("cmd_in").value }) });
  $("cmd_out").textContent = r.reply;
}
window.runCommand = runCommand;

async function runTeamsTest() {
  const r = await api("/api/teams/test", { method: "POST", body: JSON.stringify({
    text: $("tm_txt").value,
  }) });
  $("tm_out").textContent = JSON.stringify(r, null, 2);
}
window.runTeamsTest = runTeamsTest;

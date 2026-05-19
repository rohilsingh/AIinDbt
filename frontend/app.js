'use strict';

// =============================================================
// AIinDbt — Vue 3 CDN rewrite (no ES modules)
// =============================================================

// ---- Utility: HTML escape ------------------------------------
function esc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Utility: API call ---------------------------------------
async function apiCall(path, opts) {
  opts = opts || {};
  var isForm = opts.body instanceof FormData;
  var r = await fetch(path, Object.assign({ headers: isForm ? {} : { 'Content-Type': 'application/json' } }, opts));
  var data = await r.json().catch(function() { return {}; });
  if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
  return data;
}

// ---- Utility: format bot text --------------------------------
function formatBotText(text) {
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, function(_, code) {
      return '<pre style="margin:.3rem 0;font-size:.78rem;white-space:pre-wrap">' + esc(code.trim()) + '</pre>';
    })
    .replace(/\n/g, '<br>');
}

// =============================================================
// Model list cache
// =============================================================
var _acCache = null;
async function getModelList() {
  if (_acCache) return _acCache;
  try {
    var r = await fetch('/api/models/list');
    var d = await r.json();
    _acCache = (d.models || []).map(function(m) { return { name: m.name, kind: 'model', extra: m.materialized || '' }; })
      .concat((d.sources || []).map(function(s) { return { name: s.name, kind: 'source', extra: s.source_name || '' }; }));
  } catch (_) { _acCache = []; }
  return _acCache;
}

// =============================================================
// DOCS_PAGES
// =============================================================
var DOCS_PAGES = [
  { id: 'gs-overview', section: 'Getting Started', title: 'Overview',
    body: '<p>AIinDbt is a self-hosted web app that brings AI features into your dbt workflow — no cloud signup beyond your API keys.</p><h2>Features</h2><ul><li><b>A1</b> AI Doc Generator — auto-writes YAML descriptions</li><li><b>A2</b> Model Scaffolding — full model from a brief</li><li><b>A3</b> Staging Generator — RAW → stg_*</li><li><b>A4</b> Incremental Advisor — scores &amp; rewrites models</li><li><b>B1</b> Chat — plain-English Q&amp;A on your project</li><li><b>B2</b> NL→SQL — business question → warehouse SQL</li><li><b>B3</b> Semantic Search — search across all models</li><li><b>C1</b> Test Generator — schema.yml tests from sample data</li><li><b>C2</b> Anomaly Detection — Elementary tests</li><li><b>C3</b> Quality Scores — 0–100 health score per model</li><li><b>D1</b> Lineage Graph — interactive DAG</li><li><b>D2</b> Column Lineage — trace a column upstream</li><li><b>D3</b> Health Dashboard — KPI overview</li><li><b>E2</b> Teams Bot — slash commands in Microsoft Teams</li><li>BigQuery runner — run generated SQL directly</li></ul>' },
  { id: 'gs-install', section: 'Getting Started', title: 'Installation',
    body: '<h2>macOS / Linux</h2><pre>pip install -r requirements.txt\n./run.sh</pre><h2>Windows</h2><pre>python -m pip install -r requirements.txt\npython -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre><p>If <code>python</code> not found, use <code>py</code>:</p><pre>py -m pip install -r requirements.txt\npy -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre><div class="callout">Settings are in-memory only — re-enter after server restart.</div>' },
  { id: 'gs-settings', section: 'Getting Started', title: 'Settings',
    body: '<h2>LLM Key</h2><p>Paste your Cline key, Anthropic key, or OpenRouter key.</p><table><thead><tr><th>Gateway</th><th>Base URL</th></tr></thead><tbody><tr><td>Anthropic direct</td><td>(leave blank)</td></tr><tr><td>OpenRouter / Cline</td><td>https://openrouter.ai/api/v1</td></tr></tbody></table><h2>dbt Project</h2><p>Run <code>dbt parse</code> then upload <code>target/manifest.json</code>. This unlocks autocomplete, lineage, docs generation, and all model-aware features.</p>' },
  { id: 'feat-a1', section: 'Features', title: 'A1 — AI Doc Generator',
    body: '<p>Auto-generates schema.yml descriptions for any model and its columns.</p><h2>How to use</h2><ol><li>Upload manifest.json</li><li>Click <b>List undocumented</b> to see which models need attention</li><li>Type a model name (autocomplete will suggest options)</li><li>Click <b>Generate YAML</b> and paste into your schema.yml</li></ol>' },
  { id: 'feat-a2', section: 'Features', title: 'A2 — Model Scaffolding',
    body: '<p>Generates a complete dbt model from a plain-English brief using your real project\'s refs.</p><h2>Example briefs</h2><ul><li><i>Daily revenue by country joining orders and customers, last 90 days</i></li><li><i>Monthly active users grouped by plan tier</i></li></ul>' },
  { id: 'feat-a3', section: 'Features', title: 'A3 — Staging Generator',
    body: '<p>Reads a RAW source table and generates a clean <code>stg_*</code> model: column renames, type casts, CTE pattern.</p><p>Provide columns as <code>name,type</code> CSV (one per line) or let the manifest load them automatically.</p>' },
  { id: 'feat-a4', section: 'Features', title: 'A4 — Incremental Advisor',
    body: '<p>Scores models on incremental fit: +2 for timestamp column, +2 for row count &gt;1M, +1 for non-incremental materialization.</p><p>Models scoring ≥3 are recommended. Enter the model + timestamp column to get a full rewrite.</p>' },
  { id: 'feat-b1', section: 'Features', title: 'B1 — Chat with Project',
    body: '<p>Plain-English Q&amp;A using your manifest as context. Ask about models, dependencies, column definitions, or request SQL.</p><p>Click 🔖 on any answer to save it to the bookmarks drawer.</p>' },
  { id: 'feat-b2', section: 'Features', title: 'B2 — Natural Language → SQL',
    body: '<p>Translates a business question to warehouse SQL. Select dialect (Snowflake, BigQuery, Redshift…), then optionally run it in BigQuery.</p><div class="callout warning">Always review SQL before running in production.</div>' },
  { id: 'feat-c1', section: 'Features', title: 'C1 — Test Generator',
    body: '<p>Paste a CSV sample (with header, 10–50 rows) and get schema.yml tests: <code>not_null</code>, <code>unique</code>, <code>accepted_values</code> (≤12 distinct values), <code>relationships</code>.</p>' },
  { id: 'feat-c2', section: 'Features', title: 'C2 — Anomaly Detection',
    body: '<p>Generates <a href="https://docs.elementary-data.com" target="_blank">Elementary</a> anomaly tests based on column names: <code>volume_anomalies</code>, <code>freshness_anomalies</code>, <code>dimension_anomalies</code>.</p><div class="callout">Requires <code>elementary-data/elementary</code> dbt package.</div>' },
  { id: 'feat-c3', section: 'Features', title: 'C3 — Quality Scoring',
    body: '<p>0–100 health score: Docs 40pts + Tests 40pts + Freshness 20pts. Grade A≥85, B≥70, C≥50, D&lt;50. Export to Excel for reporting.</p>' },
  { id: 'feat-d1', section: 'Features', title: 'D1 — Lineage Graph',
    body: '<p>Interactive DAG with layer colour coding (🟡 Source, 🟣 Seed, 🔵 Staging, 🟢 Intermediate, 🔴 Marts). Click a node for details. Search to highlight nodes.</p>' },
  { id: 'feat-d2', section: 'Features', title: 'D2 — Column Lineage',
    body: '<p>Traces a column upstream across the model chain using sqlglot SQL parsing. Best-effort — complex Jinja macros may not resolve fully.</p>' },
  { id: 'int-teams', section: 'Integrations', title: 'Microsoft Teams Setup',
    body: '<h2>Option A — Outgoing Webhook (users @mention the bot)</h2><div class="setup-step"><div class="step-num">1</div><div class="step-body"><div class="step-title">Open channel settings</div><div class="step-desc">Channel → <b>⋯</b> → Connectors → Outgoing Webhooks</div></div></div><div class="setup-step"><div class="step-num">2</div><div class="step-body"><div class="step-title">Create webhook</div><div class="step-desc">Set callback URL to <code>https://&lt;your-host&gt;/api/teams/events</code>. For local testing use ngrok: <code>ngrok http 8000</code></div></div></div><div class="setup-step"><div class="step-num">3</div><div class="step-body"><div class="step-title">Copy HMAC secret</div><div class="step-desc">Paste the base64 secret into Settings → Outgoing Webhook HMAC secret</div></div></div><div class="setup-step"><div class="step-num">4</div><div class="step-body"><div class="step-title">Test it</div><div class="step-desc">In the channel: <code>@AIinDbt /help</code></div></div></div><h2>Option B — Incoming Webhook (push from app)</h2><div class="setup-step"><div class="step-num">1</div><div class="step-body"><div class="step-title">Add connector</div><div class="step-desc">Channel → <b>⋯</b> → Connectors → Incoming Webhook → Configure</div></div></div><div class="setup-step"><div class="step-num">2</div><div class="step-body"><div class="step-title">Copy URL</div><div class="step-desc">Paste the webhook URL into Settings → Incoming Webhook URL</div></div></div><h2>Available Commands</h2><table><thead><tr><th>Command</th><th>Feature</th></tr></thead><tbody><tr><td>/help</td><td>List commands</td></tr><tr><td>/health</td><td>Health KPIs</td></tr><tr><td>/quality [n]</td><td>Quality scores</td></tr><tr><td>/sql &lt;question&gt;</td><td>NL→SQL</td></tr><tr><td>/docs &lt;model&gt;</td><td>Generate YAML</td></tr><tr><td>/scaffold &lt;brief&gt;</td><td>New model</td></tr><tr><td>/anomaly &lt;model&gt;</td><td>Anomaly tests</td></tr><tr><td>/lineage &lt;model&gt; &lt;col&gt;</td><td>Column lineage</td></tr><tr><td>(anything else)</td><td>Chat with project</td></tr></tbody></table>' },
  { id: 'int-bq', section: 'Integrations', title: 'BigQuery Setup',
    body: '<ol><li>GCP Console → IAM → Service Accounts → Create</li><li>Grant <b>BigQuery Data Viewer</b> + <b>BigQuery Job User</b></li><li>Keys → Add Key → JSON → download the file</li><li>In the BigQuery panel click <b>Upload service account JSON</b></li><li>Click <b>Test connection</b></li></ol><div class="callout warning">Queries are billed to your GCP project. Results capped at 500 rows by default.</div>' },
  { id: 'trbl', section: 'Troubleshooting', title: 'Common Issues',
    body: '<h2>Clicks do nothing / page unresponsive</h2><p>Open browser DevTools (F12) → Console tab. Look for red errors. Most common cause: a JS error on load.</p><h2>LLM 401 error</h2><p>Re-check API key in Settings. For Cline/OpenRouter ensure Base URL is set.</p><h2>Manifest not loading</h2><p>Run <code>dbt parse</code> and upload <code>target/manifest.json</code>. File can be 10–50MB — be patient.</p><h2>Lineage is empty</h2><p>Needs a manifest. Check the status dots in the sidebar.</p><h2>Teams bot not responding</h2><p>Server must be publicly reachable. Use ngrok for local: <code>ngrok http 8000</code>. HMAC secret must be exact (base64).</p><h2>Windows: uvicorn not found</h2><p>Use <code>python -m uvicorn</code> not just <code>uvicorn</code>. See Installation page.</p>' },
];

// =============================================================
// LineageViewer  (vanilla class — not a Vue component)
// =============================================================
var LAYER_COLORS = {
  source:       { bg: '#fef3c7', border: '#f59e0b' },
  seed:         { bg: '#ede9fe', border: '#8b5cf6' },
  staging:      { bg: '#e0f2fe', border: '#0ea5e9' },
  intermediate: { bg: '#d1fae5', border: '#10b981' },
  marts:        { bg: '#ffe4e6', border: '#f43f5e' },
  other:        { bg: '#f1f5f9', border: '#94a3b8' },
};

function lineageLayerFor(node) {
  if (node.kind === 'source') return 'source';
  if (node.kind === 'seed')   return 'seed';
  var name = (node.name || '').toLowerCase();
  if (name.startsWith('stg_')) return 'staging';
  if (name.startsWith('int_')) return 'intermediate';
  if (name.startsWith('fct_') || name.startsWith('dim_') || name.startsWith('mart_')) return 'marts';
  return 'other';
}

function LineageViewer(netId, detailId) {
  this.netEl    = document.getElementById(netId);
  this.detailEl = document.getElementById(detailId);
  this.network  = null;
  this._nodes   = null;
  this._rawNodes = [];
}

LineageViewer.prototype.load = function(g) {
  if (!this.netEl || !window.vis) return;
  var self = this;
  this._rawNodes = g.nodes || [];
  var visNodes = new vis.DataSet(g.nodes.map(function(n) {
    var layer = lineageLayerFor(n);
    var c = LAYER_COLORS[layer] || LAYER_COLORS.other;
    return {
      id: n.id, label: n.name,
      title: (n.kind || '') + ': ' + n.name + (n.description ? '\n' + n.description : ''),
      color: { background: c.bg, border: c.border, highlight: { background: '#dbeafe', border: '#2563eb' } },
      shape: n.kind === 'source' ? 'box' : 'ellipse',
      _raw: n,
    };
  }));
  var visEdges = new vis.DataSet(g.edges.map(function(e) {
    return { from: e.from, to: e.to, arrows: 'to',
      color: { color: '#cbd5e1', highlight: '#2563eb' },
      smooth: { type: 'cubicBezier', roundness: 0.3 } };
  }));
  this._nodes = visNodes;
  this.network = new vis.Network(this.netEl, { nodes: visNodes, edges: visEdges }, {
    physics: { enabled: true, barnesHut: { gravitationalConstant: -8000, springLength: 120, damping: 0.5 },
      stabilization: { iterations: 150 } },
    interaction: { hover: true, tooltipDelay: 200, zoomView: true },
    nodes: { borderWidth: 1.5 },
    edges: { width: 1.2 },
  });
  this.network.on('click', function(p) { if (p.nodes.length) self._showDetail(p.nodes[0]); });
  this.network.once('stabilizationIterationsDone', function() { self.network.fit({ animation: true }); });
};

LineageViewer.prototype.search = function(q) {
  var self = this;
  if (!this._nodes) return;
  if (!q.trim()) {
    this._nodes.forEach(function(n) { self._nodes.update({ id: n.id, opacity: 1 }); });
    return;
  }
  var lower = q.toLowerCase(), matches = new Set();
  this._rawNodes.forEach(function(n) { if (n.name.toLowerCase().includes(lower)) matches.add(n.id); });
  this._nodes.forEach(function(n) { self._nodes.update({ id: n.id, opacity: matches.has(n.id) ? 1 : 0.15 }); });
  if (matches.size === 1) this.network.focus(Array.from(matches)[0], { scale: 1.5, animation: true });
};

LineageViewer.prototype.fitView  = function() { this.network && this.network.fit({ animation: true }); };
LineageViewer.prototype.zoomIn   = function() { this.network && this.network.moveTo({ scale: (this.network.getScale() || 1) * 1.3 }); };
LineageViewer.prototype.zoomOut  = function() { this.network && this.network.moveTo({ scale: (this.network.getScale() || 1) * 0.77 }); };
LineageViewer.prototype.setPhysics = function(on) { this.network && this.network.setOptions({ physics: { enabled: on } }); };

LineageViewer.prototype._showDetail = function(id) {
  var node = this._rawNodes.find(function(n) { return n.id === id; });
  if (!node || !this.detailEl) return;
  var c = LAYER_COLORS[lineageLayerFor(node)] || LAYER_COLORS.other;
  this.detailEl.style.display = 'block';
  this.detailEl.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">' +
      '<h4 style="color:' + c.border + '">' + esc(node.name) + '</h4>' +
      '<button onclick="this.closest(\'.node-detail-panel\').style.display=\'none\'" style="background:none;border:none;cursor:pointer;color:#94a3b8">✕</button>' +
    '</div>' +
    '<div class="nd-row"><span class="nd-key">Kind</span><span>' + esc(node.kind) + '</span></div>' +
    (node.schema ? '<div class="nd-row"><span class="nd-key">Schema</span><span>' + esc(node.schema) + '</span></div>' : '') +
    (node.materialized ? '<div class="nd-row"><span class="nd-key">Mat.</span><span>' + esc(node.materialized) + '</span></div>' : '') +
    (node.description ? '<p style="font-size:.78rem;color:#475569;margin-top:.4rem;line-height:1.4">' + esc(node.description.slice(0, 200)) + '</p>' : '');
};

// =============================================================
// DataTable Vue component
// =============================================================
var DataTableComp = {
  name: 'DataTable',
  props: {
    rows:       { type: Array,  default: function() { return []; } },
    columns:    { type: Array,  default: function() { return []; } },
    exportName: { type: String, default: 'export' },
    badges:     { type: Array,  default: function() { return []; } },
    booleans:   { type: Array,  default: function() { return []; } },
  },
  data: function() { return { q: '', filterCol: '', page: 0, sortKey: null, sortDir: 1, pageSize: 50 }; },
  watch: {
    rows: function() { this.page = 0; this.q = ''; },
  },
  computed: {
    filtered: function() {
      var data = this.rows;
      if (this.q) {
        var q = this.q.toLowerCase(), fc = this.filterCol, cols = this.columns;
        data = data.filter(function(row) {
          var targets = fc ? [String(row[fc] == null ? '' : row[fc])] : cols.map(function(c) { return String(row[c.key] == null ? '' : row[c.key]); });
          return targets.some(function(t) { return t.toLowerCase().includes(q); });
        });
      }
      if (this.sortKey) {
        var k = this.sortKey, d = this.sortDir;
        data = data.slice().sort(function(a, b) {
          var av = a[k] == null ? '' : a[k], bv = b[k] == null ? '' : b[k];
          return (typeof av === 'number' && typeof bv === 'number') ? (av - bv) * d : String(av).localeCompare(String(bv)) * d;
        });
      }
      return data;
    },
    paged: function() { var s = this.page * this.pageSize; return this.filtered.slice(s, s + this.pageSize); },
    pageInfo: function() {
      var t = this.filtered.length; if (!t) return '0 results';
      var s = this.page * this.pageSize;
      return (s + 1) + '–' + Math.min(s + this.pageSize, t) + ' of ' + t;
    },
    hasPrev: function() { return this.page > 0; },
    hasNext: function() { return (this.page + 1) * this.pageSize < this.filtered.length; },
  },
  methods: {
    toggleSort: function(key) {
      if (this.sortKey === key) this.sortDir *= -1;
      else { this.sortKey = key; this.sortDir = 1; }
    },
    sortClass: function(key) { return this.sortKey !== key ? '' : this.sortDir === 1 ? 'sort-asc' : 'sort-desc'; },
    doExport: async function() {
      try {
        var self = this;
        var rows = this.filtered.map(function(row) {
          var o = {};
          self.columns.forEach(function(c) { o[c.key] = row[c.key] == null ? '' : row[c.key]; });
          return o;
        });
        var r = await fetch('/api/export/excel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: rows, columns: this.columns.map(function(c) { return c.key; }), filename: this.exportName }),
        });
        if (!r.ok) throw new Error(await r.text());
        var a = document.createElement('a');
        a.href = URL.createObjectURL(await r.blob());
        a.download = this.exportName + '.xlsx';
        a.click();
      } catch (e) { alert('Export failed: ' + e.message); }
    },
  },
  template: '\
    <div class="data-table-wrap">\
      <div class="data-table-toolbar">\
        <input v-model="q" class="dt-search" placeholder="Search…" @input="page=0" />\
        <select v-model="filterCol" class="dt-filter-col" @change="page=0">\
          <option value="">All columns</option>\
          <option v-for="col in columns" :key="col.key" :value="col.key">{{ col.label }}</option>\
        </select>\
        <div style="margin-left:auto;display:flex;gap:.4rem">\
          <button class="btn btn-secondary btn-sm" @click="doExport">⬇ Excel</button>\
          <button class="btn btn-secondary btn-sm no-print" onclick="window.print()">\u{1f5a8} PDF</button>\
        </div>\
      </div>\
      <div class="scroll-table-container">\
        <table>\
          <thead>\
            <tr>\
              <th v-for="col in columns" :key="col.key" :class="sortClass(col.key)" @click="toggleSort(col.key)" style="cursor:pointer">\
                {{ col.label }}<span class="sort-icon"></span>\
              </th>\
            </tr>\
          </thead>\
          <tbody>\
            <tr v-if="!paged.length"><td :colspan="columns.length" class="table-empty">No results</td></tr>\
            <tr v-for="(row,ri) in paged" :key="ri">\
              <td v-for="col in columns" :key="col.key">\
                <span v-if="badges.includes(col.key)" :class="\'grade-\'+(row[col.key]||\'\')">{{ row[col.key]==null?\'\':row[col.key] }}</span>\
                <span v-else-if="booleans.includes(col.key)">{{ row[col.key] ? \'✅ Yes\' : \'—\' }}</span>\
                <span v-else>{{ row[col.key]==null?\'\':row[col.key] }}</span>\
              </td>\
            </tr>\
          </tbody>\
        </table>\
      </div>\
      <div class="data-table-footer">\
        <span class="dt-info">{{ pageInfo }}</span>\
        <div style="display:flex;gap:.35rem">\
          <button class="btn btn-ghost btn-sm" :disabled="!hasPrev" @click="page--">‹</button>\
          <button class="btn btn-ghost btn-sm" :disabled="!hasNext" @click="page++">›</button>\
        </div>\
      </div>\
    </div>\
  ',
};

// =============================================================
// AutoInput Vue component
// =============================================================
var AutoInputComp = {
  name: 'AutoInput',
  props: {
    modelValue:  { type: String, default: '' },
    kind:        String,
    placeholder: { type: String, default: '' },
    inputId:     String,
  },
  emits: ['update:modelValue'],
  data: function() { return { suggestions: [], highlighted: -1 }; },
  methods: {
    onInput: async function(val) {
      this.$emit('update:modelValue', val);
      if (!val.trim()) { this.suggestions = []; return; }
      var self = this;
      var all = await getModelList();
      var q = val.toLowerCase();
      this.suggestions = all.filter(function(m) {
        return (!self.kind || m.kind === self.kind) &&
          (m.name.toLowerCase().includes(q) || (m.extra || '').toLowerCase().includes(q));
      }).slice(0, 20);
      this.highlighted = -1;
    },
    pick: function(item) {
      this.$emit('update:modelValue', item.name);
      this.suggestions = [];
      this.highlighted = -1;
    },
    onKeydown: function(e) {
      if (!this.suggestions.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); this.highlighted = Math.min(this.highlighted + 1, this.suggestions.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.highlighted = Math.max(this.highlighted - 1, 0); }
      else if (e.key === 'Enter' && this.highlighted >= 0) { e.preventDefault(); this.pick(this.suggestions[this.highlighted]); }
      else if (e.key === 'Escape') { this.suggestions = []; }
    },
    onBlur: function() { var self = this; setTimeout(function() { self.suggestions = []; }, 150); },
  },
  template: '\
    <div class="autocomplete-wrap">\
      <input :id="inputId" :value="modelValue" :placeholder="placeholder"\
        @input="onInput($event.target.value)" @keydown="onKeydown" @blur="onBlur" />\
      <div v-if="suggestions.length" class="autocomplete-dropdown">\
        <div v-for="(item,i) in suggestions" :key="item.name"\
          class="autocomplete-item" :class="{focused:i===highlighted}"\
          @mousedown.prevent="pick(item)">\
          <span class="ac-kind" :class="item.kind">{{ item.kind }}</span>\
          <span>{{ item.name }}</span>\
          <span v-if="item.extra" style="color:#94a3b8;font-size:.72rem;margin-left:auto">{{ item.extra }}</span>\
        </div>\
      </div>\
    </div>\
  ',
};

// =============================================================
// Main Vue app
// =============================================================
const { createApp } = Vue;

createApp({
  // ------------------------------------------------------------------
  data: function() {
    return {
      // Navigation
      panel: 'health',
      sidebarOpen: false,
      bookmarksOpen: false,
      toasts: [],

      // Status
      statusDots: [],
      lineageBadge: 0,

      // Settings
      llmApiKey: '',
      llmBaseUrl: '',
      llmModel: 'claude-sonnet-4-6',
      dbtCloudHost: 'cloud.getdbt.com',
      dbtCloudAccountId: '',
      dbtCloudProjectId: '',
      dbtCloudToken: '',
      teamsSecret: '',
      teamsWebhook: '',
      teamsWebhookUrl: '',

      // Health
      healthKpis: [],
      healthWorst: [],
      healthTop: [],

      // Quality
      qualityRows: [],

      // Lineage
      _lineageViewer: null,

      // Column lineage
      colModel: '',
      colColumn: '',
      colTrail: [],
      colRan: false,

      // Search
      searchQ: '',
      searchResults: [],

      // Chat
      chatMessages: [],
      chatInput: '',
      chatTyping: false,
      chatBookmarks: (function() { try { return JSON.parse(localStorage.getItem('aiindbt_bookmarks') || '[]'); } catch (_) { return []; } })(),

      // NL2SQL
      nlQ: '',
      nlDialect: 'snowflake',
      nlSql: '',
      nlSqlReady: false,
      nlBqRows: [],
      nlBqCols: [],

      // AI Docs
      undocRows: [],
      docModel: '',
      docYaml: '',
      docLoading: false,

      // Scaffold
      scafBrief: '',
      scafLayer: 'marts',
      scafMat: 'table',
      scafName: '',
      scafSql: '',
      scafYaml: '',
      scafLoading: false,

      // Staging
      stgSrc: '',
      stgTbl: '',
      stgCols: '',
      stgName: '',
      stgSql: '',
      stgYaml: '',
      stgLoading: false,

      // Incremental
      incrRows: [],
      incrModel: '',
      incrTs: '',
      incrStrategy: 'merge',
      incrResult: '',
      incrNotes: '',
      incrLoading: false,

      // Tests
      testModel: '',
      testCsv: '',
      testYaml: '',
      testLoading: false,

      // Anomaly
      anomModel: '',
      anomResults: [],
      anomLoading: false,

      // Teams
      cmdInput: '',
      cmdOutput: '',
      cmdRan: false,
      tmTxt: 'Hello from AIinDbt 👋',
      tmOutput: '',
      tmRan: false,

      // BigQuery
      bqProjectId: '',
      bqStatus: '',
      bqStatusOk: null,
      bqSql: '',
      bqRows: [],
      bqCols: [],
      bqInfo: null,
      bqLoading: false,

      // Docs viewer
      docsSearch: '',
      docsCurrent: 'gs-overview',

      // Column definitions for DataTable components
      healthWorstCols: [
        { key: 'name', label: 'Model' }, { key: 'score', label: 'Score' },
        { key: 'grade', label: 'Grade' }, { key: 'documentation_score', label: 'Docs' },
        { key: 'test_score', label: 'Tests' }, { key: 'freshness_score', label: 'Freshness' },
      ],
      healthTopCols: [
        { key: 'name', label: 'Model' }, { key: 'score', label: 'Score' },
        { key: 'grade', label: 'Grade' }, { key: 'documentation_score', label: 'Docs' },
        { key: 'test_score', label: 'Tests' },
      ],
      qualityCols: [
        { key: 'name', label: 'Model' }, { key: 'score', label: 'Score' },
        { key: 'grade', label: 'Grade' }, { key: 'documentation_score', label: 'Docs (40)' },
        { key: 'test_score', label: 'Tests (40)' }, { key: 'freshness_score', label: 'Fresh (20)' },
        { key: 'materialized', label: 'Mat.' },
      ],
      searchCols: [
        { key: 'name', label: 'Model' }, { key: 'kind', label: 'Kind' },
        { key: 'description', label: 'Description' }, { key: 'score', label: 'Score' },
      ],
      undocCols: [
        { key: 'name', label: 'Model' }, { key: 'description', label: 'Current description' },
        { key: 'column_count', label: 'Columns' }, { key: 'documented_columns', label: 'Documented' },
      ],
      incrCols: [
        { key: 'name', label: 'Model' }, { key: 'current_materialization', label: 'Materialization' },
        { key: 'row_count', label: 'Row count' }, { key: 'incremental_score', label: 'Score' },
        { key: 'recommend_incremental', label: 'Recommended' },
      ],
    };
  },

  // ------------------------------------------------------------------
  computed: {
    panelTitle: function() {
      var map = {
        health: 'Health Dashboard', quality: 'Quality Scores',
        docs: 'AI Docs', scaffold: 'Model Scaffold', staging: 'Staging Layer',
        incremental: 'Incremental Advisor', chat: 'Chat with Project',
        nl2sql: 'NL → SQL', search: 'Semantic Search', tests: 'Test Generator',
        anomaly: 'Anomaly Detection', lineage: 'Lineage Graph',
        collineage: 'Column Lineage', teams: 'Microsoft Teams',
        bigquery: 'BigQuery', settings: 'Settings', apidocs: 'Documentation',
      };
      return map[this.panel] || 'AIinDbt';
    },

    docsBySection: function() {
      var q = this.docsSearch.toLowerCase();
      var pages = q ? DOCS_PAGES.filter(function(p) {
        return p.title.toLowerCase().includes(q) || p.section.toLowerCase().includes(q);
      }) : DOCS_PAGES;
      var sections = {};
      pages.forEach(function(p) {
        if (!sections[p.section]) sections[p.section] = [];
        sections[p.section].push(p);
      });
      return sections;
    },

    currentDoc: function() {
      var id = this.docsCurrent;
      return DOCS_PAGES.find(function(p) { return p.id === id; }) || null;
    },

    colTrailText: function() {
      return this.colTrail.map(function(step) {
        var srcs = (step.from || []).map(function(x) { return (x[0] || '?') + '.' + x[1]; }).join(', ') || '(literal/derived)';
        return step.model + '.' + step.column + '  ←  ' + srcs + (step.note ? ' — ' + step.note : '');
      }).join('\n');
    },
  },

  // ------------------------------------------------------------------
  methods: {
    // ---- Toast -------------------------------------------------------
    toast: function(msg, type) {
      var self = this;
      type = type || 'info';
      var id = Date.now() + Math.random();
      this.toasts.push({ id: id, msg: msg, type: type });
      setTimeout(function() {
        self.toasts = self.toasts.filter(function(t) { return t.id !== id; });
      }, 3500);
    },

    // ---- Status / Settings load --------------------------------------
    loadStatus: async function() {
      try {
        var s = await apiCall('/api/settings');
        var cfg = s.configured || {};
        this.statusDots = [
          { label: 'LLM',     ok: !!cfg.llm },
          { label: 'Project', ok: !!(cfg.manifest || cfg.dbt_cloud) },
          { label: 'BQ',      ok: !!cfg.bigquery },
          { label: 'Teams',   ok: !!cfg.teams },
        ];
        if (s.manifest_models) this.lineageBadge = s.manifest_models;
        if (s.llm_base_url)          this.llmBaseUrl          = s.llm_base_url;
        if (s.llm_model)             this.llmModel            = s.llm_model;
        if (s.dbt_cloud_host)        this.dbtCloudHost        = s.dbt_cloud_host;
        if (s.dbt_cloud_account_id)  this.dbtCloudAccountId   = s.dbt_cloud_account_id;
        if (s.dbt_cloud_project_id)  this.dbtCloudProjectId   = s.dbt_cloud_project_id;
        if (s.bigquery_project_id)   this.bqProjectId         = s.bigquery_project_id;
        this.teamsWebhookUrl = window.location.origin + '/api/teams/events';
      } catch (_) {}
      getModelList();
    },

    // ---- Save settings -----------------------------------------------
    saveSettings: async function() {
      try {
        await apiCall('/api/settings', {
          method: 'POST',
          body: JSON.stringify({
            llm_api_key:           this.llmApiKey      || undefined,
            llm_base_url:          this.llmBaseUrl,
            llm_model:             this.llmModel        || undefined,
            dbt_cloud_host:        this.dbtCloudHost    || undefined,
            dbt_cloud_account_id:  this.dbtCloudAccountId || undefined,
            dbt_cloud_project_id:  this.dbtCloudProjectId || undefined,
            dbt_cloud_token:       this.dbtCloudToken   || undefined,
            teams_outgoing_secret: this.teamsSecret     || undefined,
            teams_incoming_webhook: this.teamsWebhook   || undefined,
          }),
        });
        // Upload manifest/catalog files if selected
        var pairs = [['manifest_file', '/api/manifest'], ['catalog_file', '/api/catalog']];
        for (var i = 0; i < pairs.length; i++) {
          var el = document.getElementById(pairs[i][0]);
          var file = el && el.files && el.files[0];
          if (file) {
            var fd = new FormData(); fd.append('file', file);
            var r = await fetch(pairs[i][1], { method: 'POST', body: fd });
            if (!r.ok) { this.toast('Upload failed: ' + pairs[i][0], 'error'); continue; }
            this.toast(pairs[i][0] + ' uploaded', 'success');
          }
        }
        await this.loadStatus();
        this.toast('Settings saved', 'success');
      } catch (e) { this.toast('Save failed: ' + e.message, 'error'); }
    },

    // ---- Health ------------------------------------------------------
    loadHealth: async function() {
      try {
        var h = await apiCall('/api/health');
        if (!h.total_models) { this.healthKpis = []; this.healthWorst = []; this.healthTop = []; return; }
        var g = h.by_grade || {};
        this.healthKpis = [
          { value: h.total_models,       label: 'Total Models' },
          { value: h.average_score,      label: 'Avg Score' },
          { value: h.fully_documented,   label: 'Fully Documented' },
          { value: h.models_with_tests,  label: 'With Tests' },
          { value: h.incremental_models, label: 'Incremental' },
          { value: g.A || 0, label: 'Grade A', color: '#15803d' },
          { value: g.B || 0, label: 'Grade B', color: '#1d4ed8' },
          { value: g.C || 0, label: 'Grade C', color: '#b45309' },
          { value: g.D || 0, label: 'Grade D', color: '#dc2626' },
        ];
        this.healthWorst = h.worst_offenders || [];
        this.healthTop   = (h.top_performers || []).slice().reverse();
      } catch (e) { this.toast(e.message, 'error'); }
    },

    // ---- Quality -----------------------------------------------------
    loadQuality: async function() {
      try { this.qualityRows = await apiCall('/api/quality'); }
      catch (e) { this.toast(e.message, 'error'); }
    },

    // ---- Lineage (D1) ------------------------------------------------
    loadLineage: async function() {
      try {
        var g = await apiCall('/api/lineage');
        if (!this._lineageViewer) {
          this._lineageViewer = new LineageViewer('lineage-net', 'lineage-detail');
        }
        this._lineageViewer.load(g);
        this.toast('Loaded ' + g.nodes.length + ' nodes', 'success');
      } catch (e) { this.toast(e.message, 'error'); }
    },
    lineageSearch: function(q) { this._lineageViewer && this._lineageViewer.search(q); },
    lineageFit:    function() { this._lineageViewer && this._lineageViewer.fitView(); },
    lineageZoomIn: function() { this._lineageViewer && this._lineageViewer.zoomIn(); },
    lineageZoomOut: function() { this._lineageViewer && this._lineageViewer.zoomOut(); },
    lineageSetPhysics: function(val) { this._lineageViewer && this._lineageViewer.setPhysics(val); },

    // ---- Column Lineage (D2) -----------------------------------------
    runColLineage: async function() {
      if (!this.colModel.trim() || !this.colColumn.trim()) { this.toast('Enter model and column', 'error'); return; }
      try {
        var r = await apiCall('/api/lineage/column?model=' + encodeURIComponent(this.colModel) + '&column=' + encodeURIComponent(this.colColumn));
        this.colTrail = r.trail || [];
        this.colRan = true;
      } catch (e) { this.toast(e.message, 'error'); }
    },

    // ---- Search (B3) -------------------------------------------------
    runSearch: async function() {
      if (!this.searchQ.trim()) return;
      try { this.searchResults = await apiCall('/api/search?q=' + encodeURIComponent(this.searchQ) + '&limit=20'); }
      catch (e) { this.toast(e.message, 'error'); }
    },

    // ---- Chat (B1) ---------------------------------------------------
    addChatMsg: function(role, text) {
      var id = 'msg' + Date.now() + Math.random().toString(36).slice(2);
      var ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.chatMessages.push({
        id: id, role: role, ts: ts,
        text: text,
        html: role === 'bot' ? formatBotText(text) : esc(text),
      });
      return id;
    },

    sendChat: async function() {
      var q = this.chatInput.trim(); if (!q) return;
      this.chatInput = '';
      this.addChatMsg('user', q);
      this.chatTyping = true;
      var self = this;
      this.$nextTick(function() {
        var h = self.$refs.chatHistory;
        if (h) h.scrollTop = h.scrollHeight;
      });
      try {
        var r = await apiCall('/api/chat', { method: 'POST', body: JSON.stringify({ question: q }) });
        this.chatTyping = false;
        this.addChatMsg('bot', r.answer || r.sql || r.reply || JSON.stringify(r));
      } catch (e) {
        this.chatTyping = false;
        this.addChatMsg('bot', '⚠️ Error: ' + e.message);
      }
      this.$nextTick(function() {
        var h = self.$refs.chatHistory;
        if (h) h.scrollTop = h.scrollHeight;
      });
    },

    copyMsg: async function(id) {
      var el = document.getElementById(id); if (!el) return;
      await navigator.clipboard.writeText(el.innerText);
      this.toast('Copied', 'success');
    },

    bookmarkMsg: function(msg) {
      this.chatBookmarks.unshift({ id: Date.now(), text: msg.text || msg.html, ts: new Date().toISOString() });
      localStorage.setItem('aiindbt_bookmarks', JSON.stringify(this.chatBookmarks));
      this.toast('Bookmarked', 'success');
    },

    deleteBookmark: function(id) {
      this.chatBookmarks = this.chatBookmarks.filter(function(b) { return b.id !== id; });
      localStorage.setItem('aiindbt_bookmarks', JSON.stringify(this.chatBookmarks));
    },

    // ---- NL2SQL (B2) -------------------------------------------------
    generateSQL: async function() {
      if (!this.nlQ.trim()) return;
      try {
        var r = await apiCall('/api/nl2sql', { method: 'POST', body: JSON.stringify({ question: this.nlQ, dialect: this.nlDialect }) });
        this.nlSql = r.sql;
        this.nlSqlReady = true;
        this.nlBqRows = [];
        this.nlBqCols = [];
      } catch (e) { this.toast(e.message, 'error'); }
    },

    runNLInBQ: async function() {
      try {
        var r = await apiCall('/api/bigquery/query', { method: 'POST', body: JSON.stringify({ sql: this.nlSql }) });
        this.nlBqCols = (r.schema || []).map(function(f) { return { key: f.name, label: f.name + ' (' + f.type + ')' }; });
        this.nlBqRows = r.rows || [];
      } catch (e) { this.toast(e.message, 'error'); }
    },

    copyNLSql: async function() {
      await navigator.clipboard.writeText(this.nlSql);
      this.toast('Copied', 'success');
    },

    // ---- AI Docs (A1) -----------------------------------------------
    listUndocumented: async function() {
      try { this.undocRows = await apiCall('/api/docs/undocumented'); }
      catch (e) { this.toast(e.message, 'error'); }
    },

    generateDocs: async function() {
      if (!this.docModel.trim()) return;
      this.docLoading = true; this.docYaml = '';
      try {
        var r = await apiCall('/api/docs/generate', { method: 'POST', body: JSON.stringify({ model: this.docModel }) });
        this.docYaml = r.yaml;
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.docLoading = false; }
    },

    copyDocYaml: async function() {
      await navigator.clipboard.writeText(this.docYaml);
      this.toast('Copied', 'success');
    },

    // ---- Scaffold (A2) -----------------------------------------------
    scaffoldModel: async function() {
      if (!this.scafBrief.trim()) return;
      this.scafLoading = true; this.scafSql = ''; this.scafYaml = ''; this.scafName = '';
      try {
        var r = await apiCall('/api/scaffold', { method: 'POST', body: JSON.stringify({ brief: this.scafBrief, layer: this.scafLayer, materialization: this.scafMat }) });
        this.scafName = r.name || '';
        this.scafSql  = r.sql  || '';
        this.scafYaml = r.yaml || '';
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.scafLoading = false; }
    },

    copyScafSql: async function() {
      await navigator.clipboard.writeText(this.scafSql);
      this.toast('Copied', 'success');
    },

    copyScafYaml: async function() {
      await navigator.clipboard.writeText(this.scafYaml);
      this.toast('Copied', 'success');
    },

    // ---- Staging (A3) -----------------------------------------------
    generateStaging: async function() {
      this.stgLoading = true; this.stgSql = ''; this.stgYaml = ''; this.stgName = '';
      var columns = null;
      if (this.stgCols.trim()) {
        columns = this.stgCols.trim().split('\n').map(function(l) {
          var p = l.split(','); return { name: (p[0] || '').trim(), type: (p[1] || '').trim() };
        }).filter(function(c) { return c.name; });
      }
      try {
        var r = await apiCall('/api/staging', { method: 'POST', body: JSON.stringify({ source_name: this.stgSrc, table_name: this.stgTbl, columns: columns }) });
        this.stgName = r.name || '';
        this.stgSql  = r.sql  || '';
        this.stgYaml = r.yaml || '';
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.stgLoading = false; }
    },

    copyStgSql: async function() {
      await navigator.clipboard.writeText(this.stgSql);
      this.toast('Copied', 'success');
    },

    copyStgYaml: async function() {
      await navigator.clipboard.writeText(this.stgYaml);
      this.toast('Copied', 'success');
    },

    // ---- Incremental (A4) -------------------------------------------
    analyzeIncremental: async function() {
      try { this.incrRows = await apiCall('/api/incremental/analyze'); }
      catch (e) { this.toast(e.message, 'error'); }
    },

    rewriteIncremental: async function() {
      if (!this.incrModel.trim()) return;
      this.incrLoading = true; this.incrResult = ''; this.incrNotes = '';
      try {
        var r = await apiCall('/api/incremental/rewrite', { method: 'POST', body: JSON.stringify({ model: this.incrModel, ts_column: this.incrTs, strategy: this.incrStrategy }) });
        this.incrResult = ((r.config_block || '') + '\n\n' + (r.sql || '')).trim();
        this.incrNotes  = r.notes || '';
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.incrLoading = false; }
    },

    copyIncrResult: async function() {
      await navigator.clipboard.writeText(this.incrResult);
      this.toast('Copied', 'success');
    },

    // ---- Tests (C1) -------------------------------------------------
    generateTests: async function() {
      if (!this.testModel.trim() || !this.testCsv.trim()) { this.toast('Enter model name and CSV sample', 'error'); return; }
      this.testLoading = true; this.testYaml = '';
      try {
        var r = await apiCall('/api/tests/generate', { method: 'POST', body: JSON.stringify({ model: this.testModel, csv: this.testCsv }) });
        this.testYaml = r.yaml;
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.testLoading = false; }
    },

    copyTestYaml: async function() {
      await navigator.clipboard.writeText(this.testYaml);
      this.toast('Copied', 'success');
    },

    // ---- Anomaly (C2) -----------------------------------------------
    suggestAnomaly: async function() {
      this.anomLoading = true; this.anomResults = [];
      try {
        var r = await apiCall('/api/anomaly/suggest' + (this.anomModel.trim() ? '?model=' + encodeURIComponent(this.anomModel) : ''));
        this.anomResults = Array.isArray(r) ? r : [r];
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.anomLoading = false; }
    },

    // ---- Teams (E2) -------------------------------------------------
    runCommand: async function() {
      if (!this.cmdInput.trim()) return;
      this.cmdRan = false; this.cmdOutput = '';
      try {
        var r = await apiCall('/api/command', { method: 'POST', body: JSON.stringify({ text: this.cmdInput }) });
        this.cmdOutput = r.reply;
        this.cmdRan = true;
      } catch (e) { this.toast(e.message, 'error'); }
    },

    sendTeamsTest: async function() {
      this.tmRan = false; this.tmOutput = '';
      try {
        var r = await apiCall('/api/teams/test', { method: 'POST', body: JSON.stringify({ text: this.tmTxt }) });
        this.tmOutput = JSON.stringify(r, null, 2);
        this.tmRan = true;
      } catch (e) { this.toast(e.message, 'error'); }
    },

    // ---- BigQuery ---------------------------------------------------
    uploadBQKey: async function() {
      var el = document.getElementById('bq_key_file');
      var file = el && el.files && el.files[0];
      if (!file) { this.toast('Select a service account JSON file', 'error'); return; }
      var fd = new FormData(); fd.append('file', file);
      try {
        var r2 = await fetch('/api/bigquery/upload-key', { method: 'POST', body: fd });
        var d = await r2.json();
        if (!r2.ok) throw new Error(d.error);
        this.bqProjectId = d.project_id || '';
        this.toast('Service account uploaded — project: ' + d.project_id, 'success');
        this.loadStatus();
      } catch (e) { this.toast(e.message, 'error'); }
    },

    saveBQProject: async function() {
      if (!this.bqProjectId.trim()) return;
      try {
        await apiCall('/api/bigquery/project', { method: 'POST', body: JSON.stringify({ project_id: this.bqProjectId }) });
        this.toast('Project ID saved', 'success');
        this.loadStatus();
      } catch (e) { this.toast(e.message, 'error'); }
    },

    testBQConnection: async function() {
      try {
        var r = await apiCall('/api/bigquery/test', { method: 'POST', body: '{}' });
        this.bqStatus  = '✅ Connected to ' + r.project + ' — datasets: ' + (r.sample_datasets || []).join(', ');
        this.bqStatusOk = true;
      } catch (e) {
        this.bqStatus  = '❌ ' + e.message;
        this.bqStatusOk = false;
      }
    },

    runBQQuery: async function() {
      if (!this.bqSql.trim()) return;
      this.bqLoading = true; this.bqRows = []; this.bqCols = []; this.bqInfo = null;
      try {
        var r = await apiCall('/api/bigquery/query', { method: 'POST', body: JSON.stringify({ sql: this.bqSql }) });
        this.bqCols = (r.schema || []).map(function(f) { return { key: f.name, label: f.name + ' (' + f.type + ')' }; });
        this.bqRows = r.rows || [];
        this.bqInfo = {
          rowCount:       (r.rows && r.rows.length) || 0,
          truncated:      r.truncated || false,
          bytesProcessed: r.bytes_processed || 0,
        };
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.bqLoading = false; }
    },

    // ---- fill (example chips) ----------------------------------------
    fill: function(field, val) { this[field] = val; },
  },

  // ------------------------------------------------------------------
  mounted: function() {
    this.loadStatus();
    this.loadHealth();
  },
})
.component('DataTable', DataTableComp)
.component('AutoInput', AutoInputComp)
.mount('#app');

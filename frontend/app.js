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
// Font size: apply on load
// =============================================================
(function() {
  var saved = localStorage.getItem('aiindbt_fontsize');
  if (saved) {
    document.documentElement.style.fontSize = saved + 'px';
  }
})();

// =============================================================
// Model list cache
// =============================================================
var _acCache = null;
async function getModelList() {
  if (_acCache) return _acCache;
  try {
    var r = await fetch('/api/models/list');
    var d = await r.json();
    var items = [];
    (d.models || []).forEach(function(m) {
      items.push({ name: m.name, kind: 'model', extra: m.materialized || '' });
    });
    (d.sources || []).forEach(function(s) {
      items.push({ name: s.name, kind: 'source', extra: s.source_name || '' });
    });
    // Unique dbt source names (e.g. "stripe", "salesforce")
    var srcNamesSeen = {};
    (d.sources || []).forEach(function(s) {
      if (s.source_name && !srcNamesSeen[s.source_name]) {
        srcNamesSeen[s.source_name] = true;
        items.push({ name: s.source_name, kind: 'source_name', extra: '' });
      }
    });
    // Source tables (table_name scoped to source_name)
    (d.source_tables || []).forEach(function(t) {
      items.push({ name: t.table_name, kind: 'source_table', extra: t.source_name || '' });
    });
    _acCache = items;
  } catch (_) { _acCache = []; }
  return _acCache;
}

// =============================================================
// Lineage cache
// =============================================================
var _lineageCache = null;
async function getLineageGraph() {
  if (_lineageCache) return _lineageCache;
  try {
    var r = await fetch('/api/lineage');
    _lineageCache = await r.json();
  } catch (_) { _lineageCache = { nodes: [], edges: [] }; }
  return _lineageCache;
}

// =============================================================
// DOCS_PAGES
// =============================================================
var DOCS_PAGES = [
  { id: 'gs-overview', section: 'Getting Started', title: 'Overview',
    body: '<p>AIinDbt is a self-hosted web app that brings AI features into your dbt workflow — no cloud signup beyond your API keys.</p><h2>Features</h2><ul><li><b>A1</b> AI Doc Generator — auto-writes YAML descriptions</li><li><b>A2</b> Model Scaffolding — full model from a brief</li><li><b>A3</b> Staging Generator — RAW → stg_*</li><li><b>A4</b> Incremental Advisor — scores &amp; rewrites models</li><li><b>B1</b> Chat — plain-English Q&amp;A on your project</li><li><b>B2</b> NL→SQL — business question → warehouse SQL</li><li><b>B3</b> Semantic Search — search across all models</li><li><b>C1</b> Test Generator — schema.yml tests from sample data</li><li><b>C2</b> Anomaly Detection — Elementary tests</li><li><b>C3</b> Quality Scores — 0–100 health score per model</li><li><b>D1</b> Lineage Graph — interactive DAG</li><li><b>D2</b> Column Lineage — trace a column upstream</li><li><b>D3</b> Health Dashboard — KPI overview</li><li><b>E2</b> Teams Bot — slash commands in Microsoft Teams</li><li>BigQuery runner — run generated SQL directly</li><li>Model Splitter — split large models into sub-models</li><li>Dialect Converter — convert SQL between warehouses</li></ul>' },
  { id: 'gs-install', section: 'Getting Started', title: 'Installation',
    body: '<h2>macOS / Linux</h2><pre>pip install -r requirements.txt\n./run.sh</pre><h2>Windows</h2><pre>python -m pip install -r requirements.txt\npython -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre><p>If <code>python</code> not found, use <code>py</code>:</p><pre>py -m pip install -r requirements.txt\npy -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre><div class="callout">Settings are in-memory only — re-enter after server restart.</div>' },
  { id: 'gs-settings', section: 'Getting Started', title: 'Settings',
    body: '<h2>LLM Key</h2><p>Paste your Cline key, Anthropic key, or OpenRouter key.</p><table><thead><tr><th>Gateway</th><th>Base URL</th></tr></thead><tbody><tr><td>Anthropic direct</td><td>(leave blank)</td></tr><tr><td>OpenRouter / Cline</td><td>https://openrouter.ai/api/v1</td></tr></tbody></table><h2>dbt Project</h2><p>Run <code>dbt parse</code> then upload <code>target/manifest.json</code>. This unlocks autocomplete, lineage, docs generation, and all model-aware features.</p><h2>.env File</h2><p>You can bulk-import settings by uploading a <code>.env</code> file from the Settings panel. Click "Download example .env" to get a template with all supported keys.</p>' },
  { id: 'feat-a1', section: 'Features', title: 'A1 — AI Doc Generator',
    body: '<p>Auto-generates schema.yml descriptions for any model and its columns.</p><h2>How to use</h2><ol><li>Upload manifest.json</li><li>Click <b>List undocumented</b> to see which models need attention</li><li>Type a model name (autocomplete will suggest options)</li><li>Click <b>Generate YAML</b> and paste into your schema.yml</li></ol>' },
  { id: 'feat-a2', section: 'Features', title: 'A2 — Model Scaffolding',
    body: '<p>Generates a complete dbt model (SQL + schema.yml) from a plain-English brief using your real project\'s refs.</p><h2>Quick brief examples</h2><ul><li><i>Daily revenue by country joining orders and customers, last 90 days</i></li><li><i>Monthly active users grouped by plan tier</i></li></ul><p>Click <b>Structured form</b> for a guided, field-by-field approach.</p>' },
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
    body: '<p>Interactive DAG with hierarchical LR layout. Click a node for details inline below the toolbar. Search to highlight + Isolate toggle to show only connected nodes.</p>' },
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
// SvgLineage  — pure-SVG DAG renderer, replaces vis-network
// =============================================================
var SVG_NS = 'http://www.w3.org/2000/svg';
function _svgEl(tag, attrs, text) {
  var el = document.createElementNS(SVG_NS, tag);
  if (attrs) Object.keys(attrs).forEach(function(k) { el.setAttribute(k, attrs[k]); });
  if (text !== undefined) el.textContent = text;
  return el;
}

var LAYER_COLORS = {
  source:       { bg: '#E8F5E9', border: '#2E7D32', font: '#1B5E20' },
  seed:         { bg: '#F3E5F5', border: '#7B1FA2', font: '#4A148C' },
  staging:      { bg: '#E3F2FD', border: '#1565C0', font: '#0D47A1' },
  intermediate: { bg: '#FFF3E0', border: '#E65100', font: '#BF360C' },
  marts:        { bg: '#FCE4EC', border: '#C62828', font: '#B71C1C' },
  other:        { bg: '#F5F5F5', border: '#616161', font: '#212121' },
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

function LineageViewer(netId, onClickNode) {
  this.container   = document.getElementById(netId);
  this.onSelect    = onClickNode || function() {};
  this._allNodes   = [];
  this._allEdges   = [];
  this._byId       = {};
  this._hiddenIds  = {};
  this._selId      = null;
  this._searchQ    = '';
  this._isolated   = false;
  this._vx = 0; this._vy = 0; this._vscale = 1;
  this._dragging   = false;
  this._svg        = null;
  this._g          = null;
  this._edgeG      = null;
  this._nodeG      = null;
}

LineageViewer.prototype.load = function(g) {
  var self = this;
  var rawNodes = g.nodes || [], rawEdges = g.edges || [];

  /* ---- 1. build adjacency ---- */
  var children = {}, parents = {}, indeg = {};
  rawNodes.forEach(function(n) { children[n.id] = []; parents[n.id] = []; indeg[n.id] = 0; });
  rawEdges.forEach(function(e) {
    if (children[e.from]) children[e.from].push(e.to);
    if (parents[e.to])   parents[e.to].push(e.from);
    if (indeg[e.to] !== undefined) indeg[e.to]++;
  });

  /* ---- 2. level = longest path from any source (Kahn BFS) ---- */
  var levels = {};
  var queue = rawNodes.filter(function(n) { return indeg[n.id] === 0; })
                      .map(function(n) { levels[n.id] = 0; return n.id; });
  var qi = 0;
  while (qi < queue.length) {
    var cur = queue[qi++];
    children[cur].forEach(function(child) {
      levels[child] = Math.max(levels[child] === undefined ? 0 : levels[child], levels[cur] + 1);
      indeg[child]--;
      if (indeg[child] <= 0) queue.push(child);
    });
  }
  rawNodes.forEach(function(n) { if (levels[n.id] === undefined) levels[n.id] = 0; });

  /* ---- 3. group by level, sort within level ---- */
  var byLevel = {};
  rawNodes.forEach(function(n) {
    var lv = levels[n.id] || 0;
    if (!byLevel[lv]) byLevel[lv] = [];
    byLevel[lv].push(n);
  });
  Object.keys(byLevel).forEach(function(lv) {
    byLevel[lv].sort(function(a, b) {
      var pa = (parents[a.id] || []).map(function(pid) { return levels[pid] || 0; });
      var pb = (parents[b.id] || []).map(function(pid) { return levels[pid] || 0; });
      var avgA = pa.length ? pa.reduce(function(s, v) { return s + v; }, 0) / pa.length : 0;
      var avgB = pb.length ? pb.reduce(function(s, v) { return s + v; }, 0) / pb.length : 0;
      if (avgA !== avgB) return avgA - avgB;
      return a.name.localeCompare(b.name);
    });
  });

  /* ---- 4. assign pixel positions ---- */
  var NW = 172, NH = 40, HGAP = 70, VGAP = 16;
  var positioned = [];
  self._byId = {};
  var sortedLevels = Object.keys(byLevel).sort(function(a, b) { return +a - +b; });
  sortedLevels.forEach(function(lv, lvIdx) {
    byLevel[lv].forEach(function(n, row) {
      var pn = {
        id: n.id, name: n.name, kind: n.kind || 'model',
        schema: n.schema || '', description: n.description || '',
        materialized: n.materialized || ((n.config || {}).materialized) || '',
        layer: lineageLayerFor(n), level: +lv,
        x: lvIdx * (NW + HGAP) + 20,
        y: row  * (NH + VGAP) + 20,
        w: NW, h: NH, raw: n,
      };
      positioned.push(pn);
      self._byId[n.id] = pn;
    });
  });
  this._allNodes = positioned;
  this._allEdges = rawEdges;
  this._hiddenIds = {};
  this._selId = null;

  /* ---- 5. compute canvas size + initial fit ---- */
  var maxX = 0, maxY = 0;
  positioned.forEach(function(n) { maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h); });

  if (!this.container) return;
  var cw = this.container.clientWidth  || 900;
  var ch = this.container.clientHeight || 580;
  var scaleX = (cw - 40) / (maxX + 20 || 1);
  var scaleY = (ch - 40) / (maxY + 20 || 1);
  this._vscale = Math.min(1.2, Math.min(scaleX, scaleY));
  this._vx = 20; this._vy = 20;

  this._createSvg();
  this._render();
  this._bindEvents();
};

LineageViewer.prototype._createSvg = function() {
  if (!this.container) return;
  this.container.innerHTML = '';
  var svg = _svgEl('svg', { width: '100%', height: '100%', style: 'display:block;cursor:grab;user-select:none;background:#FAFBFD' });
  this._svg = svg;

  /* arrowhead marker */
  var defs = _svgEl('defs');
  var marker = _svgEl('marker', { id: 'arr', markerWidth: '8', markerHeight: '8', refX: '7', refY: '3.5', orient: 'auto' });
  marker.appendChild(_svgEl('path', { d: 'M0,0 L0,7 L8,3.5 z', fill: '#90A4AE' }));
  var markerSel = _svgEl('marker', { id: 'arrSel', markerWidth: '8', markerHeight: '8', refX: '7', refY: '3.5', orient: 'auto' });
  markerSel.appendChild(_svgEl('path', { d: 'M0,0 L0,7 L8,3.5 z', fill: '#1565C0' }));
  defs.appendChild(marker); defs.appendChild(markerSel);
  svg.appendChild(defs);

  var g = _svgEl('g');
  this._g = g;
  this._edgeG = _svgEl('g');
  this._nodeG = _svgEl('g');
  g.appendChild(this._edgeG);
  g.appendChild(this._nodeG);
  svg.appendChild(g);
  this.container.appendChild(svg);
};

LineageViewer.prototype._applyTransform = function() {
  if (this._g) this._g.setAttribute('transform',
    'translate(' + this._vx + ',' + this._vy + ') scale(' + this._vscale + ')');
};

LineageViewer.prototype._render = function() {
  var self = this;
  if (!this._edgeG || !this._nodeG) return;
  while (this._edgeG.firstChild) this._edgeG.removeChild(this._edgeG.firstChild);
  while (this._nodeG.firstChild)  this._nodeG.removeChild(this._nodeG.firstChild);

  /* edges */
  this._allEdges.forEach(function(e) {
    var f = self._byId[e.from], t = self._byId[e.to];
    if (!f || !t || self._hiddenIds[e.from] || self._hiddenIds[e.to]) return;
    var x1 = f.x + f.w, y1 = f.y + f.h / 2;
    var x2 = t.x,        y2 = t.y + t.h / 2;
    var cx = (x1 + x2) / 2;
    var isSel = (self._selId === e.from || self._selId === e.to);
    var dimmed = self._searchQ && !isSel &&
      !f.name.toLowerCase().includes(self._searchQ) && !t.name.toLowerCase().includes(self._searchQ);
    self._edgeG.appendChild(_svgEl('path', {
      d: 'M' + x1 + ' ' + y1 + ' C' + cx + ' ' + y1 + ' ' + cx + ' ' + y2 + ' ' + x2 + ' ' + y2,
      fill: 'none',
      stroke: isSel ? '#1565C0' : '#B0BEC5',
      'stroke-width': isSel ? '2' : '1.5',
      opacity: dimmed ? '0.15' : (isSel ? '1' : '0.75'),
      'marker-end': isSel ? 'url(#arrSel)' : 'url(#arr)',
    }));
  });

  /* nodes */
  this._allNodes.forEach(function(n) {
    if (self._hiddenIds[n.id]) return;
    var c = LAYER_COLORS[n.layer] || LAYER_COLORS.other;
    var isSel = n.id === self._selId;
    var isMatch = self._searchQ && n.name.toLowerCase().includes(self._searchQ);
    var dimmed  = self._searchQ && !isMatch && !isSel;

    var grp = _svgEl('g', {
      transform: 'translate(' + n.x + ',' + n.y + ')',
      opacity: dimmed ? '0.18' : '1',
      style: 'cursor:pointer',
    });

    /* shadow rect */
    grp.appendChild(_svgEl('rect', {
      x: '2', y: '3', width: String(n.w), height: String(n.h),
      rx: '8', fill: 'rgba(0,0,0,0.08)',
    }));
    /* main rect */
    grp.appendChild(_svgEl('rect', {
      x: '0', y: '0', width: String(n.w), height: String(n.h),
      rx: '8',
      fill: isSel ? '#BBDEFB' : (isMatch ? '#FFF9C4' : c.bg),
      stroke: isSel ? '#1565C0' : c.border,
      'stroke-width': isSel ? '2.5' : '1.5',
    }));
    /* left accent bar */
    grp.appendChild(_svgEl('rect', {
      x: '0', y: '0', width: '4', height: String(n.h),
      rx: '4', fill: c.border,
    }));
    /* label */
    var label = n.name.length > 24 ? n.name.slice(0, 22) + '…' : n.name;
    grp.appendChild(_svgEl('text', {
      x: '14', y: String(n.h / 2 + 5),
      'font-size': '12.5', 'font-family': 'Roboto,Arial,sans-serif',
      'font-weight': isSel ? '700' : '500',
      fill: c.font, 'pointer-events': 'none',
    }, label));
    /* kind pill (non-model) */
    if (n.kind !== 'model') {
      var kLabel = n.kind.slice(0, 6);
      var kw = kLabel.length * 6 + 8;
      grp.appendChild(_svgEl('rect', { x: String(n.w - kw - 4), y: '5', width: String(kw), height: '14', rx: '7', fill: c.border, opacity: '0.25' }));
      grp.appendChild(_svgEl('text', {
        x: String(n.w - kw / 2 - 4), y: '15',
        'font-size': '8', 'text-anchor': 'middle', fill: c.font, opacity: '0.8',
        'font-family': 'Roboto,Arial,sans-serif', 'pointer-events': 'none',
      }, kLabel));
    }

    grp.addEventListener('click', function(ev) {
      ev.stopPropagation();
      self._selId = (self._selId === n.id) ? null : n.id;
      self.onSelect(self._selId ? (n.raw || n) : null);
      if (self._selId) self._centerOn(n);
      self._render();
    });

    /* hover highlight */
    grp.addEventListener('mouseenter', function() {
      grp.querySelector('rect:nth-child(2)') &&
        grp.querySelector('rect:nth-child(2)').setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.22))');
    });
    grp.addEventListener('mouseleave', function() {
      grp.querySelector('rect:nth-child(2)') &&
        grp.querySelector('rect:nth-child(2)').removeAttribute('filter');
    });

    self._nodeG.appendChild(grp);
  });

  /* click background to deselect */
  this._svg && this._svg.onclick || (this._svg && this._svg.addEventListener('click', function() {
    if (self._selId) { self._selId = null; self.onSelect(null); self._render(); }
  }));

  this._applyTransform();
};

LineageViewer.prototype._centerOn = function(n) {
  var cw = (this.container && this.container.clientWidth)  || 900;
  var ch = (this.container && this.container.clientHeight) || 580;
  this._vx = cw / 2 - (n.x + n.w / 2) * this._vscale;
  this._vy = ch / 2 - (n.y + n.h / 2) * this._vscale;
  this._applyTransform();
};

LineageViewer.prototype.search = function(q) {
  this._searchQ = q ? q.toLowerCase() : '';
  this._hiddenIds = {};
  if (this._isolated && this._searchQ) {
    var matchIds = {}, self = this;
    this._allNodes.forEach(function(n) { if (n.name.toLowerCase().includes(self._searchQ)) matchIds[n.id] = true; });
    var connected = Object.assign({}, matchIds);
    this._allEdges.forEach(function(e) {
      if (matchIds[e.from]) connected[e.to] = true;
      if (matchIds[e.to])   connected[e.from] = true;
    });
    this._allNodes.forEach(function(n) { if (!connected[n.id]) self._hiddenIds[n.id] = true; });
  }
  if (this._searchQ) {
    var first = null;
    for (var i = 0; i < this._allNodes.length; i++) {
      if (this._allNodes[i].name.toLowerCase().includes(this._searchQ)) { first = this._allNodes[i]; break; }
    }
    if (first) this._centerOn(first);
  }
  this._render();
};

LineageViewer.prototype.toggleIsolate = function() {
  this._isolated = !this._isolated;
  this.search(this._searchQ);
  return this._isolated;
};

LineageViewer.prototype.fitView = function() {
  var self = this;
  var visible = this._allNodes.filter(function(n) { return !self._hiddenIds[n.id]; });
  if (!visible.length || !this.container) return;
  var minX = visible[0].x, minY = visible[0].y, maxX = 0, maxY = 0;
  visible.forEach(function(n) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  });
  var cw = this.container.clientWidth || 900, ch = this.container.clientHeight || 580;
  this._vscale = Math.min(1.5, Math.min((cw - 40) / (maxX - minX + 20), (ch - 40) / (maxY - minY + 20)));
  this._vx = 20 - minX * this._vscale;
  this._vy = 20 - minY * this._vscale;
  this._applyTransform();
};

LineageViewer.prototype.zoomIn  = function() { this._vscale = Math.min(4, this._vscale * 1.25); this._applyTransform(); };
LineageViewer.prototype.zoomOut = function() { this._vscale = Math.max(0.1, this._vscale * 0.8); this._applyTransform(); };
LineageViewer.prototype.setPhysics = function() {}; /* no-op — physics replaced by topo layout */

LineageViewer.prototype._bindEvents = function() {
  var self = this, el = this._svg;
  if (!el) return;
  var sx, sy, svx, svy;

  el.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    self._dragging = true;
    sx = e.clientX; sy = e.clientY; svx = self._vx; svy = self._vy;
    el.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', function(e) {
    if (!self._dragging) return;
    self._vx = svx + (e.clientX - sx); self._vy = svy + (e.clientY - sy);
    self._applyTransform();
  });
  window.addEventListener('mouseup', function() {
    self._dragging = false;
    if (self._svg) self._svg.style.cursor = 'grab';
  });
  el.addEventListener('wheel', function(e) {
    e.preventDefault();
    var rect = el.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var factor = e.deltaY > 0 ? 0.85 : 1.18;
    var ns = Math.max(0.08, Math.min(5, self._vscale * factor));
    self._vx = mx - (mx - self._vx) * (ns / self._vscale);
    self._vy = my - (my - self._vy) * (ns / self._vscale);
    self._vscale = ns;
    self._applyTransform();
  }, { passive: false });
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
    rowClickable: { type: Boolean, default: false },
  },
  data: function() { return { q: '', filterCol: '', page: 0, sortKey: null, sortDir: 1, pageSize: 50, expanded: false }; },
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
          <button class="btn btn-secondary btn-sm" @click="expanded=!expanded" :title="expanded?\'Collapse table\':\'Expand table\'">\
            {{ expanded ? \'⤢ Collapse\' : \'⤡ Expand\' }}\
          </button>\
          <button class="btn btn-secondary btn-sm" @click="doExport">⬇ Excel</button>\
          <button class="btn btn-secondary btn-sm no-print" onclick="window.print()">\u{1f5a8} PDF</button>\
        </div>\
      </div>\
      <div class="scroll-table-container" :class="{expanded: expanded}">\
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
            <tr v-for="(row,ri) in paged" :key="ri" :class="{\'row-clickable\': rowClickable}" :style="rowClickable ? \'cursor:pointer\' : \'\'" @click="rowClickable ? $emit(\'row-click\', row) : null">\
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
    modelValue:   { type: String, default: '' },
    kind:         String,
    placeholder:  { type: String, default: '' },
    inputId:      String,
    sourceFilter: { type: String, default: '' },
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
        if (self.kind && m.kind !== self.kind) return false;
        if (self.kind === 'source_table' && self.sourceFilter && m.extra.toLowerCase() !== self.sourceFilter.toLowerCase()) return false;
        return m.name.toLowerCase().includes(q) || (m.extra || '').toLowerCase().includes(q);
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
    kindLabel: function(kind) {
      var labels = { model: 'M', source: 'S', source_name: 'SRC', source_table: 'TBL' };
      return labels[kind] || kind;
    },
  },
  template: '\
    <div class="autocomplete-wrap">\
      <input :id="inputId" :value="modelValue" :placeholder="placeholder"\
        @input="onInput($event.target.value)" @keydown="onKeydown" @blur="onBlur" />\
      <div v-if="suggestions.length" class="autocomplete-dropdown">\
        <div v-for="(item,i) in suggestions" :key="item.name+\'|\'+item.kind"\
          class="autocomplete-item" :class="{focused:i===highlighted}"\
          @mousedown.prevent="pick(item)">\
          <span class="ac-kind" :class="item.kind">{{ kindLabel(item.kind) }}</span>\
          <span>{{ item.name }}</span>\
          <span v-if="item.extra" style="color:var(--md-on-surface-variant);font-size:.72rem;margin-left:auto">{{ item.extra }}</span>\
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
    var savedFontSize = parseInt(localStorage.getItem('aiindbt_fontsize') || '14', 10);
    return {
      // Navigation
      panel: 'health',
      sidebarOpen: false,
      bookmarksOpen: false,
      toasts: [],

      // Status
      statusDots: [],
      lineageBadge: 0,
      llmConfigured: false,

      // Font size
      fontSize: savedFontSize,

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
      sqlDialectSetting: 'snowflake',

      // Health
      healthKpis: [],
      healthWorst: [],
      healthTop: [],

      // Quality
      qualityRows: [],

      // Lineage
      _lineageViewer: null,
      lineageDetailNode: null,
      lineageIsolated: false,

      // Column lineage
      colModel: '',
      colColumn: '',
      colColQ: '',
      colTrail: [],
      colRan: false,
      colColumnSuggestions: [],
      showColSuggestions: false,

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

      // SQL Optimizer
      sqlInput: '',
      sqlVendor: 'snowflake',
      sqlResult: null,
      sqlLoading: false,
      sqlMode: 'paste',
      sqlSingleModel: '',
      sqlLineageModel: '',
      sqlLineageModels: [],
      sqlHandpickInput: '',
      sqlHandpicked: [],
      sqlModelSqls: {},
      sqlSuggestions: [],

      // GitLab
      gitlabBaseUrl: 'https://gitlab.com',
      gitlabToken: '',
      gitlabProject: '',
      gitlabBranch: 'main',
      gitlabBranches: [],
      gitlabPushing: false,

      // GitLab inline push forms (keyed by form id)
      glForms: {
        docYaml:  { branch: 'main', message: 'feat: add AI-generated docs via AIinDbt' },
        scafSql:  { branch: 'main', message: 'feat: add scaffolded model via AIinDbt' },
        scafYaml: { branch: 'main', message: 'feat: add scaffold schema.yml via AIinDbt' },
        stgSql:   { branch: 'main', message: 'feat: add staging model via AIinDbt' },
        stgYaml:  { branch: 'main', message: 'feat: add staging schema.yml via AIinDbt' },
      },

      // Model Splitter
      splitterSql: '',
      splitterModelName: 'my_model',
      splitterResult: null,
      splitterLoading: false,
      splitterGlBranch: null,
      splitterGlMsg: null,

      // Dialect Converter
      convSourceDialect: 'snowflake',
      convTargetDialect: 'bigquery',
      convMode: 'paste',
      convSql: '',
      convModelName: '',
      convLineageModel: '',
      convResults: [],
      convLoading: false,
      convLineagePreview: [],    // {name, selected} list shown before conversion
      convLineagePreviewing: false,

      // SQL Optimizer GitLab form
      sqlOptGlOpen: false,
      sqlOptGlBranch: 'main',
      sqlOptGlMsg: 'feat: apply SQL optimization via AIinDbt',

      // Scaffold structured mode
      scafMode: 'brief',
      scafSources: '',
      scafGrain: '',
      scafMetrics: '',
      scafFilters: '',

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
        sqlopt: 'SQL Optimizer', splitter: 'Model Splitter', converter: 'Dialect Converter',
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

    filteredColSuggestions: function() {
      var q = (this.colColQ || '').toLowerCase();
      if (!q) return this.colColumnSuggestions;
      return this.colColumnSuggestions.filter(function(c) { return c.toLowerCase().includes(q); });
    },
  },

  // ------------------------------------------------------------------
  watch: {
    gitlabBranch: function(val) {
      // Sync default branch to all GL forms
      var self = this;
      Object.keys(this.glForms).forEach(function(k) {
        if (!self.glForms[k]._userEdited) self.glForms[k].branch = val;
      });
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

    // ---- Copy text ---------------------------------------------------
    copyText: async function(txt) {
      if (!txt) return;
      await navigator.clipboard.writeText(txt);
      this.toast('Copied', 'success');
    },

    // ---- Font size ---------------------------------------------------
    setFontSize: function(size) {
      this.fontSize = size;
      document.documentElement.style.fontSize = size + 'px';
      localStorage.setItem('aiindbt_fontsize', String(size));
    },

    // ---- .env upload -------------------------------------------------
    uploadEnvFile: function(event) {
      var self = this;
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        var text = e.target.result;
        var lines = text.split('\n');
        var map = {};
        lines.forEach(function(line) {
          line = line.trim();
          if (!line || line.startsWith('#')) return;
          var eq = line.indexOf('=');
          if (eq < 0) return;
          var key = line.slice(0, eq).trim();
          var val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
          map[key] = val;
        });
        // Map env keys to settings
        if (map.LLM_API_KEY)              self.llmApiKey           = map.LLM_API_KEY;
        if (map.LLM_BASE_URL)             self.llmBaseUrl          = map.LLM_BASE_URL;
        if (map.LLM_MODEL)                self.llmModel            = map.LLM_MODEL;
        if (map.SQL_DIALECT)              self.sqlDialectSetting   = map.SQL_DIALECT;
        if (map.DBT_CLOUD_HOST)           self.dbtCloudHost        = map.DBT_CLOUD_HOST;
        if (map.DBT_CLOUD_ACCOUNT_ID)     self.dbtCloudAccountId   = map.DBT_CLOUD_ACCOUNT_ID;
        if (map.DBT_CLOUD_PROJECT_ID)     self.dbtCloudProjectId   = map.DBT_CLOUD_PROJECT_ID;
        if (map.DBT_CLOUD_TOKEN)          self.dbtCloudToken       = map.DBT_CLOUD_TOKEN;
        if (map.GITLAB_BASE_URL)          self.gitlabBaseUrl       = map.GITLAB_BASE_URL;
        if (map.GITLAB_TOKEN)             self.gitlabToken         = map.GITLAB_TOKEN;
        if (map.GITLAB_PROJECT)           self.gitlabProject       = map.GITLAB_PROJECT;
        if (map.GITLAB_BRANCH)            self.gitlabBranch        = map.GITLAB_BRANCH;
        if (map.TEAMS_OUTGOING_SECRET)    self.teamsSecret         = map.TEAMS_OUTGOING_SECRET;
        if (map.TEAMS_INCOMING_WEBHOOK)   self.teamsWebhook        = map.TEAMS_INCOMING_WEBHOOK;
        self.toast('Loaded ' + Object.keys(map).length + ' keys from .env', 'success');
      };
      reader.readAsText(file);
      // Reset input so same file can be reloaded
      event.target.value = '';
    },

    // ---- Download example .env ---------------------------------------
    downloadExampleEnv: function() {
      var content = [
        '# AIinDbt example .env — fill in your values and upload via Settings',
        '',
        '# LLM',
        'LLM_API_KEY=sk-ant-...',
        'LLM_BASE_URL=',
        'LLM_MODEL=claude-sonnet-4-6',
        'SQL_DIALECT=snowflake',
        '',
        '# dbt Cloud (alternative to manifest.json upload)',
        'DBT_CLOUD_HOST=cloud.getdbt.com',
        'DBT_CLOUD_ACCOUNT_ID=',
        'DBT_CLOUD_PROJECT_ID=',
        'DBT_CLOUD_TOKEN=',
        '',
        '# GitLab',
        'GITLAB_BASE_URL=https://gitlab.com',
        'GITLAB_TOKEN=glpat-...',
        'GITLAB_PROJECT=myorg/my-dbt-repo',
        'GITLAB_BRANCH=main',
        '',
        '# Microsoft Teams',
        'TEAMS_OUTGOING_SECRET=',
        'TEAMS_INCOMING_WEBHOOK=',
      ].join('\n');
      var blob = new Blob([content], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '.env.example';
      a.click();
    },

    // ---- Status / Settings load --------------------------------------
    loadStatus: async function() {
      try {
        var s = await apiCall('/api/settings');
        var cfg = s.configured || {};
        this.llmConfigured = !!cfg.llm;
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
        if (s.gitlab_base_url)       this.gitlabBaseUrl       = s.gitlab_base_url;
        if (s.gitlab_project)        this.gitlabProject       = s.gitlab_project;
        if (s.gitlab_branch) {
          this.gitlabBranch   = s.gitlab_branch;
          this.sqlOptGlBranch = s.gitlab_branch;
          var self2 = this;
          Object.keys(this.glForms).forEach(function(k) { if (!self2.glForms[k]._userEdited) self2.glForms[k].branch = s.gitlab_branch; });
        }
        if (s.sql_dialect)           this.sqlDialectSetting   = s.sql_dialect;
        this.teamsWebhookUrl = window.location.origin + '/api/teams/events';
        // Sync GL form branches to current branch
        var branch = s.gitlab_branch || 'main';
        var self = this;
        Object.keys(this.glForms).forEach(function(k) { self.glForms[k].branch = branch; });
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
            gitlab_base_url:       this.gitlabBaseUrl   || undefined,
            gitlab_token:          this.gitlabToken     || undefined,
            gitlab_project:        this.gitlabProject   || undefined,
            gitlab_branch:         this.gitlabBranch    || undefined,
            sql_dialect:           this.sqlDialectSetting || undefined,
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
      var self = this;
      try {
        var g = await apiCall('/api/lineage');
        _lineageCache = g;
        if (!this._lineageViewer) {
          this._lineageViewer = new LineageViewer('lineage-net', function(node) {
            self.lineageDetailNode = node || null;
          });
        }
        /* refresh container ref in case DOM was recreated */
        this._lineageViewer.container = document.getElementById('lineage-net');
        this._lineageViewer.load(g);
        this.toast('Loaded ' + g.nodes.length + ' nodes, ' + g.edges.length + ' edges', 'success');
      } catch (e) { this.toast(e.message, 'error'); }
    },
    lineageSearch: function(q) {
      if (this._lineageViewer) this._lineageViewer.search(q);
    },
    lineageToggleIsolate: function() {
      if (this._lineageViewer) {
        this.lineageIsolated = this._lineageViewer.toggleIsolate();
      }
    },
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

    loadColColumns: async function(modelName) {
      var name = modelName || this.colModel;
      if (!name) { this.colColumnSuggestions = []; return; }
      try {
        var r = await apiCall('/api/models/' + encodeURIComponent(name) + '/columns');
        this.colColumnSuggestions = r.columns || [];
      } catch (_) { this.colColumnSuggestions = []; }
    },

    hideColSuggestions: function() {
      var self = this;
      setTimeout(function() { self.showColSuggestions = false; }, 150);
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
      var question = '';
      var idx = this.chatMessages.findIndex(function(m) { return m.id === msg.id; });
      for (var i = idx - 1; i >= 0; i--) {
        if (this.chatMessages[i].role === 'user') { question = this.chatMessages[i].text; break; }
      }
      this.chatBookmarks.unshift({
        id: Date.now(),
        question: question,
        answer: msg.text || '',
        ts: new Date().toISOString(),
        expanded: false,
      });
      localStorage.setItem('aiindbt_bookmarks', JSON.stringify(this.chatBookmarks));
      this.toast('Bookmarked', 'success');
    },

    deleteBookmark: function(id) {
      this.chatBookmarks = this.chatBookmarks.filter(function(b) { return b.id !== id; });
      localStorage.setItem('aiindbt_bookmarks', JSON.stringify(this.chatBookmarks));
    },

    copyBookmark: async function(b) {
      var txt = (b.question ? 'Q: ' + b.question + '\n\nA: ' : '') + (b.answer || '');
      await navigator.clipboard.writeText(txt);
      this.toast('Copied', 'success');
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

    // ---- SQL Optimizer ----------------------------------------------
    loadSingleModelSql: async function(name) {
      var n = name || this.sqlSingleModel;
      if (!n) return;
      try {
        var r = await apiCall('/api/models/' + encodeURIComponent(n) + '/sql');
        var sqls = Object.assign({}, this.sqlModelSqls);
        sqls[n] = r.raw_sql || '';
        this.sqlModelSqls = sqls;
        this.sqlInput = r.raw_sql || '';
      } catch (e) { this.toast('Could not load SQL for ' + n + ': ' + e.message, 'error'); }
    },

    addHandpickedModel: function(name) {
      if (!name) return;
      if (this.sqlHandpicked.indexOf(name) < 0) {
        this.sqlHandpicked = this.sqlHandpicked.concat([name]);
      }
      this.sqlHandpickInput = '';
    },

    removeHandpickedModel: function(name) {
      this.sqlHandpicked = this.sqlHandpicked.filter(function(m) { return m !== name; });
    },

    loadSqlSuggestions: async function() {
      try {
        var rows = await apiCall('/api/quality');
        this.sqlSuggestions = rows.filter(function(r) { return r.score < 70; })
          .sort(function(a, b) { return a.score - b.score; })
          .slice(0, 15)
          .map(function(r) { return { name: r.name, score: r.score }; });
        if (!this.sqlSuggestions.length) this.toast('All models score ≥ 70 — no suggestions', 'info');
      } catch (e) { this.toast(e.message, 'error'); }
    },

    _buildSqlInput: async function() {
      // Build sqlInput from current mode
      var self = this;
      if (this.sqlMode === 'paste') {
        return this.sqlInput;
      }
      if (this.sqlMode === 'single') {
        if (!this.sqlModelSqls[this.sqlSingleModel]) await this.loadSingleModelSql(this.sqlSingleModel);
        return this.sqlModelSqls[this.sqlSingleModel] || this.sqlInput;
      }
      if (this.sqlMode === 'handpick') {
        var sqls = [];
        for (var i = 0; i < this.sqlHandpicked.length; i++) {
          var m = this.sqlHandpicked[i];
          if (!this.sqlModelSqls[m]) {
            try {
              var r = await apiCall('/api/models/' + encodeURIComponent(m) + '/sql');
              var updated = Object.assign({}, self.sqlModelSqls);
              updated[m] = r.raw_sql || '';
              self.sqlModelSqls = updated;
            } catch (_) {}
          }
          if (this.sqlModelSqls[m]) sqls.push('-- Model: ' + m + '\n' + this.sqlModelSqls[m]);
        }
        return sqls.join('\n\n');
      }
      if (this.sqlMode === 'upstream' || this.sqlMode === 'downstream') {
        if (!this.sqlLineageModel) return '';
        var g = await getLineageGraph();
        var nodes = g.nodes || [], edges = g.edges || [];
        var targetNode = nodes.find(function(n) { return n.name === self.sqlLineageModel; });
        if (!targetNode) return '';
        var targetId = targetNode.id;
        var relatedNames = [self.sqlLineageModel];
        if (self.sqlMode === 'upstream') {
          // BFS upstream
          var queue = [targetId];
          var visited = {};
          visited[targetId] = true;
          while (queue.length) {
            var cur = queue.shift();
            edges.forEach(function(e) {
              if (e.to === cur && !visited[e.from]) {
                visited[e.from] = true;
                queue.push(e.from);
                var n = nodes.find(function(nd) { return nd.id === e.from; });
                if (n) relatedNames.push(n.name);
              }
            });
          }
        } else {
          // BFS downstream
          var queue2 = [targetId];
          var visited2 = {};
          visited2[targetId] = true;
          while (queue2.length) {
            var cur2 = queue2.shift();
            edges.forEach(function(e) {
              if (e.from === cur2 && !visited2[e.to]) {
                visited2[e.to] = true;
                queue2.push(e.to);
                var n2 = nodes.find(function(nd) { return nd.id === e.to; });
                if (n2) relatedNames.push(n2.name);
              }
            });
          }
        }
        self.sqlLineageModels = relatedNames;
        var sqls2 = [];
        for (var j = 0; j < relatedNames.length; j++) {
          var mn = relatedNames[j];
          if (!self.sqlModelSqls[mn]) {
            try {
              var r2 = await apiCall('/api/models/' + encodeURIComponent(mn) + '/sql');
              var upd2 = Object.assign({}, self.sqlModelSqls);
              upd2[mn] = r2.raw_sql || '';
              self.sqlModelSqls = upd2;
            } catch (_) {}
          }
          if (self.sqlModelSqls[mn]) sqls2.push('-- Model: ' + mn + '\n' + self.sqlModelSqls[mn]);
        }
        return sqls2.join('\n\n');
      }
      return this.sqlInput;
    },

    optimizeSQL: async function() {
      var sql = await this._buildSqlInput();
      if (!sql || !sql.trim()) { this.toast('No SQL to optimize', 'error'); return; }
      this.sqlLoading = true; this.sqlResult = null;
      try {
        this.sqlResult = await apiCall('/api/sql/optimize', {
          method: 'POST',
          body: JSON.stringify({ sql: sql, vendor: this.sqlVendor }),
        });
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.sqlLoading = false; }
    },

    copySqlOptimized: async function() {
      if (this.sqlResult && this.sqlResult.optimized_sql) {
        await navigator.clipboard.writeText(this.sqlResult.optimized_sql);
        this.toast('Copied', 'success');
      }
    },

    gitlabPushOptimized: async function() {
      if (!this.sqlResult || !this.sqlResult.optimized_sql) { this.toast('Nothing to push', 'error'); return; }
      var filePath = this.sqlOptGlMsg.match(/\w+\.sql/) ? this.sqlOptGlMsg.match(/\w+\.sql/)[0] : 'models/optimized.sql';
      // Build path from mode context
      if (this.sqlMode === 'single' && this.sqlSingleModel) filePath = 'models/' + this.sqlSingleModel + '.sql';
      this.gitlabPushing = true;
      try {
        var r = await apiCall('/api/gitlab/push', {
          method: 'POST',
          body: JSON.stringify({ file_path: filePath, content: this.sqlResult.optimized_sql, branch: this.sqlOptGlBranch || this.gitlabBranch || 'main', commit_message: this.sqlOptGlMsg }),
        });
        this.toast('Pushed: ' + r.file_path + ' on ' + r.branch, 'success');
        this.sqlOptGlOpen = false;
      } catch (e) { this.toast('GitLab: ' + e.message, 'error'); }
      finally { this.gitlabPushing = false; }
    },

    // ---- GitLab inline form push ------------------------------------
    gitlabPushForm: async function(formKey, content, filePath) {
      if (!content) { this.toast('Nothing to push — generate code first', 'error'); return; }
      if (!filePath || filePath.includes('/.') || filePath.endsWith('/')) {
        this.toast('File path is invalid (model name may be empty)', 'error'); return;
      }
      if (!this.gitlabToken && !this.gitlabProject) {
        this.toast('Set GitLab token in Settings first', 'error'); return;
      }
      var form = this.glForms[formKey] || {};
      var branch  = form.branch  || this.gitlabBranch || 'main';
      var message = form.message || 'feat: update via AIinDbt';
      this.gitlabPushing = true;
      try {
        var r = await apiCall('/api/gitlab/push', {
          method: 'POST',
          body: JSON.stringify({ file_path: filePath, content: content, branch: branch, commit_message: message }),
        });
        this.toast('Committed: ' + r.file_path + ' → ' + r.branch, 'success');
      } catch (e) {
        var msg = e.message || '';
        if (msg.includes('404')) msg = 'GitLab 404: check project path and branch name in Settings';
        else if (msg.includes('401') || msg.includes('403')) msg = 'GitLab auth error — check your Personal Access Token';
        else if (msg.includes('token')) msg = 'Configure GitLab token in Settings first';
        this.toast('GitLab: ' + msg, 'error');
      }
      finally { this.gitlabPushing = false; }
    },

    // ---- Legacy gitlabPush (kept for compatibility) ------------------
    gitlabPush: async function(content, filePath) {
      if (!content || !filePath) { this.toast('Nothing to push', 'error'); return; }
      this.gitlabPushing = true;
      try {
        var r = await apiCall('/api/gitlab/push', {
          method: 'POST',
          body: JSON.stringify({
            file_path: filePath,
            content: content,
            branch: this.gitlabBranch || 'main',
          }),
        });
        this.toast('Pushed to GitLab: ' + r.file_path + ' on ' + r.branch, 'success');
      } catch (e) { this.toast('GitLab push failed: ' + e.message, 'error'); }
      finally { this.gitlabPushing = false; }
    },

    // ---- GitLab -------------------------------------------------------
    loadGitlabBranches: async function() {
      if (!this.gitlabProject.trim()) { this.toast('Set GitLab project in Settings first', 'error'); return; }
      try {
        this.gitlabBranches = await apiCall('/api/gitlab/branches');
        if (!this.gitlabBranches.length) this.toast('No branches found', 'info');
      } catch (e) { this.toast('GitLab: ' + e.message, 'error'); }
    },

    // ---- Model Splitter ---------------------------------------------
    analyzeSplitter: async function() {
      if (!this.splitterSql.trim()) { this.toast('Paste SQL to analyze', 'error'); return; }
      this.splitterLoading = true; this.splitterResult = null;
      try {
        this.splitterResult = await apiCall('/api/splitter', {
          method: 'POST',
          body: JSON.stringify({ sql: this.splitterSql, model_name: this.splitterModelName || 'my_model' }),
        });
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.splitterLoading = false; }
    },

    gitlabPushSplitter: async function(sub, idx) {
      var branch = (this.splitterGlBranch && this.splitterGlBranch[1] === idx ? this.splitterGlBranch[0] : null) || this.gitlabBranch || 'main';
      var message = (this.splitterGlMsg && this.splitterGlMsg[1] === idx ? this.splitterGlMsg[0] : null) || ('feat: add sub-model ' + sub.name);
      this.gitlabPushing = true;
      try {
        var r = await apiCall('/api/gitlab/push', {
          method: 'POST',
          body: JSON.stringify({ file_path: 'models/' + sub.name + '.sql', content: sub.sql || '', branch: branch, commit_message: message }),
        });
        this.toast('Pushed ' + sub.name + ' to ' + r.branch, 'success');
      } catch (e) { this.toast('GitLab push failed: ' + e.message, 'error'); }
      finally { this.gitlabPushing = false; }
    },

    // ---- Dialect Converter ------------------------------------------
    loadConvModelSql: async function(name) {
      if (!name) return;
      try {
        var r = await apiCall('/api/models/' + encodeURIComponent(name) + '/sql');
        this.convSql = r.raw_sql || '';
      } catch (e) { this.toast('Could not load SQL: ' + e.message, 'error'); }
    },

    /* preview: compute which models will be affected before actually converting */
    previewLineageConvert: async function() {
      if (!this.convLineageModel.trim()) { this.toast('Enter a root model name', 'error'); return; }
      this.convLineagePreviewing = true;
      try {
        var g = await getLineageGraph();
        var nodes = g.nodes || [], edges = g.edges || [];
        var rootNode = null;
        for (var ni = 0; ni < nodes.length; ni++) {
          if (nodes[ni].name === this.convLineageModel) { rootNode = nodes[ni]; break; }
        }
        if (!rootNode) { this.toast('Model not found in lineage graph. Load the graph first.', 'error'); return; }
        var queue = [rootNode.id], visited = {}, allNames = [];
        visited[rootNode.id] = true; allNames.push(this.convLineageModel);
        var qi2 = 0;
        while (qi2 < queue.length) {
          var cur2 = queue[qi2++];
          edges.forEach(function(e) {
            if (e.to === cur2 && !visited[e.from]) {
              visited[e.from] = true; queue.push(e.from);
              var nd = nodes.find(function(n) { return n.id === e.from; });
              if (nd) allNames.push(nd.name);
            }
          });
        }
        this.convLineagePreview = allNames.map(function(nm) { return { name: nm, selected: true }; });
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.convLineagePreviewing = false; }
    },

    runConverter: async function() {
      this.convLoading = true; this.convResults = [];
      var self = this;
      try {
        if (this.convMode === 'paste' || this.convMode === 'model') {
          var sql = this.convSql;
          var modelName = this.convMode === 'model' ? this.convModelName : '';
          var r = await apiCall('/api/converter', {
            method: 'POST',
            body: JSON.stringify({ sql: sql, source_dialect: this.convSourceDialect, target_dialect: this.convTargetDialect, model_name: modelName }),
          });
          r._glOpen = false; r._glBranch = this.gitlabBranch; r._glMsg = 'feat: convert ' + (modelName || 'sql') + ' to ' + this.convTargetDialect;
          this.convResults = [r];
        } else if (this.convMode === 'lineage') {
          var toConvert = this.convLineagePreview.length
            ? this.convLineagePreview.filter(function(p) { return p.selected; }).map(function(p) { return p.name; })
            : [this.convLineageModel];
          if (!toConvert.length) { this.toast('No models selected', 'error'); return; }
          var results = [];
          for (var i = 0; i < toConvert.length; i++) {
            var mn = toConvert[i];
            var sqlR;
            try { sqlR = await apiCall('/api/models/' + encodeURIComponent(mn) + '/sql'); } catch (_) { continue; }
            if (!sqlR.raw_sql) continue;
            var convR = await apiCall('/api/converter', {
              method: 'POST',
              body: JSON.stringify({ sql: sqlR.raw_sql, source_dialect: self.convSourceDialect, target_dialect: self.convTargetDialect, model_name: mn }),
            });
            convR._glOpen = false; convR._glBranch = self.gitlabBranch; convR._glMsg = 'feat: convert ' + mn + ' to ' + self.convTargetDialect;
            results.push(convR);
          }
          this.convResults = results;
        }
      } catch (e) { this.toast(e.message, 'error'); }
      finally { this.convLoading = false; }
    },

    openConvGlForm: function(idx) {
      var res = this.convResults[idx];
      if (res) { res._glOpen = !res._glOpen; this.convResults = this.convResults.slice(); }
    },

    gitlabPushConverter: async function(res) {
      if (!res.converted_sql) { this.toast('No converted SQL to push', 'error'); return; }
      var filePath = 'models/' + (res.model_name || 'converted') + '_' + this.convTargetDialect + '.sql';
      this.gitlabPushing = true;
      try {
        var r = await apiCall('/api/gitlab/push', {
          method: 'POST',
          body: JSON.stringify({ file_path: filePath, content: res.converted_sql, branch: res._glBranch || this.gitlabBranch || 'main', commit_message: res._glMsg || 'feat: converted SQL' }),
        });
        this.toast('Committed: ' + r.file_path + ' → ' + r.branch, 'success');
        res._glOpen = false; this.convResults = this.convResults.slice();
      } catch (e) {
        var msg = e.message || '';
        if (msg.includes('404')) msg = 'GitLab 404 — check project path and branch in Settings';
        this.toast('GitLab: ' + msg, 'error');
      }
      finally { this.gitlabPushing = false; }
    },

    // ---- Scaffold structured brief ----------------------------------
    buildStructuredBrief: function() {
      var parts = [];
      if (this.scafSources.trim()) parts.push('SOURCES: ' + this.scafSources.trim());
      if (this.scafGrain.trim())   parts.push('GRAIN: ' + this.scafGrain.trim());
      if (this.scafMetrics.trim()) parts.push('METRICS: ' + this.scafMetrics.trim());
      if (this.scafFilters.trim()) parts.push('FILTERS: ' + this.scafFilters.trim());
      this.scafBrief = parts.join('\n');
    },

    // ---- fill (example chips) ----------------------------------------
    fill: function(field, val) { this[field] = val; },
  },

  // ------------------------------------------------------------------
  mounted: function() {
    this.loadStatus();
    this.loadHealth();
    // Apply saved font size
    var saved = localStorage.getItem('aiindbt_fontsize');
    if (saved) { document.documentElement.style.fontSize = saved + 'px'; this.fontSize = parseInt(saved, 10); }
  },
})
.component('DataTable', DataTableComp)
.component('AutoInput', AutoInputComp)
.mount('#app');

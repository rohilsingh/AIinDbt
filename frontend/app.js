// =============================================================
// AIinDbt — single-file app (no ES modules, no imports)
// =============================================================

// ---- HTML escape -----------------------------------------------
function esc(s) {
  return (s == null ? "" : String(s))
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- DOM helper ------------------------------------------------
function $(id) { return document.getElementById(id); }

// ---- API helper ------------------------------------------------
async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const r = await fetch(path, {
    headers: isForm ? {} : { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "HTTP " + r.status);
  return data;
}

// ---- Toast -----------------------------------------------------
function toast(msg, type) {
  type = type || "info";
  let c = $("toast-container");
  if (!c) { c = document.createElement("div"); c.id = "toast-container"; document.body.appendChild(c); }
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---- Code block ------------------------------------------------
function codeBlock(text) {
  const id = "cb" + Math.random().toString(36).slice(2);
  return '<div class="code-block-wrap">' +
    '<button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById(\'' + id + '\').textContent);this.textContent=\'✓\'">' +
    'Copy</button><pre id="' + id + '">' + esc(text) + '</pre></div>';
}

// ---- Spinner ---------------------------------------------------
function spinner() { return '<span class="spin-icon">⟳</span> '; }

// ---- Grade badge -----------------------------------------------
function gradeBadge(g) { return '<span class="grade-' + g + '">' + g + '</span>'; }

// ---- KPI card --------------------------------------------------
function kpiCard(value, label, color) {
  return '<div class="kpi-card"><div class="kpi-value" style="color:' + (color || "#1e40af") + '">' +
    esc(String(value)) + '</div><div class="kpi-label">' + esc(label) + '</div></div>';
}

// ---- Examples bar ----------------------------------------------
function insertExamplesBar(containerId, examples, onPick) {
  const el = $(containerId);
  if (!el) return;
  const chips = examples.map(function(ex) {
    return '<span class="example-chip" style="cursor:pointer">' + esc(ex) + '</span>';
  }).join("");
  const wrap = document.createElement("div");
  wrap.className = "examples-bar";
  wrap.innerHTML = '<div class="examples-label">Examples</div><div class="examples-chips">' + chips + '</div>';
  wrap.querySelectorAll(".example-chip").forEach(function(c) {
    c.addEventListener("click", function() { onPick(c.textContent); });
  });
  el.appendChild(wrap);
}

// =============================================================
// DataTable
// =============================================================
function DataTable(containerId, opts) {
  this.el = $(containerId);
  this.columns = opts.columns || [];
  this.pageSize = opts.pageSize || 50;
  this.exportName = opts.exportName || "export";
  this._data = [];
  this._filtered = [];
  this._sortKey = null;
  this._sortDir = 1;
  this._page = 0;
  this._q = "";
  this._filterCol = "";
  if (this.el) this._build();
}
DataTable.prototype._build = function() {
  var self = this;
  this.el.className = "data-table-wrap";
  var colOpts = this.columns.map(function(c) {
    return '<option value="' + c.key + '">' + c.label + '</option>';
  }).join("");
  this.el.innerHTML =
    '<div class="data-table-toolbar">' +
      '<input class="dt-search" placeholder="Search…" />' +
      '<select class="dt-filter-col"><option value="">All columns</option>' + colOpts + '</select>' +
      '<div style="margin-left:auto;display:flex;gap:.4rem">' +
        '<button class="btn btn-secondary btn-sm dt-xlsx">⬇ Excel</button>' +
        '<button class="btn btn-secondary btn-sm no-print" onclick="window.print()">🖨 PDF</button>' +
      '</div>' +
    '</div>' +
    '<div class="scroll-table-container">' +
      '<table><thead><tr class="dt-head"></tr></thead><tbody class="dt-body"></tbody></table>' +
    '</div>' +
    '<div class="data-table-footer">' +
      '<span class="dt-info"></span>' +
      '<div style="display:flex;gap:.35rem">' +
        '<button class="btn btn-ghost btn-sm dt-prev">‹</button>' +
        '<button class="btn btn-ghost btn-sm dt-next">›</button>' +
      '</div>' +
    '</div>';

  var head = this.el.querySelector(".dt-head");
  this.columns.forEach(function(col) {
    var th = document.createElement("th");
    th.dataset.key = col.key;
    th.innerHTML = esc(col.label) + '<span class="sort-icon"></span>';
    th.addEventListener("click", function() { self._toggleSort(col.key, th); });
    head.appendChild(th);
  });
  this.el.querySelector(".dt-search").addEventListener("input", function(e) {
    self._q = e.target.value.toLowerCase();
    self._page = 0;
    self._filter(); self._render();
  });
  this.el.querySelector(".dt-filter-col").addEventListener("change", function(e) {
    self._filterCol = e.target.value;
    self._filter(); self._render();
  });
  this.el.querySelector(".dt-prev").addEventListener("click", function() {
    if (self._page > 0) { self._page--; self._render(); }
  });
  this.el.querySelector(".dt-next").addEventListener("click", function() {
    if ((self._page + 1) * self.pageSize < self._filtered.length) { self._page++; self._render(); }
  });
  this.el.querySelector(".dt-xlsx").addEventListener("click", function() { self.exportExcel(); });
};
DataTable.prototype.load = function(data) {
  this._data = data || [];
  this._page = 0;
  this._q = "";
  var s = this.el && this.el.querySelector(".dt-search");
  if (s) s.value = "";
  this._filter(); this._render();
};
DataTable.prototype._filter = function() {
  var q = this._q, fc = this._filterCol, cols = this.columns;
  this._filtered = this._data.filter(function(row) {
    if (!q) return true;
    var targets = fc ? [String(row[fc] == null ? "" : row[fc])] : cols.map(function(c) { return String(row[c.key] == null ? "" : row[c.key]); });
    return targets.some(function(t) { return t.toLowerCase().includes(q); });
  });
  if (this._sortKey) this._sort();
};
DataTable.prototype._sort = function() {
  var k = this._sortKey, d = this._sortDir;
  this._filtered = this._filtered.slice().sort(function(a, b) {
    var av = a[k] == null ? "" : a[k], bv = b[k] == null ? "" : b[k];
    return (typeof av === "number" && typeof bv === "number") ? (av - bv) * d : String(av).localeCompare(String(bv)) * d;
  });
};
DataTable.prototype._toggleSort = function(key, th) {
  if (this._sortKey === key) this._sortDir *= -1;
  else { this._sortKey = key; this._sortDir = 1; }
  this.el.querySelectorAll("th").forEach(function(h) { h.classList.remove("sort-asc", "sort-desc"); });
  th.classList.add(this._sortDir === 1 ? "sort-asc" : "sort-desc");
  this._sort(); this._render();
};
DataTable.prototype._render = function() {
  if (!this.el) return;
  var start = this._page * this.pageSize;
  var page = this._filtered.slice(start, start + this.pageSize);
  var tbody = this.el.querySelector(".dt-body");
  var cols = this.columns;
  if (!page.length) {
    tbody.innerHTML = '<tr><td colspan="' + cols.length + '" class="table-empty">No results</td></tr>';
  } else {
    tbody.innerHTML = page.map(function(row) {
      return "<tr>" + cols.map(function(col) {
        var val = row[col.key] == null ? "" : row[col.key];
        var cell = col.render ? col.render(val, row) : esc(String(val));
        return "<td>" + cell + "</td>";
      }).join("") + "</tr>";
    }).join("");
  }
  var total = this._filtered.length;
  this.el.querySelector(".dt-info").textContent =
    (total === 0 ? "0" : (start + 1) + "–" + Math.min(start + this.pageSize, total)) + " of " + total;
};
DataTable.prototype.exportExcel = async function() {
  try {
    var rows = this._filtered.map(function(row) {
      var out = {};
      this.columns.forEach(function(c) { out[c.key] = row[c.key] == null ? "" : row[c.key]; });
      return out;
    }.bind(this));
    var cols = this.columns.map(function(c) { return c.key; });
    var r = await fetch("/api/export/excel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: rows, columns: cols, filename: this.exportName }),
    });
    if (!r.ok) throw new Error(await r.text());
    var blob = await r.blob();
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = this.exportName + ".xlsx";
    a.click();
    toast("Excel downloaded", "success");
  } catch (e) { toast("Export failed: " + e.message, "error"); }
};

// =============================================================
// Autocomplete
// =============================================================
var _acCache = null;
async function getModelList() {
  if (_acCache) return _acCache;
  try {
    var r = await fetch("/api/models/list");
    var d = await r.json();
    _acCache = (d.models || []).map(function(m) { return { name: m.name, kind: "model", extra: m.materialized || "" }; })
      .concat((d.sources || []).map(function(s) { return { name: s.name, kind: "source", extra: s.source_name || "" }; }));
  } catch (_) { _acCache = []; }
  return _acCache;
}
function attachAutocomplete(inputEl, opts) {
  if (!inputEl) return;
  opts = opts || {};
  var wrap = document.createElement("div");
  wrap.className = "autocomplete-wrap";
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);
  var dropdown = document.createElement("div");
  dropdown.className = "autocomplete-dropdown";
  dropdown.style.display = "none";
  wrap.appendChild(dropdown);
  var items = [], focused = -1;

  function show(list) {
    items = list; focused = -1;
    dropdown.innerHTML = list.slice(0, 20).map(function(it, i) {
      return '<div class="autocomplete-item" data-idx="' + i + '">' +
        '<span class="ac-kind ' + it.kind + '">' + it.kind + '</span>' +
        '<span>' + esc(it.name) + '</span>' +
        (it.extra ? '<span style="color:#94a3b8;font-size:.72rem;margin-left:auto">' + esc(it.extra) + '</span>' : '') +
        '</div>';
    }).join("");
    dropdown.style.display = list.length ? "block" : "none";
    dropdown.querySelectorAll(".autocomplete-item").forEach(function(el, i) {
      el.addEventListener("mousedown", function(e) { e.preventDefault(); pick(i); });
    });
  }
  function hide() { dropdown.style.display = "none"; focused = -1; }
  function pick(i) {
    var it = items[i]; if (!it) return;
    inputEl.value = it.name; hide();
    if (opts.onSelect) opts.onSelect(it);
    inputEl.dispatchEvent(new Event("input"));
  }
  inputEl.addEventListener("input", async function() {
    var q = inputEl.value.toLowerCase().trim();
    if (!q) { hide(); return; }
    var all = await getModelList();
    var filtered = all.filter(function(it) {
      if (opts.filterKind && it.kind !== opts.filterKind) return false;
      return it.name.toLowerCase().includes(q) || it.extra.toLowerCase().includes(q);
    });
    show(filtered);
  });
  inputEl.addEventListener("keydown", function(e) {
    if (dropdown.style.display === "none") return;
    if (e.key === "ArrowDown") { e.preventDefault(); focused = Math.min(focused + 1, items.length - 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focused = Math.max(focused - 1, 0); }
    else if (e.key === "Enter") { if (focused >= 0) { e.preventDefault(); pick(focused); } else hide(); return; }
    else if (e.key === "Escape") { hide(); return; }
    dropdown.querySelectorAll(".autocomplete-item").forEach(function(el, i) { el.classList.toggle("focused", i === focused); });
    var f = dropdown.querySelector(".focused");
    if (f) f.scrollIntoView({ block: "nearest" });
  });
  inputEl.addEventListener("blur", function() { setTimeout(hide, 150); });
}

// =============================================================
// Chat panel
// =============================================================
var BM_KEY = "aiindbt_bookmarks";
function loadBookmarks() { try { return JSON.parse(localStorage.getItem(BM_KEY) || "[]"); } catch (_) { return []; } }
function saveBookmarks(bms) { localStorage.setItem(BM_KEY, JSON.stringify(bms)); }

function ChatPanel(historyId, inputId, sendBtnId) {
  this.history = $(historyId);
  this.input = $(inputId);
  this.sendBtn = $(sendBtnId);
  this._onSend = null;
  var self = this;
  if (this.sendBtn) this.sendBtn.addEventListener("click", function() { self._send(); });
  if (this.input) this.input.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); self._send(); }
  });
}
ChatPanel.prototype.onSend = function(fn) { this._onSend = fn; };
ChatPanel.prototype._send = async function() {
  var text = this.input && this.input.value.trim();
  if (!text || !this._onSend) return;
  this.input.value = "";
  this.addMessage("user", text);
  this.setTyping(true);
  try {
    var result = await this._onSend(text);
    this.setTyping(false);
    this.addMessage("bot", result.answer || result.sql || result.reply || JSON.stringify(result));
  } catch (e) { this.setTyping(false); this.addMessage("bot", "⚠️ Error: " + e.message); }
};
ChatPanel.prototype.addMessage = function(role, text) {
  if (!this.history) return;
  var id = "msg" + Date.now() + Math.random().toString(36).slice(2);
  var ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  var display = role === "bot" ? formatBotText(text) : "<span>" + esc(text) + "</span>";
  var wrap = document.createElement("div");
  wrap.className = "chat-bubble-wrap " + role;
  wrap.innerHTML = '<div class="chat-bubble" id="' + id + '">' + display + '</div>' +
    '<div class="chat-bubble-meta"><span>' + ts + '</span>' +
    (role === "bot" ? '<button onclick="copyMsg(\'' + id + '\')" title="Copy">📋</button>' +
      '<button onclick="bookmarkMsg(\'' + id + '\',this)" title="Bookmark">🔖</button>' : '') +
    '</div>';
  this.history.appendChild(wrap);
  this.history.scrollTop = this.history.scrollHeight;
};
ChatPanel.prototype.setTyping = function(on) {
  var existing = this.history && this.history.querySelector(".chat-typing");
  if (on && !existing && this.history) {
    var t = document.createElement("div"); t.className = "chat-typing"; t.textContent = "Thinking…";
    this.history.appendChild(t); this.history.scrollTop = this.history.scrollHeight;
  } else if (!on && existing) { existing.remove(); }
};
function formatBotText(text) {
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, function(_, code) {
      return '<pre style="margin:.3rem 0;font-size:.78rem;white-space:pre-wrap">' + esc(code.trim()) + '</pre>';
    })
    .replace(/\n/g, "<br>");
}
window.copyMsg = function(id) {
  var el = $(id); if (!el) return;
  navigator.clipboard.writeText(el.innerText);
  toast("Copied", "success");
};
window.bookmarkMsg = function(id, btn) {
  var el = $(id); if (!el) return;
  var bms = loadBookmarks();
  bms.unshift({ id: Date.now(), text: el.innerText, ts: new Date().toISOString() });
  saveBookmarks(bms); btn.textContent = "✅";
  renderBookmarksDrawer(); toast("Bookmarked", "success");
};
function renderBookmarksDrawer() {
  var body = $("bookmarks-body"); if (!body) return;
  var bms = loadBookmarks();
  if (!bms.length) { body.innerHTML = '<div class="drawer-empty">No bookmarks yet.<br>Click 🔖 on any AI response.</div>'; return; }
  body.innerHTML = bms.map(function(b) {
    return '<div class="bookmark-item">' +
      '<div class="bm-label">' + new Date(b.ts).toLocaleString() + '</div>' +
      '<pre>' + esc(b.text.slice(0, 400)) + (b.text.length > 400 ? "…" : "") + '</pre>' +
      '<button class="bm-delete" onclick="deleteBm(' + b.id + ')">✕</button></div>';
  }).join("");
}
window.deleteBm = function(id) {
  saveBookmarks(loadBookmarks().filter(function(b) { return b.id !== id; }));
  renderBookmarksDrawer();
};
function toggleBookmarksDrawer() {
  var d = $("bookmarks-drawer");
  if (d) { d.classList.toggle("open"); renderBookmarksDrawer(); }
}

// =============================================================
// LineageViewer
// =============================================================
var LAYER_COLORS = {
  source: { bg: "#fef3c7", border: "#f59e0b" },
  seed:   { bg: "#ede9fe", border: "#8b5cf6" },
  staging:      { bg: "#e0f2fe", border: "#0ea5e9" },
  intermediate: { bg: "#d1fae5", border: "#10b981" },
  marts:        { bg: "#ffe4e6", border: "#f43f5e" },
  other:        { bg: "#f1f5f9", border: "#94a3b8" },
};
function lineageLayerFor(node) {
  if (node.kind === "source") return "source";
  if (node.kind === "seed") return "seed";
  var name = (node.name || "").toLowerCase();
  if (name.startsWith("stg_")) return "staging";
  if (name.startsWith("int_")) return "intermediate";
  if (name.startsWith("fct_") || name.startsWith("dim_") || name.startsWith("mart_")) return "marts";
  return "other";
}
function LineageViewer(netId, detailId) {
  this.netEl = $(netId);
  this.detailEl = $(detailId);
  this.network = null;
  this._nodes = null;
  this._rawNodes = [];
}
LineageViewer.prototype.load = function(g) {
  if (!this.netEl || !window.vis) return;
  var self = this;
  this._rawNodes = g.nodes || [];
  var visNodes = new vis.DataSet(g.nodes.map(function(n) {
    var layer = lineageLayerFor(n);
    var c = LAYER_COLORS[layer] || LAYER_COLORS.other;
    return { id: n.id, label: n.name, title: (n.kind || "") + ": " + n.name + (n.description ? "\n" + n.description : ""),
      color: { background: c.bg, border: c.border, highlight: { background: "#dbeafe", border: "#2563eb" } },
      shape: n.kind === "source" ? "box" : "ellipse", _raw: n };
  }));
  var visEdges = new vis.DataSet(g.edges.map(function(e) {
    return { from: e.from, to: e.to, arrows: "to", color: { color: "#cbd5e1", highlight: "#2563eb" },
      smooth: { type: "cubicBezier", roundness: 0.3 } };
  }));
  this._nodes = visNodes;
  this.network = new vis.Network(this.netEl, { nodes: visNodes, edges: visEdges }, {
    physics: { enabled: true, barnesHut: { gravitationalConstant: -8000, springLength: 120, damping: 0.5 },
      stabilization: { iterations: 150 } },
    interaction: { hover: true, tooltipDelay: 200, zoomView: true },
    nodes: { borderWidth: 1.5 },
    edges: { width: 1.2 },
  });
  this.network.on("click", function(p) { if (p.nodes.length) self._showDetail(p.nodes[0]); });
  this.network.once("stabilizationIterationsDone", function() { self.network.fit({ animation: true }); });
};
LineageViewer.prototype.search = function(q) {
  if (!this._nodes || !q.trim()) { this._nodes && this._nodes.forEach(function(n) { this._nodes.update({ id: n.id, opacity: 1 }); }.bind(this)); return; }
  var lower = q.toLowerCase(), matches = new Set();
  this._rawNodes.forEach(function(n) { if (n.name.toLowerCase().includes(lower)) matches.add(n.id); });
  this._nodes.forEach(function(n) { this._nodes.update({ id: n.id, opacity: matches.has(n.id) ? 1 : 0.15 }); }.bind(this));
  if (matches.size === 1) this.network.focus(Array.from(matches)[0], { scale: 1.5, animation: true });
};
LineageViewer.prototype.fitView = function() { this.network && this.network.fit({ animation: true }); };
LineageViewer.prototype.zoomIn  = function() { this.network && this.network.moveTo({ scale: (this.network.getScale() || 1) * 1.3 }); };
LineageViewer.prototype.zoomOut = function() { this.network && this.network.moveTo({ scale: (this.network.getScale() || 1) * 0.77 }); };
LineageViewer.prototype.setPhysics = function(on) { this.network && this.network.setOptions({ physics: { enabled: on } }); };
LineageViewer.prototype._showDetail = function(id) {
  var node = this._rawNodes.find(function(n) { return n.id === id; });
  if (!node || !this.detailEl) return;
  var c = LAYER_COLORS[lineageLayerFor(node)] || LAYER_COLORS.other;
  this.detailEl.style.display = "block";
  this.detailEl.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">' +
      '<h4 style="color:' + c.border + '">' + esc(node.name) + '</h4>' +
      '<button onclick="this.closest(\'.node-detail-panel\').style.display=\'none\'" style="background:none;border:none;cursor:pointer;color:#94a3b8">✕</button>' +
    '</div>' +
    '<div class="nd-row"><span class="nd-key">Kind</span><span>' + esc(node.kind) + '</span></div>' +
    (node.schema ? '<div class="nd-row"><span class="nd-key">Schema</span><span>' + esc(node.schema) + '</span></div>' : '') +
    (node.materialized ? '<div class="nd-row"><span class="nd-key">Mat.</span><span>' + esc(node.materialized) + '</span></div>' : '') +
    (node.description ? '<p style="font-size:.78rem;color:#475569;margin-top:.4rem;line-height:1.4">' + esc(node.description.slice(0,200)) + '</p>' : '');
};

// =============================================================
// DocsViewer  (inline DOCS_PAGES too)
// =============================================================
var DOCS_PAGES = [
  { id:"gs-overview", section:"Getting Started", title:"Overview",
    body:'<p>AIinDbt is a self-hosted web app that brings AI features into your dbt workflow — no cloud signup beyond your API keys.</p><h2>Features</h2><ul><li><b>A1</b> AI Doc Generator — auto-writes YAML descriptions</li><li><b>A2</b> Model Scaffolding — full model from a brief</li><li><b>A3</b> Staging Generator — RAW → stg_*</li><li><b>A4</b> Incremental Advisor — scores &amp; rewrites models</li><li><b>B1</b> Chat — plain-English Q&amp;A on your project</li><li><b>B2</b> NL→SQL — business question → warehouse SQL</li><li><b>B3</b> Semantic Search — search across all models</li><li><b>C1</b> Test Generator — schema.yml tests from sample data</li><li><b>C2</b> Anomaly Detection — Elementary tests</li><li><b>C3</b> Quality Scores — 0–100 health score per model</li><li><b>D1</b> Lineage Graph — interactive DAG</li><li><b>D2</b> Column Lineage — trace a column upstream</li><li><b>D3</b> Health Dashboard — KPI overview</li><li><b>E2</b> Teams Bot — slash commands in Microsoft Teams</li><li>BigQuery runner — run generated SQL directly</li></ul>' },
  { id:"gs-install", section:"Getting Started", title:"Installation",
    body:'<h2>macOS / Linux</h2><pre>pip install -r requirements.txt\n./run.sh</pre><h2>Windows</h2><pre>python -m pip install -r requirements.txt\npython -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre><p>If <code>python</code> not found, use <code>py</code>:</p><pre>py -m pip install -r requirements.txt\npy -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload</pre><div class="callout">Settings are in-memory only — re-enter after server restart.</div>' },
  { id:"gs-settings", section:"Getting Started", title:"Settings",
    body:'<h2>LLM Key</h2><p>Paste your Cline key, Anthropic key, or OpenRouter key.</p><table><thead><tr><th>Gateway</th><th>Base URL</th></tr></thead><tbody><tr><td>Anthropic direct</td><td>(leave blank)</td></tr><tr><td>OpenRouter / Cline</td><td>https://openrouter.ai/api/v1</td></tr></tbody></table><h2>dbt Project</h2><p>Run <code>dbt parse</code> then upload <code>target/manifest.json</code>. This unlocks autocomplete, lineage, docs generation, and all model-aware features.</p>' },
  { id:"feat-a1", section:"Features", title:"A1 — AI Doc Generator",
    body:'<p>Auto-generates schema.yml descriptions for any model and its columns.</p><h2>How to use</h2><ol><li>Upload manifest.json</li><li>Click <b>List undocumented</b> to see which models need attention</li><li>Type a model name (autocomplete will suggest options)</li><li>Click <b>Generate YAML</b> and paste into your schema.yml</li></ol>' },
  { id:"feat-a2", section:"Features", title:"A2 — Model Scaffolding",
    body:'<p>Generates a complete dbt model from a plain-English brief using your real project\'s refs.</p><h2>Example briefs</h2><ul><li><i>Daily revenue by country joining orders and customers, last 90 days</i></li><li><i>Monthly active users grouped by plan tier</i></li></ul>' },
  { id:"feat-a3", section:"Features", title:"A3 — Staging Generator",
    body:'<p>Reads a RAW source table and generates a clean <code>stg_*</code> model: column renames, type casts, CTE pattern.</p><p>Provide columns as <code>name,type</code> CSV (one per line) or let the manifest load them automatically.</p>' },
  { id:"feat-a4", section:"Features", title:"A4 — Incremental Advisor",
    body:'<p>Scores models on incremental fit: +2 for timestamp column, +2 for row count &gt;1M, +1 for non-incremental materialization.</p><p>Models scoring ≥3 are recommended. Enter the model + timestamp column to get a full rewrite.</p>' },
  { id:"feat-b1", section:"Features", title:"B1 — Chat with Project",
    body:'<p>Plain-English Q&amp;A using your manifest as context. Ask about models, dependencies, column definitions, or request SQL.</p><p>Click 🔖 on any answer to save it to the bookmarks drawer.</p>' },
  { id:"feat-b2", section:"Features", title:"B2 — Natural Language → SQL",
    body:'<p>Translates a business question to warehouse SQL. Select dialect (Snowflake, BigQuery, Redshift…), then optionally run it in BigQuery.</p><div class="callout warning">Always review SQL before running in production.</div>' },
  { id:"feat-c1", section:"Features", title:"C1 — Test Generator",
    body:'<p>Paste a CSV sample (with header, 10–50 rows) and get schema.yml tests: <code>not_null</code>, <code>unique</code>, <code>accepted_values</code> (≤12 distinct values), <code>relationships</code>.</p>' },
  { id:"feat-c2", section:"Features", title:"C2 — Anomaly Detection",
    body:'<p>Generates <a href="https://docs.elementary-data.com" target="_blank">Elementary</a> anomaly tests based on column names: <code>volume_anomalies</code>, <code>freshness_anomalies</code>, <code>dimension_anomalies</code>.</p><div class="callout">Requires <code>elementary-data/elementary</code> dbt package.</div>' },
  { id:"feat-c3", section:"Features", title:"C3 — Quality Scoring",
    body:'<p>0–100 health score: Docs 40pts + Tests 40pts + Freshness 20pts. Grade A≥85, B≥70, C≥50, D&lt;50. Export to Excel for reporting.</p>' },
  { id:"feat-d1", section:"Features", title:"D1 — Lineage Graph",
    body:'<p>Interactive DAG with layer colour coding (🟡 Source, 🟣 Seed, 🔵 Staging, 🟢 Intermediate, 🔴 Marts). Click a node for details. Search to highlight nodes.</p>' },
  { id:"feat-d2", section:"Features", title:"D2 — Column Lineage",
    body:'<p>Traces a column upstream across the model chain using sqlglot SQL parsing. Best-effort — complex Jinja macros may not resolve fully.</p>' },
  { id:"int-teams", section:"Integrations", title:"Microsoft Teams Setup",
    body:'<h2>Option A — Outgoing Webhook (users @mention the bot)</h2><div class="setup-step"><div class="step-num">1</div><div class="step-body"><div class="step-title">Open channel settings</div><div class="step-desc">Channel → <b>⋯</b> → Connectors → Outgoing Webhooks</div></div></div><div class="setup-step"><div class="step-num">2</div><div class="step-body"><div class="step-title">Create webhook</div><div class="step-desc">Set callback URL to <code>https://&lt;your-host&gt;/api/teams/events</code>. For local testing use ngrok: <code>ngrok http 8000</code></div></div></div><div class="setup-step"><div class="step-num">3</div><div class="step-body"><div class="step-title">Copy HMAC secret</div><div class="step-desc">Paste the base64 secret into Settings → Outgoing Webhook HMAC secret</div></div></div><div class="setup-step"><div class="step-num">4</div><div class="step-body"><div class="step-title">Test it</div><div class="step-desc">In the channel: <code>@AIinDbt /help</code></div></div></div><h2>Option B — Incoming Webhook (push from app)</h2><div class="setup-step"><div class="step-num">1</div><div class="step-body"><div class="step-title">Add connector</div><div class="step-desc">Channel → <b>⋯</b> → Connectors → Incoming Webhook → Configure</div></div></div><div class="setup-step"><div class="step-num">2</div><div class="step-body"><div class="step-title">Copy URL</div><div class="step-desc">Paste the webhook URL into Settings → Incoming Webhook URL</div></div></div><h2>Available Commands</h2><table><thead><tr><th>Command</th><th>Feature</th></tr></thead><tbody><tr><td>/help</td><td>List commands</td></tr><tr><td>/health</td><td>Health KPIs</td></tr><tr><td>/quality [n]</td><td>Quality scores</td></tr><tr><td>/sql &lt;question&gt;</td><td>NL→SQL</td></tr><tr><td>/docs &lt;model&gt;</td><td>Generate YAML</td></tr><tr><td>/scaffold &lt;brief&gt;</td><td>New model</td></tr><tr><td>/anomaly &lt;model&gt;</td><td>Anomaly tests</td></tr><tr><td>/lineage &lt;model&gt; &lt;col&gt;</td><td>Column lineage</td></tr><tr><td>(anything else)</td><td>Chat with project</td></tr></tbody></table>' },
  { id:"int-bq", section:"Integrations", title:"BigQuery Setup",
    body:'<ol><li>GCP Console → IAM → Service Accounts → Create</li><li>Grant <b>BigQuery Data Viewer</b> + <b>BigQuery Job User</b></li><li>Keys → Add Key → JSON → download the file</li><li>In the BigQuery panel click <b>Upload service account JSON</b></li><li>Click <b>Test connection</b></li></ol><div class="callout warning">Queries are billed to your GCP project. Results capped at 500 rows by default.</div>' },
  { id:"trbl", section:"Troubleshooting", title:"Common Issues",
    body:'<h2>Clicks do nothing / page unresponsive</h2><p>Open browser DevTools (F12) → Console tab. Look for red errors. Most common cause: a JS error on load.</p><h2>LLM 401 error</h2><p>Re-check API key in Settings. For Cline/OpenRouter ensure Base URL is set.</p><h2>Manifest not loading</h2><p>Run <code>dbt parse</code> and upload <code>target/manifest.json</code>. File can be 10–50MB — be patient.</p><h2>Lineage is empty</h2><p>Needs a manifest. Check the status dots in the sidebar.</p><h2>Teams bot not responding</h2><p>Server must be publicly reachable. Use ngrok for local: <code>ngrok http 8000</code>. HMAC secret must be exact (base64).</p><h2>Windows: uvicorn not found</h2><p>Use <code>python -m uvicorn</code> not just <code>uvicorn</code>. See Installation page.</p>' },
];

function DocsViewer(sidebarId, contentId, searchId) {
  this.sidebar  = $(sidebarId);
  this.content  = $(contentId);
  this.searchEl = $(searchId);
  this._cur = null;
  this._build();
}
DocsViewer.prototype._build = function() {
  var self = this;
  if (!this.sidebar) return;
  this._renderSidebar(DOCS_PAGES);
  if (this.searchEl) {
    this.searchEl.addEventListener("input", function(e) {
      var q = e.target.value.toLowerCase();
      self._renderSidebar(q ? DOCS_PAGES.filter(function(p) {
        return p.title.toLowerCase().includes(q) || p.section.toLowerCase().includes(q);
      }) : DOCS_PAGES);
    });
  }
  if (DOCS_PAGES.length) this.show(DOCS_PAGES[0].id);
};
DocsViewer.prototype._renderSidebar = function(pages) {
  var self = this, sections = {};
  pages.forEach(function(p) { (sections[p.section] = sections[p.section] || []).push(p); });
  this.sidebar.innerHTML = Object.keys(sections).map(function(sec) {
    return '<div class="docs-sidebar-section">' + esc(sec) + '</div>' +
      sections[sec].map(function(p) {
        return '<div class="docs-sidebar-item' + (p.id === self._cur ? " active" : "") + '" data-id="' + p.id + '">' + esc(p.title) + '</div>';
      }).join("");
  }).join("");
  this.sidebar.querySelectorAll(".docs-sidebar-item").forEach(function(el) {
    el.addEventListener("click", function() { self.show(el.dataset.id); });
  });
};
DocsViewer.prototype.show = function(id) {
  this._cur = id;
  var page = DOCS_PAGES.find(function(p) { return p.id === id; });
  if (!page || !this.content) return;
  this.sidebar.querySelectorAll(".docs-sidebar-item").forEach(function(el) {
    el.classList.toggle("active", el.dataset.id === id);
  });
  this.content.innerHTML =
    '<div style="border-bottom:1px solid #e2e8f0;margin-bottom:1.25rem;padding-bottom:.75rem">' +
    '<div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;margin-bottom:.2rem">' + esc(page.section) + '</div>' +
    '<h1>' + esc(page.title) + '</h1></div>' + page.body;
  this.content.scrollTop = 0;
};

// =============================================================
// Sidebar routing
// =============================================================
function show(panelId) {
  document.querySelectorAll(".panel").forEach(function(p) { p.classList.remove("active"); });
  document.querySelectorAll(".sidebar-item").forEach(function(i) { i.classList.remove("active"); });
  var panel = $("panel-" + panelId);
  if (panel) panel.classList.add("active");
  var item = document.querySelector(".sidebar-item[data-panel='" + panelId + "']");
  if (item) item.classList.add("active");
  var sub = document.querySelector(".topbar-subtitle");
  if (sub && item) {
    var lbl = item.querySelector(".label");
    if (lbl) sub.textContent = lbl.textContent;
  }
  var sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.remove("open");
}

document.querySelectorAll(".sidebar-item[data-panel]").forEach(function(item) {
  item.addEventListener("click", function() { show(item.dataset.panel); });
});

var hamburger = $("hamburger");
if (hamburger) hamburger.addEventListener("click", function() {
  var s = document.getElementById("sidebar");
  if (s) s.classList.toggle("open");
});
var openBm = $("open-bookmarks");
if (openBm) openBm.addEventListener("click", toggleBookmarksDrawer);
var closeBm = $("close-bookmarks");
if (closeBm) closeBm.addEventListener("click", toggleBookmarksDrawer);

// =============================================================
// Status bar
// =============================================================
async function loadStatus() {
  try {
    var s = await api("/api/settings");
    var cfg = s.configured || {};
    var row = $("status-row");
    if (row) row.innerHTML = [["LLM", cfg.llm], ["Project", cfg.manifest || cfg.dbt_cloud], ["BQ", cfg.bigquery], ["Teams", cfg.teams]]
      .map(function(x) { return '<span class="status-dot ' + (x[1] ? "ok" : "") + '">' + x[0] + '</span>'; }).join("");
    if (s.manifest_models) {
      var b = $("lineage-badge"); if (b) b.textContent = s.manifest_models;
    }
    setIfEl("llm_base_url", s.llm_base_url || "");
    setIfEl("llm_model", s.llm_model || "");
    setIfEl("dbt_cloud_host", s.dbt_cloud_host || "");
    setIfEl("dbt_cloud_account_id", s.dbt_cloud_account_id || "");
    setIfEl("dbt_cloud_project_id", s.dbt_cloud_project_id || "");
    setIfEl("bq_project_id", s.bigquery_project_id || "");
    setIfEl("teams_url_display", location.origin + "/api/teams/events");
  } catch (_) {}
  getModelList();
}
function setIfEl(id, val) { var el = $(id); if (el) el.value = val; }
loadStatus();

// =============================================================
// SETTINGS save
// =============================================================
var saveBtn = $("save-settings");
if (saveBtn) saveBtn.addEventListener("click", async function() {
  try {
    await api("/api/settings", { method: "POST", body: JSON.stringify({
      llm_api_key: $("llm_api_key") && $("llm_api_key").value || undefined,
      llm_base_url: $("llm_base_url") && $("llm_base_url").value,
      llm_model: $("llm_model") && $("llm_model").value || undefined,
      dbt_cloud_host: $("dbt_cloud_host") && $("dbt_cloud_host").value || undefined,
      dbt_cloud_account_id: $("dbt_cloud_account_id") && $("dbt_cloud_account_id").value || undefined,
      dbt_cloud_project_id: $("dbt_cloud_project_id") && $("dbt_cloud_project_id").value || undefined,
      dbt_cloud_token: $("dbt_cloud_token") && $("dbt_cloud_token").value || undefined,
      teams_outgoing_secret: $("teams_outgoing_secret") && $("teams_outgoing_secret").value || undefined,
      teams_incoming_webhook: $("teams_incoming_webhook") && $("teams_incoming_webhook").value || undefined,
    }) });
    for (var pair of [["manifest_file","/api/manifest"],["catalog_file","/api/catalog"]]) {
      var el = $(pair[0]); var file = el && el.files[0];
      if (file) {
        var fd = new FormData(); fd.append("file", file);
        var r = await fetch(pair[1], { method: "POST", body: fd });
        if (!r.ok) { toast("Upload failed: " + pair[0], "error"); continue; }
        toast(pair[0] + " uploaded", "success");
      }
    }
    await loadStatus(); toast("Settings saved", "success");
  } catch (e) { toast("Save failed: " + e.message, "error"); }
});

// =============================================================
// HEALTH — D3
// =============================================================
var healthWorstTable = new DataTable("health-worst-table", { exportName: "health-worst", columns: [
  { key: "name", label: "Model" }, { key: "score", label: "Score" },
  { key: "grade", label: "Grade", render: gradeBadge },
  { key: "documentation_score", label: "Docs" }, { key: "test_score", label: "Tests" },
  { key: "freshness_score", label: "Freshness" },
]});
var healthTopTable = new DataTable("health-top-table", { exportName: "health-top", columns: [
  { key: "name", label: "Model" }, { key: "score", label: "Score" },
  { key: "grade", label: "Grade", render: gradeBadge },
  { key: "documentation_score", label: "Docs" }, { key: "test_score", label: "Tests" },
]});
var loadHealthBtn = $("load-health");
if (loadHealthBtn) loadHealthBtn.addEventListener("click", loadHealth);
async function loadHealth() {
  try {
    var h = await api("/api/health");
    if (!h.total_models) { $("health_kpis").innerHTML = '<p style="color:#94a3b8">Upload a manifest first.</p>'; return; }
    var g = h.by_grade || {};
    $("health_kpis").innerHTML = '<div class="kpi-grid">' +
      kpiCard(h.total_models, "Total Models") + kpiCard(h.average_score, "Avg Score") +
      kpiCard(h.fully_documented, "Fully Documented") + kpiCard(h.models_with_tests, "With Tests") +
      kpiCard(h.incremental_models, "Incremental") +
      kpiCard(g.A||0,"Grade A","#15803d") + kpiCard(g.B||0,"Grade B","#1d4ed8") +
      kpiCard(g.C||0,"Grade C","#b45309") + kpiCard(g.D||0,"Grade D","#dc2626") + '</div>';
    healthWorstTable.load(h.worst_offenders || []);
    healthTopTable.load((h.top_performers || []).slice().reverse());
  } catch (e) { toast(e.message, "error"); }
}

// =============================================================
// QUALITY — C3
// =============================================================
var qualityTable = new DataTable("quality-table", { exportName: "quality-scores", columns: [
  { key: "name", label: "Model" }, { key: "score", label: "Score" },
  { key: "grade", label: "Grade", render: gradeBadge },
  { key: "documentation_score", label: "Docs (40)" }, { key: "test_score", label: "Tests (40)" },
  { key: "freshness_score", label: "Fresh (20)" }, { key: "materialized", label: "Mat." },
]});
var loadQualBtn = $("load-quality");
if (loadQualBtn) loadQualBtn.addEventListener("click", async function() {
  try { qualityTable.load(await api("/api/quality")); } catch (e) { toast(e.message, "error"); }
});

// =============================================================
// LINEAGE — D1
// =============================================================
var lineageViewer = new LineageViewer("lineage-net", "lineage-detail");
var loadLinBtn = $("load-lineage");
if (loadLinBtn) loadLinBtn.addEventListener("click", async function() {
  try { var g = await api("/api/lineage"); lineageViewer.load(g); toast("Loaded " + g.nodes.length + " nodes", "success"); }
  catch (e) { toast(e.message, "error"); }
});
var lSearch = $("lineage-search");
if (lSearch) lSearch.addEventListener("input", function(e) { lineageViewer.search(e.target.value); });
var lFit    = $("lineage-fit");   if (lFit)    lFit.addEventListener("click",    function() { lineageViewer.fitView(); });
var lZIn    = $("lineage-zoomin");if (lZIn)   lZIn.addEventListener("click",     function() { lineageViewer.zoomIn(); });
var lZOut   = $("lineage-zoomout");if (lZOut) lZOut.addEventListener("click",    function() { lineageViewer.zoomOut(); });
var lPhys   = $("lineage-physics");if (lPhys) lPhys.addEventListener("change",   function(e) { lineageViewer.setPhysics(e.target.checked); });

// =============================================================
// COLUMN LINEAGE — D2
// =============================================================
attachAutocomplete($("col_model"), { filterKind: "model" });
var runColBtn = $("run-collineage");
if (runColBtn) runColBtn.addEventListener("click", async function() {
  var model = $("col_model") && $("col_model").value.trim();
  var col   = $("col_column") && $("col_column").value.trim();
  if (!model || !col) { toast("Enter model and column", "error"); return; }
  try {
    var r = await api("/api/lineage/column?model=" + encodeURIComponent(model) + "&column=" + encodeURIComponent(col));
    var out = $("col_out"); if (!out) return;
    out.style.display = "block";
    var trail = r.trail || [];
    if (!trail.length) { out.textContent = "No lineage trail found."; return; }
    out.textContent = trail.map(function(step) {
      var srcs = (step.from || []).map(function(x) { return (x[0]||"?") + "." + x[1]; }).join(", ") || "(literal/derived)";
      return step.model + "." + step.column + "  ←  " + srcs + (step.note ? " — " + step.note : "");
    }).join("\n");
  } catch (e) { toast(e.message, "error"); }
});

// =============================================================
// SEARCH — B3
// =============================================================
var searchTable = new DataTable("search-table", { exportName: "search-results", columns: [
  { key: "name", label: "Model" }, { key: "kind", label: "Kind" },
  { key: "description", label: "Description" }, { key: "score", label: "Score" },
]});
insertExamplesBar("search-examples", ["monthly revenue","customer lifetime value","active users","orders by country"],
  function(v) { setIfEl("search_q", v); });
var runSearchBtn = $("run-search");
if (runSearchBtn) runSearchBtn.addEventListener("click", async function() {
  var q = $("search_q") && $("search_q").value.trim(); if (!q) return;
  try { searchTable.load(await api("/api/search?q=" + encodeURIComponent(q) + "&limit=20")); }
  catch (e) { toast(e.message, "error"); }
});

// =============================================================
// CHAT — B1
// =============================================================
insertExamplesBar("chat-examples", [
  "Where is monthly active users calculated?",
  "Which models depend on stg_stripe__charges?",
  "What columns does fct_orders have?",
  "How is revenue defined?",
], function(v) { setIfEl("chat_input", v); });
var chatPanel = new ChatPanel("chat-history", "chat_input", "chat_send");
chatPanel.onSend(async function(q) { return api("/api/chat", { method:"POST", body:JSON.stringify({question:q}) }); });

// =============================================================
// NL2SQL — B2
// =============================================================
insertExamplesBar("nl2sql-examples", [
  "Top 10 customers by revenue last quarter",
  "Monthly active users by country",
  "Churn rate by plan tier",
  "Average order value by product category",
], function(v) { setIfEl("nl_q", v); });
var runNLBtn = $("run-nl2sql");
if (runNLBtn) runNLBtn.addEventListener("click", async function() {
  var q = $("nl_q") && $("nl_q").value.trim(); if (!q) return;
  try {
    var r = await api("/api/nl2sql", { method:"POST", body:JSON.stringify({question:q, dialect:($("nl_dialect")||{}).value||"snowflake"}) });
    var wrap = $("nl-sql-wrap"), out = $("nl_out"), btn = $("nl-run-bq");
    if (wrap) wrap.style.display = "block";
    if (out) out.textContent = r.sql;
    if (btn) { btn.style.display = "inline-flex"; btn.dataset.sql = r.sql; }
  } catch (e) { toast(e.message, "error"); }
});
var nlBQBtn = $("nl-run-bq");
if (nlBQBtn) nlBQBtn.addEventListener("click", async function() {
  try { renderBQResult("nl-bq-result", await api("/api/bigquery/query", { method:"POST", body:JSON.stringify({sql:this.dataset.sql}) })); }
  catch (e) { toast(e.message, "error"); }
});

// =============================================================
// DOCS — A1
// =============================================================
var undocTable = new DataTable("undoc-table", { exportName: "undocumented", columns: [
  { key: "name", label: "Model" }, { key: "description", label: "Current description" },
  { key: "column_count", label: "Columns" }, { key: "documented_columns", label: "Documented" },
]});
var loadUndocBtn = $("load-undocumented");
if (loadUndocBtn) loadUndocBtn.addEventListener("click", async function() {
  try { undocTable.load(await api("/api/docs/undocumented")); } catch (e) { toast(e.message, "error"); }
});
attachAutocomplete($("doc_model"), { filterKind: "model" });
var runDocsBtn = $("run-docs");
if (runDocsBtn) runDocsBtn.addEventListener("click", async function() {
  var model = $("doc_model") && $("doc_model").value.trim(); if (!model) return;
  var out = $("doc_out"); if (out) out.innerHTML = spinner() + " Generating…";
  try {
    var r = await api("/api/docs/generate", { method:"POST", body:JSON.stringify({model:model}) });
    if (out) out.innerHTML = codeBlock(r.yaml);
  } catch (e) { toast(e.message, "error"); if (out) out.textContent = ""; }
});

// =============================================================
// SCAFFOLD — A2
// =============================================================
insertExamplesBar("scaffold-examples", [
  "Daily revenue by country joining orders and customers",
  "Monthly active users grouped by plan tier",
  "Cohort retention table from events",
  "Inventory levels by warehouse and SKU",
], function(v) { setIfEl("scaf_brief", v); });
var runScafBtn = $("run-scaffold");
if (runScafBtn) runScafBtn.addEventListener("click", async function() {
  var brief = $("scaf_brief") && $("scaf_brief").value.trim(); if (!brief) return;
  var out = $("scaf_out"); if (out) out.innerHTML = spinner() + " Generating…";
  try {
    var r = await api("/api/scaffold", { method:"POST", body:JSON.stringify({brief:brief, layer:($("scaf_layer")||{}).value, materialization:($("scaf_mat")||{}).value}) });
    if (out) out.innerHTML = '<div class="card"><div class="card-title">' + esc(r.name||"") + '.sql</div>' + codeBlock(r.sql||"") + '</div>' +
      '<div class="card"><div class="card-title">schema.yml</div>' + codeBlock(r.yaml||"") + '</div>';
  } catch (e) { toast(e.message, "error"); if (out) out.textContent = ""; }
});

// =============================================================
// STAGING — A3
// =============================================================
insertExamplesBar("staging-examples", ["stripe · charges","salesforce · accounts","postgres · users","shopify · orders"],
  function(v) {
    var parts = v.split("·").map(function(s){return s.trim();});
    setIfEl("stg_src", parts[0]||""); setIfEl("stg_tbl", parts[1]||"");
  });
attachAutocomplete($("stg_src"), { filterKind: "source" });
var runStgBtn = $("run-staging");
if (runStgBtn) runStgBtn.addEventListener("click", async function() {
  var raw = $("stg_cols") && $("stg_cols").value.trim(), columns = null;
  if (raw) columns = raw.split("\n").map(function(l) { var p=l.split(","); return {name:(p[0]||"").trim(),type:(p[1]||"").trim()}; }).filter(function(c){return c.name;});
  var out = $("stg_out"); if (out) out.innerHTML = spinner() + " Generating…";
  try {
    var r = await api("/api/staging", { method:"POST", body:JSON.stringify({source_name:($("stg_src")||{}).value, table_name:($("stg_tbl")||{}).value, columns:columns}) });
    if (out) out.innerHTML = '<div class="card"><div class="card-title">' + esc(r.name||"") + '.sql</div>' + codeBlock(r.sql||"") + '</div>' +
      '<div class="card"><div class="card-title">schema.yml</div>' + codeBlock(r.yaml||"") + '</div>';
  } catch (e) { toast(e.message,"error"); if(out) out.textContent=""; }
});

// =============================================================
// INCREMENTAL — A4
// =============================================================
var incrTable = new DataTable("incr-table", { exportName: "incremental-candidates", columns: [
  { key: "name", label: "Model" }, { key: "current_materialization", label: "Materialization" },
  { key: "row_count", label: "Row count" }, { key: "incremental_score", label: "Score" },
  { key: "recommend_incremental", label: "Recommended", render: function(v){ return v?"✅ Yes":"—"; } },
]});
var loadIncrBtn = $("load-incr-analyze");
if (loadIncrBtn) loadIncrBtn.addEventListener("click", async function() {
  try { incrTable.load(await api("/api/incremental/analyze")); } catch (e) { toast(e.message,"error"); }
});
attachAutocomplete($("incr_model"), { filterKind: "model" });
var runIncrBtn = $("run-incr-rewrite");
if (runIncrBtn) runIncrBtn.addEventListener("click", async function() {
  var model = $("incr_model") && $("incr_model").value.trim(); if (!model) return;
  var out = $("incr_out"); if (out) out.innerHTML = spinner() + " Rewriting…";
  try {
    var r = await api("/api/incremental/rewrite", { method:"POST", body:JSON.stringify({model:model, ts_column:($("incr_ts")||{}).value, strategy:($("incr_strategy")||{}).value}) });
    if (out) out.innerHTML = '<div class="card">' + codeBlock((r.config_block||"") + "\n\n" + (r.sql||"")) + '</div>' +
      '<p style="color:#64748b;font-size:.85rem;margin-top:.5rem">' + esc(r.notes||"") + '</p>';
  } catch (e) { toast(e.message,"error"); if(out) out.textContent=""; }
});

// =============================================================
// TESTS — C1
// =============================================================
insertExamplesBar("tests-examples", ["dim_customers · id,email,status","fct_orders · order_id,customer_id,amount"],
  function(v) {
    var parts = v.split("·").map(function(s){return s.trim();});
    setIfEl("test_model", parts[0]||"");
    setIfEl("test_csv", (parts[1]||"") + "\n(paste CSV sample rows below)");
  });
attachAutocomplete($("test_model"), { filterKind: "model" });
var runTestsBtn = $("run-tests");
if (runTestsBtn) runTestsBtn.addEventListener("click", async function() {
  var model = $("test_model") && $("test_model").value.trim();
  var csv   = $("test_csv")   && $("test_csv").value.trim();
  if (!model || !csv) { toast("Enter model name and CSV sample","error"); return; }
  var out = $("test_out"); if (out) out.textContent = "Generating…";
  try {
    var r = await api("/api/tests/generate", { method:"POST", body:JSON.stringify({model:model, csv:csv}) });
    if (out) out.innerHTML = codeBlock(r.yaml);
  } catch (e) { toast(e.message,"error"); if(out) out.textContent=""; }
});

// =============================================================
// ANOMALY — C2
// =============================================================
attachAutocomplete($("anom_model"), { filterKind: "model" });
var runAnomBtn = $("run-anomaly");
if (runAnomBtn) runAnomBtn.addEventListener("click", async function() {
  var m = $("anom_model") && $("anom_model").value.trim();
  try {
    var r = await api("/api/anomaly/suggest" + (m ? "?model=" + encodeURIComponent(m) : ""));
    var items = Array.isArray(r) ? r : [r];
    $("anom_out").innerHTML = items.map(function(x) {
      return '<div class="card"><div class="card-title">' + esc(x.model) + '</div>' + codeBlock(x.yaml) +
        '<p style="font-size:.78rem;color:#64748b;margin-top:.5rem">Requires: <code>' + esc(x.package_required) + '</code></p></div>';
    }).join("");
  } catch (e) { toast(e.message,"error"); }
});

// =============================================================
// TEAMS — E2
// =============================================================
insertExamplesBar("cmd-examples", ["/help","/health","/quality 5","/sql top customers","/docs dim_customers","/anomaly fct_orders"],
  function(v) { setIfEl("cmd_in", v); });
var runCmdBtn = $("run-command");
if (runCmdBtn) runCmdBtn.addEventListener("click", async function() {
  var text = $("cmd_in") && $("cmd_in").value.trim(); if (!text) return;
  var out = $("cmd_out"); if(out){out.style.display="block"; out.textContent="Running…";}
  try { var r = await api("/api/command",{method:"POST",body:JSON.stringify({text:text})}); if(out) out.textContent=r.reply; }
  catch (e) { toast(e.message,"error"); }
});
var teamsTestBtn = $("run-teams-test");
if (teamsTestBtn) teamsTestBtn.addEventListener("click", async function() {
  try {
    var r = await api("/api/teams/test",{method:"POST",body:JSON.stringify({text:($("tm_txt")||{}).value||""})});
    var out = $("tm_out"); if(out){out.style.display="block"; out.textContent=JSON.stringify(r,null,2);}
  } catch (e) { toast(e.message,"error"); }
});

// =============================================================
// BIGQUERY
// =============================================================
var bqUploadBtn = $("bq-upload-key");
if (bqUploadBtn) bqUploadBtn.addEventListener("click", async function() {
  var file = $("bq_key_file") && $("bq_key_file").files[0];
  if (!file) { toast("Select a service account JSON file","error"); return; }
  var fd = new FormData(); fd.append("file", file);
  try {
    var r2 = await fetch("/api/bigquery/upload-key",{method:"POST",body:fd});
    var d = await r2.json();
    if (!r2.ok) throw new Error(d.error);
    setIfEl("bq_project_id", d.project_id||"");
    toast("Service account uploaded — project: " + d.project_id, "success");
    loadStatus();
  } catch (e) { toast(e.message,"error"); }
});
var bqSetProjBtn = $("bq-set-project");
if (bqSetProjBtn) bqSetProjBtn.addEventListener("click", async function() {
  var pid = $("bq_project_id") && $("bq_project_id").value.trim(); if (!pid) return;
  try { await api("/api/bigquery/project",{method:"POST",body:JSON.stringify({project_id:pid})}); toast("Project ID saved","success"); loadStatus(); }
  catch (e) { toast(e.message,"error"); }
});
var bqTestBtn = $("bq-test");
if (bqTestBtn) bqTestBtn.addEventListener("click", async function() {
  var st = $("bq_status");
  try {
    var r = await api("/api/bigquery/test",{method:"POST",body:"{}"});
    if(st){st.textContent="✅ Connected to "+r.project+" — datasets: "+(r.sample_datasets||[]).join(", "); st.style.color="#15803d";}
  } catch (e) { if(st){st.textContent="❌ "+e.message; st.style.color="#dc2626";} }
});
insertExamplesBar("bq-examples",["SELECT * FROM `project.dataset.table` LIMIT 100","SELECT DATE(created_at), COUNT(*) n FROM orders GROUP BY 1"],
  function(v){setIfEl("bq_sql",v);});
var runBQBtn = $("run-bq-query");
if (runBQBtn) runBQBtn.addEventListener("click", async function() {
  var sql = $("bq_sql") && $("bq_sql").value.trim(); if (!sql) return;
  var res = $("bq_result"); if(res) res.innerHTML = spinner() + " Running…";
  try { renderBQResult("bq_result", await api("/api/bigquery/query",{method:"POST",body:JSON.stringify({sql:sql})})); }
  catch (e) { toast(e.message,"error"); if(res) res.innerHTML=""; }
});
function renderBQResult(containerId, r) {
  var el = $(containerId); if (!el) return;
  var cols = (r.schema||[]).map(function(f){ return {key:f.name, label:f.name+" ("+f.type+")"}; });
  var info = '<div class="bq-result-info"><span>Rows: <strong>'+(r.rows&&r.rows.length||0)+(r.truncated?"+":"")+'</strong></span>' +
    (r.bytes_processed?'<span>Scanned: <strong>'+(r.bytes_processed/1e6).toFixed(1)+' MB</strong></span>':'') +
    (r.truncated?'<span style="color:#b45309">⚠ Truncated to 500 rows</span>':'') + '</div>';
  var tblId = "bqtbl" + Date.now();
  el.innerHTML = info + '<div id="' + tblId + '"></div>';
  new DataTable(tblId, { columns: cols, exportName: "bigquery-result" }).load(r.rows||[]);
}

// =============================================================
// DOCS viewer
// =============================================================
new DocsViewer("docs-sidebar-nav", "docs-content-area", "docs-search");

// =============================================================
// Start
// =============================================================
show("health");
loadHealth();

// ============================================================
// lineage_viewer.js — vis-network lineage with zoom, search, node panel
// ============================================================

const LAYER_COLORS = {
  source:       { bg: "#fef3c7", border: "#f59e0b", text: "#78350f" },
  seed:         { bg: "#ede9fe", border: "#8b5cf6", text: "#4c1d95" },
  staging:      { bg: "#e0f2fe", border: "#0ea5e9", text: "#0c4a6e" },
  intermediate: { bg: "#d1fae5", border: "#10b981", text: "#064e3b" },
  marts:        { bg: "#ffe4e6", border: "#f43f5e", text: "#881337" },
  other:        { bg: "#f1f5f9", border: "#94a3b8", text: "#334155" },
};

function layerFor(node) {
  if (node.kind === "source") return "source";
  if (node.kind === "seed") return "seed";
  const name = (node.name || "").toLowerCase();
  if (name.startsWith("stg_")) return "staging";
  if (name.startsWith("int_")) return "intermediate";
  if (name.startsWith("fct_") || name.startsWith("dim_") || name.startsWith("mart_")) return "marts";
  const mat = node.materialized || "";
  if (mat === "incremental") return "marts";
  return "other";
}

export class LineageViewer {
  constructor(netContainerId, detailPanelId) {
    this.netEl = document.getElementById(netContainerId);
    this.detailEl = document.getElementById(detailPanelId);
    this.network = null;
    this._nodes = null;
    this._edges = null;
    this._rawNodes = [];
  }

  load(graphData) {
    if (!this.netEl || !window.vis) return;
    this._rawNodes = graphData.nodes || [];

    const visNodes = new vis.DataSet(graphData.nodes.map(n => {
      const layer = layerFor(n);
      const c = LAYER_COLORS[layer] || LAYER_COLORS.other;
      return {
        id: n.id,
        label: n.name,
        title: `<b>${n.kind}</b>: ${n.name}<br>${n.description || ""}`,
        color: { background: c.bg, border: c.border, highlight: { background: "#dbeafe", border: "#2563eb" } },
        font: { color: c.text, size: 13 },
        shape: n.kind === "source" ? "box" : "ellipse",
        _raw: n,
      };
    }));

    const visEdges = new vis.DataSet(graphData.edges.map(e => ({
      from: e.from, to: e.to,
      arrows: "to",
      color: { color: "#cbd5e1", highlight: "#2563eb" },
      smooth: { type: "cubicBezier", roundness: 0.3 },
    })));

    this._nodes = visNodes;
    this._edges = visEdges;

    this.network = new vis.Network(this.netEl,
      { nodes: visNodes, edges: visEdges },
      {
        layout: { improvedLayout: true },
        physics: {
          enabled: true,
          barnesHut: { gravitationalConstant: -8000, springLength: 120, damping: 0.5 },
          stabilization: { iterations: 150, updateInterval: 25 },
        },
        interaction: {
          hover: true, tooltipDelay: 200,
          navigationButtons: false, keyboard: true,
          zoomView: true,
        },
        nodes: { borderWidth: 1.5, borderWidthSelected: 2.5, shadow: { enabled: true, size: 4, x: 2, y: 2, color: "rgba(0,0,0,.08)" } },
        edges: { width: 1.2, selectionWidth: 2 },
      }
    );

    this.network.on("click", params => {
      if (params.nodes.length) this._showDetail(params.nodes[0]);
      else this._hideDetail();
    });

    this.network.once("stabilizationIterationsDone", () => {
      this.network.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
    });
  }

  search(q) {
    if (!this._nodes || !q) {
      this._nodes?.forEach(n => this._nodes.update({ id: n.id, opacity: 1 }));
      return;
    }
    const lower = q.toLowerCase();
    const matches = new Set();
    this._rawNodes.forEach(n => {
      if (n.name.toLowerCase().includes(lower)) matches.add(n.id);
    });
    this._nodes.forEach(n => {
      this._nodes.update({ id: n.id, opacity: matches.has(n.id) ? 1 : 0.2 });
    });
    if (matches.size === 1) {
      const [id] = matches;
      this.network.focus(id, { scale: 1.5, animation: { duration: 600, easingFunction: "easeInOutQuad" } });
    }
  }

  fitView() {
    this.network?.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
  }
  zoomIn() { this.network?.moveTo({ scale: (this.network.getScale() || 1) * 1.3 }); }
  zoomOut() { this.network?.moveTo({ scale: (this.network.getScale() || 1) * 0.77 }); }

  setPhysics(enabled) {
    this.network?.setOptions({ physics: { enabled } });
  }

  _showDetail(nodeId) {
    if (!this.detailEl) return;
    const node = this._rawNodes.find(n => n.id === nodeId);
    if (!node) return;
    const layer = layerFor(node);
    const c = LAYER_COLORS[layer] || LAYER_COLORS.other;
    this.detailEl.style.display = "block";
    this.detailEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
        <h4 style="color:${c.border}">${node.name}</h4>
        <button onclick="this.closest('.node-detail-panel').style.display='none'" style="background:none;border:none;cursor:pointer;color:#94a3b8">✕</button>
      </div>
      <div class="nd-row"><span class="nd-key">Kind</span><span>${node.kind}</span></div>
      <div class="nd-row"><span class="nd-key">Layer</span><span>${layer}</span></div>
      ${node.schema ? `<div class="nd-row"><span class="nd-key">Schema</span><span>${node.schema}</span></div>` : ""}
      ${node.materialized ? `<div class="nd-row"><span class="nd-key">Materialization</span><span>${node.materialized}</span></div>` : ""}
      ${node.description ? `<div style="margin-top:.4rem;font-size:.78rem;color:#475569;line-height:1.4">${node.description.slice(0, 200)}</div>` : ""}
    `;
  }
  _hideDetail() {
    if (this.detailEl) this.detailEl.style.display = "none";
  }
}

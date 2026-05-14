// ============================================================
// table_tools.js — searchable, sortable, filterable data table
// ============================================================
import { esc, toast } from "./ui.js";

export class DataTable {
  constructor(containerId, { columns, pageSize = 50, exportName = "export" }) {
    this.el = document.getElementById(containerId);
    if (!this.el) return;
    this.columns = columns; // [{key, label, width?, render?}]
    this.pageSize = pageSize;
    this.exportName = exportName;
    this._data = [];
    this._filtered = [];
    this._sortKey = null;
    this._sortDir = 1;
    this._page = 0;
    this._q = "";
    this._filterCol = "";
    this._build();
  }

  _build() {
    this.el.className = "data-table-wrap";
    this.el.innerHTML = `
      <div class="data-table-toolbar">
        <input class="dt-search" placeholder="Search…" />
        <select class="dt-filter-col">
          <option value="">All columns</option>
          ${this.columns.map(c => `<option value="${c.key}">${c.label}</option>`).join("")}
        </select>
        <div style="margin-left:auto;display:flex;gap:.4rem">
          <button class="btn btn-secondary btn-sm dt-export-xlsx">⬇ Excel</button>
          <button class="btn btn-secondary btn-sm no-print" onclick="window.print()">🖨 PDF</button>
        </div>
      </div>
      <div class="scroll-table-container">
        <table><thead><tr class="dt-head"></tr></thead><tbody class="dt-body"></tbody></table>
      </div>
      <div class="data-table-footer">
        <span class="dt-info"></span>
        <div style="display:flex;gap:.35rem">
          <button class="btn btn-ghost btn-sm dt-prev">‹ Prev</button>
          <button class="btn btn-ghost btn-sm dt-next">Next ›</button>
        </div>
      </div>`;

    const head = this.el.querySelector(".dt-head");
    this.columns.forEach(col => {
      const th = document.createElement("th");
      th.dataset.key = col.key;
      th.innerHTML = `${esc(col.label)}<span class="sort-icon"></span>`;
      if (col.width) th.style.width = col.width;
      th.addEventListener("click", () => this._toggleSort(col.key, th));
      head.appendChild(th);
    });

    this.el.querySelector(".dt-search").addEventListener("input", e => {
      this._q = e.target.value.toLowerCase();
      this._page = 0;
      this._filter();
      this._render();
    });
    this.el.querySelector(".dt-filter-col").addEventListener("change", e => {
      this._filterCol = e.target.value;
      this._filter();
      this._render();
    });
    this.el.querySelector(".dt-prev").addEventListener("click", () => {
      if (this._page > 0) { this._page--; this._render(); }
    });
    this.el.querySelector(".dt-next").addEventListener("click", () => {
      if ((this._page + 1) * this.pageSize < this._filtered.length) { this._page++; this._render(); }
    });
    this.el.querySelector(".dt-export-xlsx").addEventListener("click", () => this.exportExcel());
  }

  load(data) {
    this._data = data || [];
    this._page = 0;
    this._q = "";
    this.el && (this.el.querySelector(".dt-search").value = "");
    this._filter();
    this._render();
  }

  _filter() {
    const q = this._q;
    const fc = this._filterCol;
    this._filtered = this._data.filter(row => {
      if (!q) return true;
      const targets = fc ? [String(row[fc] ?? "")] : this.columns.map(c => String(row[c.key] ?? ""));
      return targets.some(t => t.toLowerCase().includes(q));
    });
    if (this._sortKey) this._sort();
  }

  _toggleSort(key, th) {
    if (this._sortKey === key) { this._sortDir *= -1; }
    else { this._sortKey = key; this._sortDir = 1; }
    this.el.querySelectorAll("th").forEach(h => h.classList.remove("sort-asc", "sort-desc"));
    th.classList.add(this._sortDir === 1 ? "sort-asc" : "sort-desc");
    this._sort();
    this._render();
  }

  _sort() {
    const k = this._sortKey, d = this._sortDir;
    this._filtered = [...this._filtered].sort((a, b) => {
      const av = a[k] ?? "", bv = b[k] ?? "";
      return (typeof av === "number" && typeof bv === "number")
        ? (av - bv) * d
        : String(av).localeCompare(String(bv)) * d;
    });
  }

  _render() {
    if (!this.el) return;
    const start = this._page * this.pageSize;
    const page = this._filtered.slice(start, start + this.pageSize);
    const tbody = this.el.querySelector(".dt-body");
    if (!page.length) {
      tbody.innerHTML = `<tr><td colspan="${this.columns.length}" class="table-empty">No results</td></tr>`;
    } else {
      tbody.innerHTML = page.map(row => `<tr>${
        this.columns.map(col => {
          const val = row[col.key] ?? "";
          const cell = col.render ? col.render(val, row) : esc(String(val));
          return `<td>${cell}</td>`;
        }).join("")
      }</tr>`).join("");
    }
    const total = this._filtered.length;
    this.el.querySelector(".dt-info").textContent =
      `${start + 1}–${Math.min(start + this.pageSize, total)} of ${total}`;
  }

  async exportExcel() {
    try {
      const rows = this._filtered.map(row => {
        const out = {};
        this.columns.forEach(c => { out[c.key] = row[c.key] ?? ""; });
        return out;
      });
      const cols = this.columns.map(c => c.key);
      const r = await fetch("/api/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, columns: cols, filename: this.exportName }),
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${this.exportName}.xlsx`;
      a.click();
      toast("Excel downloaded", "success");
    } catch (e) {
      toast("Export failed: " + e.message, "error");
    }
  }
}

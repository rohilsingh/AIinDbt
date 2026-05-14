// ============================================================
// docs_viewer.js — multi-page in-app documentation
// ============================================================
import { DOCS_PAGES } from "../content/docs_content.js";

export class DocsViewer {
  constructor(sidebarId, contentId, searchId) {
    this.sidebar = document.getElementById(sidebarId);
    this.content = document.getElementById(contentId);
    this.searchEl = document.getElementById(searchId);
    this._currentId = null;
    this._build();
  }

  _build() {
    if (!this.sidebar) return;
    this._renderSidebar(DOCS_PAGES);
    if (this.searchEl) {
      this.searchEl.addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        this._renderSidebar(
          q ? DOCS_PAGES.filter(p => p.title.toLowerCase().includes(q) || p.section.toLowerCase().includes(q)) : DOCS_PAGES
        );
        if (this._currentId) {
          const item = this.sidebar.querySelector(`[data-id="${this._currentId}"]`);
          if (item) item.classList.add("active");
        }
      });
    }
    if (DOCS_PAGES.length) this.show(DOCS_PAGES[0].id);
  }

  _renderSidebar(pages) {
    if (!this.sidebar) return;
    const sections = {};
    pages.forEach(p => {
      if (!sections[p.section]) sections[p.section] = [];
      sections[p.section].push(p);
    });
    this.sidebar.innerHTML = Object.entries(sections).map(([sec, items]) => `
      <div class="docs-sidebar-section">${sec}</div>
      ${items.map(p => `<div class="docs-sidebar-item${p.id === this._currentId ? " active" : ""}" data-id="${p.id}">${p.title}</div>`).join("")}
    `).join("");
    this.sidebar.querySelectorAll(".docs-sidebar-item").forEach(el =>
      el.addEventListener("click", () => this.show(el.dataset.id))
    );
  }

  show(id) {
    this._currentId = id;
    const page = DOCS_PAGES.find(p => p.id === id);
    if (!page || !this.content) return;
    this.sidebar?.querySelectorAll(".docs-sidebar-item").forEach(el =>
      el.classList.toggle("active", el.dataset.id === id)
    );
    this.content.innerHTML = `
      <div style="border-bottom:1px solid #e2e8f0;margin-bottom:1.25rem;padding-bottom:.75rem">
        <div style="font-size:.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">${page.section}</div>
        <h1>${page.title}</h1>
      </div>
      ${page.body}
    `;
    this.content.scrollTop = 0;
  }
}

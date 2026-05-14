// ============================================================
// ui.js — reusable UI primitives
// ============================================================

// ---- toast -----------------------------------------------------------------
export function toast(msg, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ---- code block with copy button -------------------------------------------
export function codeBlock(text, lang = "") {
  const id = `cb-${Math.random().toString(36).slice(2)}`;
  return `
    <div class="code-block-wrap">
      <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('${id}').textContent);this.textContent='✓ Copied'">Copy</button>
      <pre id="${id}">${esc(text)}</pre>
    </div>`;
}

// ---- escape HTML -----------------------------------------------------------
export function esc(s) {
  return (s ?? "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- examples bar ----------------------------------------------------------
export function examplesBar(examples, onPick) {
  const chips = examples.map(ex =>
    `<span class="example-chip" data-val="${esc(ex)}">${esc(ex)}</span>`
  ).join("");
  const wrap = document.createElement("div");
  wrap.className = "examples-bar";
  wrap.innerHTML = `<div class="examples-label">Examples</div><div class="examples-chips">${chips}</div>`;
  wrap.querySelectorAll(".example-chip").forEach(c =>
    c.addEventListener("click", () => onPick(c.dataset.val))
  );
  return wrap;
}

// ---- KPI card --------------------------------------------------------------
export function kpiCard(value, label, color = "#1e40af") {
  return `<div class="kpi-card">
    <div class="kpi-value" style="color:${color}">${esc(String(value))}</div>
    <div class="kpi-label">${esc(label)}</div>
  </div>`;
}

// ---- spinner ---------------------------------------------------------------
export function spinner() {
  return `<span style="display:inline-block;width:16px;height:16px;border:2px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:.4rem"></span>`;
}
// inject spin keyframe once
if (!document.getElementById("__spin_style")) {
  const s = document.createElement("style");
  s.id = "__spin_style";
  s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
  document.head.appendChild(s);
}

// ---- grade badge -----------------------------------------------------------
export function gradeBadge(g) {
  const colors = { A: "#15803d", B: "#1d4ed8", C: "#b45309", D: "#dc2626" };
  return `<span class="grade-${g}" style="font-weight:700">${g}</span>`;
}

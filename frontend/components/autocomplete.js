// ============================================================
// autocomplete.js — model/source name autocomplete
// ============================================================

let _cache = null;

async function getModelList() {
  if (_cache) return _cache;
  try {
    const r = await fetch("/api/models/list");
    const d = await r.json();
    _cache = [
      ...(d.models || []).map(m => ({ name: m.name, kind: "model", extra: m.materialized || "" })),
      ...(d.sources || []).map(s => ({ name: s.name, kind: "source", extra: s.source_name || "" })),
    ];
  } catch (_) {
    _cache = [];
  }
  return _cache;
}

export async function warmCache() {
  await getModelList();
}

export function attachAutocomplete(inputEl, { filterKind = null, onSelect = null } = {}) {
  if (!inputEl) return;
  const wrap = document.createElement("div");
  wrap.className = "autocomplete-wrap";
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  const dropdown = document.createElement("div");
  dropdown.className = "autocomplete-dropdown";
  dropdown.style.display = "none";
  wrap.appendChild(dropdown);

  let items = [], focused = -1;

  function show(list) {
    items = list;
    focused = -1;
    dropdown.innerHTML = list.slice(0, 20).map((it, i) =>
      `<div class="autocomplete-item" data-idx="${i}">
        <span class="ac-kind ${it.kind}">${it.kind}</span>
        <span>${it.name}</span>
        ${it.extra ? `<span style="color:#94a3b8;font-size:.72rem;margin-left:auto">${it.extra}</span>` : ""}
      </div>`
    ).join("");
    dropdown.style.display = list.length ? "block" : "none";
    dropdown.querySelectorAll(".autocomplete-item").forEach((el, i) => {
      el.addEventListener("mousedown", e => { e.preventDefault(); pick(i); });
    });
  }

  function hide() { dropdown.style.display = "none"; focused = -1; }

  function pick(i) {
    const it = items[i];
    if (!it) return;
    inputEl.value = it.name;
    hide();
    onSelect && onSelect(it);
    inputEl.dispatchEvent(new Event("input"));
  }

  inputEl.addEventListener("input", async () => {
    const q = inputEl.value.toLowerCase().trim();
    if (!q) { hide(); return; }
    const all = await getModelList();
    const filtered = all.filter(it => {
      if (filterKind && it.kind !== filterKind) return false;
      return it.name.toLowerCase().includes(q) || it.extra.toLowerCase().includes(q);
    });
    show(filtered);
  });

  inputEl.addEventListener("keydown", e => {
    if (dropdown.style.display === "none") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focused = Math.min(focused + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focused = Math.max(focused - 1, 0);
    } else if (e.key === "Enter") {
      if (focused >= 0) { e.preventDefault(); pick(focused); }
      else hide();
      return;
    } else if (e.key === "Escape") { hide(); return; }
    dropdown.querySelectorAll(".autocomplete-item").forEach((el, i) =>
      el.classList.toggle("focused", i === focused)
    );
    const focusedEl = dropdown.querySelector(".focused");
    if (focusedEl) focusedEl.scrollIntoView({ block: "nearest" });
  });

  inputEl.addEventListener("blur", () => setTimeout(hide, 150));
  inputEl.addEventListener("focus", async () => {
    if (!inputEl.value) return;
    inputEl.dispatchEvent(new Event("input"));
  });
}

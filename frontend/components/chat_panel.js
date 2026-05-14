// ============================================================
// chat_panel.js — chat bubbles + bookmarks drawer
// ============================================================
import { esc, codeBlock, toast } from "./ui.js";

const BM_KEY = "aiindbt_bookmarks";

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(BM_KEY) || "[]"); }
  catch (_) { return []; }
}
function saveBookmarks(bms) {
  localStorage.setItem(BM_KEY, JSON.stringify(bms));
}

export class ChatPanel {
  constructor(historyId, inputId, sendBtnId, contextId = null) {
    this.history = document.getElementById(historyId);
    this.input = document.getElementById(inputId);
    this.sendBtn = document.getElementById(sendBtnId);
    this.contextEl = contextId ? document.getElementById(contextId) : null;
    this._onSend = null;

    if (this.sendBtn) this.sendBtn.addEventListener("click", () => this._send());
    if (this.input) {
      this.input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._send(); }
      });
    }
  }

  onSend(fn) { this._onSend = fn; }

  async _send() {
    const text = this.input?.value.trim();
    if (!text || !this._onSend) return;
    this.input.value = "";
    this.addMessage("user", text);
    this.setTyping(true);
    try {
      const result = await this._onSend(text);
      this.setTyping(false);
      this.addMessage("bot", result.answer || result.sql || result.reply || JSON.stringify(result));
      if (this.contextEl && result.context_used) {
        this.contextEl.innerHTML = `<div class="chat-context">Context used: ${esc(result.context_used.slice(0, 300))}</div>`;
      }
    } catch (e) {
      this.setTyping(false);
      this.addMessage("bot", `⚠️ Error: ${e.message}`);
    }
  }

  addMessage(role, text) {
    if (!this.history) return;
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const wrap = document.createElement("div");
    wrap.className = `chat-bubble-wrap ${role}`;
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // detect code blocks in response
    let displayText = role === "bot" ? _formatBotText(text) : `<span>${esc(text)}</span>`;

    wrap.innerHTML = `
      <div class="chat-bubble" id="${id}">${displayText}</div>
      <div class="chat-bubble-meta">
        <span>${ts}</span>
        ${role === "bot" ? `
          <button title="Copy" onclick="_copyMsg('${id}')">📋</button>
          <button title="Bookmark" onclick="_bookmarkMsg('${id}', this)">🔖</button>
        ` : ""}
      </div>`;
    this.history.appendChild(wrap);
    this.history.scrollTop = this.history.scrollHeight;
  }

  setTyping(on) {
    const existing = this.history?.querySelector(".chat-typing");
    if (on && !existing) {
      const t = document.createElement("div");
      t.className = "chat-typing";
      t.textContent = "Thinking…";
      this.history.appendChild(t);
      this.history.scrollTop = this.history.scrollHeight;
    } else if (!on && existing) {
      existing.remove();
    }
  }

  clear() {
    if (this.history) this.history.innerHTML = "";
  }
}

function _formatBotText(text) {
  // Wrap ```...``` blocks in <pre>
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
      `<pre style="margin:0;background:#0f172a;color:#e2e8f0;padding:.6rem;border-radius:6px;font-size:.78rem;white-space:pre-wrap">${esc(code.trim())}</pre>`
    )
    .replace(/\n/g, "<br>");
}

// global helpers (attached to window so inline onclick works)
window._copyMsg = function (id) {
  const el = document.getElementById(id);
  if (el) {
    navigator.clipboard.writeText(el.innerText);
    toast("Copied", "success");
  }
};

window._bookmarkMsg = function (id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const bms = loadBookmarks();
  bms.unshift({ id: Date.now(), text: el.innerText, ts: new Date().toISOString() });
  saveBookmarks(bms);
  btn.textContent = "✅";
  renderBookmarksDrawer();
  toast("Bookmarked", "success");
};

export function renderBookmarksDrawer() {
  const body = document.getElementById("bookmarks-body");
  if (!body) return;
  const bms = loadBookmarks();
  if (!bms.length) {
    body.innerHTML = `<div class="drawer-empty">No bookmarks yet.<br>Click 🔖 on any AI response.</div>`;
    return;
  }
  body.innerHTML = bms.map(b => `
    <div class="bookmark-item">
      <div class="bm-label">${new Date(b.ts).toLocaleString()}</div>
      <pre>${esc(b.text.slice(0, 400))}${b.text.length > 400 ? "…" : ""}</pre>
      <button class="bm-delete" onclick="_deleteBm(${b.id})">✕</button>
    </div>`).join("");
}

window._deleteBm = function (id) {
  const bms = loadBookmarks().filter(b => b.id !== id);
  saveBookmarks(bms);
  renderBookmarksDrawer();
};

export function toggleBookmarksDrawer() {
  const d = document.getElementById("bookmarks-drawer");
  if (d) { d.classList.toggle("open"); renderBookmarksDrawer(); }
}

function toast(msg, type) {
  // local fallback if ui.js toast not available
  const c = document.getElementById("toast-container");
  if (!c) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

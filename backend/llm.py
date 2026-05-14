"""Thin Claude wrapper. Supports Anthropic-direct or any OpenAI-compatible
gateway (Cline, OpenRouter, etc.) via base_url."""
from __future__ import annotations

import json
import httpx

from .state import SETTINGS


SYSTEM_DEFAULT = (
    "You are a senior analytics engineer who is an expert at dbt, SQL, and "
    "modern data stacks. Answer concisely. When asked for code, return code "
    "only — no prose, no markdown fences — unless the user asks for explanation."
)


def _is_openai_compatible(base_url: str) -> bool:
    """Cline gateway and OpenRouter use OpenAI-style /chat/completions.
    Anthropic-direct uses /v1/messages."""
    if not base_url:
        return False
    host = base_url.lower()
    return any(s in host for s in ("openrouter", "cline", "/v1/chat", "openai"))


def chat(prompt: str, system: str = SYSTEM_DEFAULT, max_tokens: int = 4096) -> str:
    if not SETTINGS.llm_api_key:
        raise RuntimeError("LLM API key not configured — set it in the Settings tab.")

    base = SETTINGS.llm_base_url.rstrip("/")
    model = SETTINGS.llm_model

    if _is_openai_compatible(base):
        url = f"{base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {SETTINGS.llm_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/rohilsingh/aiindbt",
            "X-Title": "AIinDbt",
        }
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
        r = httpx.post(url, headers=headers, json=body, timeout=120)
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]

    # Anthropic direct
    url = (base or "https://api.anthropic.com") + "/v1/messages"
    headers = {
        "x-api-key": SETTINGS.llm_api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }
    r = httpx.post(url, headers=headers, json=body, timeout=120)
    r.raise_for_status()
    data = r.json()
    return "".join(block["text"] for block in data["content"] if block["type"] == "text")


def chat_json(prompt: str, system: str = SYSTEM_DEFAULT) -> dict:
    """Ask the model to return strict JSON. Strips fences if the model adds them."""
    raw = chat(prompt + "\n\nReturn valid JSON only. No markdown fences.", system=system)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(raw)

"""E2 — Microsoft Teams bot via Outgoing Webhook.

Outgoing Webhooks are the no-Azure-registration path: a channel owner
creates one in Teams, gets a shared HMAC secret, and points it at our
URL. Teams POSTs every @mention; we verify the HMAC, run the chat
feature, and reply synchronously with the bot reply JSON. We can also
push messages to an Incoming Webhook URL (one-way).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Any

import httpx
from fastapi import HTTPException, Request

from ..state import SETTINGS
from . import chat


def _verify(body: bytes, auth_header: str) -> bool:
    """Teams sends `Authorization: HMAC <base64-sha256>` where the digest
    is HMAC-SHA256(body) keyed by the secret Teams shows you at webhook
    creation time."""
    if not SETTINGS.teams_outgoing_secret:
        return False
    if not auth_header.startswith("HMAC "):
        return False
    provided = auth_header[5:].strip()
    key = base64.b64decode(SETTINGS.teams_outgoing_secret)
    digest = hmac.new(key, body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, provided)


def _extract_text(payload: dict[str, Any]) -> str:
    """Strip the bot @mention out of the incoming message."""
    text = payload.get("text") or ""
    # Teams wraps mentions in <at>BotName</at>; remove anything between <at>..</at>
    import re
    text = re.sub(r"<at>.*?</at>", "", text)
    return text.strip()


async def handle_event(request: Request) -> dict[str, Any]:
    body = await request.body()
    auth = request.headers.get("authorization", "")
    if SETTINGS.teams_outgoing_secret and not _verify(body, auth):
        raise HTTPException(401, "invalid Teams HMAC signature")

    payload = await request.json()
    text = _extract_text(payload)
    if not text:
        return {"type": "message", "text": "Ask me something about your dbt project."}

    try:
        ans = chat.ask(text)
        reply = ans["answer"]
    except Exception as e:
        reply = f"Sorry — I hit an error: {e}"

    # Teams Outgoing Webhook accepts plain message or Adaptive Card.
    return {"type": "message", "text": reply}


def test_send(text: str = "Hello from AIinDbt 👋") -> dict:
    """Push a message to the configured Incoming Webhook URL."""
    url = SETTINGS.teams_incoming_webhook
    if not url:
        raise RuntimeError("Teams Incoming Webhook URL not configured.")
    r = httpx.post(url, json={"text": text}, timeout=30)
    return {"status_code": r.status_code, "body": r.text}

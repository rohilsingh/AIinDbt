"""E2 — Slack bot.

Verifies Slack's signed requests, then routes any @-mention or DM to the
chat feature (B1) and replies in-thread.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any

import httpx
from fastapi import HTTPException, Request

from ..state import SETTINGS
from . import chat


def _verify(req_body: bytes, timestamp: str, signature: str) -> bool:
    if not SETTINGS.slack_signing_secret:
        return False
    if abs(time.time() - int(timestamp)) > 60 * 5:
        return False
    basestring = f"v0:{timestamp}:{req_body.decode()}"
    expected = "v0=" + hmac.new(
        SETTINGS.slack_signing_secret.encode(),
        basestring.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def handle_event(request: Request) -> dict[str, Any]:
    body = await request.body()
    ts = request.headers.get("x-slack-request-timestamp", "")
    sig = request.headers.get("x-slack-signature", "")
    if SETTINGS.slack_signing_secret and not _verify(body, ts, sig):
        raise HTTPException(401, "invalid Slack signature")

    payload = await request.json()
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    event = payload.get("event") or {}
    if event.get("type") in ("app_mention", "message") and not event.get("bot_id"):
        text = event.get("text", "").split(">", 1)[-1].strip() or event.get("text", "")
        if not text:
            return {"ok": True}
        try:
            ans = chat.ask(text)
            reply = ans["answer"]
        except Exception as e:
            reply = f"Sorry — I hit an error: {e}"
        _post_message(
            channel=event["channel"],
            text=reply,
            thread_ts=event.get("thread_ts") or event.get("ts"),
        )
    return {"ok": True}


def _post_message(channel: str, text: str, thread_ts: str | None = None) -> None:
    if not SETTINGS.slack_bot_token:
        return
    httpx.post(
        "https://slack.com/api/chat.postMessage",
        headers={
            "Authorization": f"Bearer {SETTINGS.slack_bot_token}",
            "Content-Type": "application/json; charset=utf-8",
        },
        json={"channel": channel, "text": text, "thread_ts": thread_ts},
        timeout=30,
    )


def test_send(channel: str, text: str = "Hello from AIinDbt 👋") -> dict:
    if not SETTINGS.slack_bot_token:
        raise RuntimeError("Slack bot token not configured.")
    r = httpx.post(
        "https://slack.com/api/chat.postMessage",
        headers={"Authorization": f"Bearer {SETTINGS.slack_bot_token}"},
        json={"channel": channel, "text": text},
        timeout=30,
    )
    return r.json()

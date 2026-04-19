"""
WAHA (WhatsApp HTTP API) client — internal ops alerts.

Fires fire-and-forget WhatsApp notifications to Zensbot's self-hosted WAHA
instance (https://admin.zensbot.com). Never raises to the caller — a WhatsApp
outage must never break a user's signup flow.

Environment variables (all optional — missing any disables WAHA silently):

  WAHA_URL                        base URL, e.g. https://admin.zensbot.com
  WAHA_API_KEY                    X-Api-Key header value
  WAHA_SESSION                    WAHA session name, e.g. admin
  WAHA_SIGNUP_ALERT_NUMBERS       comma-separated recipient numbers in digits-only
                                    form, no + prefix. e.g.
                                    923362219755,923344720491
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

PKT = timezone(timedelta(hours=5))


def _config() -> Optional[tuple[str, str, str, list[str]]]:
    """Read WAHA config from env. Returns None if any required var is missing."""
    url = os.environ.get("WAHA_URL", "").rstrip("/")
    api_key = os.environ.get("WAHA_API_KEY", "")
    session = os.environ.get("WAHA_SESSION", "")
    numbers_raw = os.environ.get("WAHA_SIGNUP_ALERT_NUMBERS", "")
    if not (url and api_key and session and numbers_raw):
        return None
    numbers = [n.strip() for n in numbers_raw.split(",") if n.strip()]
    if not numbers:
        return None
    return url, api_key, session, numbers


def _send_text(url: str, api_key: str, session: str, chat_id: str, text: str) -> bool:
    """POST to /api/sendText. Returns True on 2xx, False otherwise."""
    payload = json.dumps(
        {"session": session, "chatId": chat_id, "text": text}
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{url}/api/sendText",
        data=payload,
        headers={"Content-Type": "application/json", "X-Api-Key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310 — trusted internal host
            if 200 <= resp.status < 300:
                return True
            logger.warning("WAHA sendText non-2xx chat=%s status=%s", chat_id, resp.status)
            return False
    except urllib.error.HTTPError as exc:
        logger.warning("WAHA sendText HTTPError chat=%s code=%s reason=%s", chat_id, exc.code, exc.reason)
        return False
    except Exception as exc:  # pragma: no cover — network errors are non-deterministic
        logger.warning("WAHA sendText exception chat=%s err=%s", chat_id, exc)
        return False


def _format_signup_time() -> str:
    """Render current time in Asia/Karachi (PKT) as a compact readable string."""
    now = datetime.now(PKT)
    # Cross-platform: %#d on Windows, %-d on Unix — use portable %d then strip leading 0.
    raw = now.strftime("%b %d, %I:%M %p PKT")
    # Strip leading zero on day and hour for natural reading ("Apr 9" not "Apr 09").
    return raw.replace(" 0", " ", 1).replace(", 0", ", ", 1)


def notify_new_signup(
    *,
    institute_name: str,
    institute_slug: str,
    admin_name: str,
    admin_email: str,
    admin_phone: Optional[str],
    plan_tier: str,
    base_domain: Optional[str] = None,
) -> None:
    """Send a rich WhatsApp alert to all configured recipient numbers.

    Fire-and-forget: catches every exception, never raises. Designed to run
    inside FastAPI BackgroundTasks after the signup DB commit.
    """
    cfg = _config()
    if cfg is None:
        logger.info("WAHA not configured — skipping new-signup alert for slug=%s", institute_slug)
        return

    url, api_key, session, numbers = cfg

    dashboard_url = (
        f"https://{institute_slug}.{base_domain}"
        if base_domain
        else f"https://{institute_slug}.zensbot.site"
    )
    phone_display = admin_phone or "—"

    text = (
        "🎉 New Zenslearn signup!\n\n"
        f"🔹 Institute: {institute_name}\n"
        f"👤 Admin: {admin_name}\n"
        f"📧 Email: {admin_email}\n"
        f"📱 Phone: {phone_display}\n"
        f"📊 Plan: {plan_tier}\n"
        f"📅 Time: {_format_signup_time()}\n\n"
        f"🔗 {dashboard_url}"
    )

    sent = 0
    for number in numbers:
        chat_id = f"{number}@c.us"
        if _send_text(url, api_key, session, chat_id, text):
            sent += 1

    logger.info(
        "WAHA new-signup alert sent=%d/%d institute=%s slug=%s",
        sent, len(numbers), institute_name, institute_slug,
    )

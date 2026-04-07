"""Cloudflare Turnstile CAPTCHA verification."""

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str, remote_ip: str | None = None) -> bool:
    """Verify a Cloudflare Turnstile token. Returns True if valid.

    Skips verification (returns True) when CF_TURNSTILE_SECRET_KEY is not
    configured, allowing dev/test environments to bypass CAPTCHA.
    """
    settings = get_settings()
    if not settings.CF_TURNSTILE_SECRET_KEY:
        return True

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                _VERIFY_URL,
                data={
                    "secret": settings.CF_TURNSTILE_SECRET_KEY,
                    "response": token,
                    "remoteip": remote_ip or "",
                },
            )
            result = resp.json()
            return result.get("success", False)
    except Exception:
        logger.exception("Turnstile verification request failed")
        return False

"""Redis-backed handover for SA impersonation tokens.

Problem: if the impersonation JWT is put directly in the cross-subdomain
redirect URL, it leaks into browser history, Referer headers, and CDN
access logs — even though the callback page uses history.replaceState
to strip the URL after load.

Fix: two-step handover.
  1. SA impersonate endpoint stores the JWT in Redis keyed by a random
     UUID (the "handover id") with a 60-second TTL and returns ONLY
     the handover id + institute slug.
  2. Frontend navigates to the target subdomain's callback page with
     ``?hid=<handover_id>`` in the URL. The handover id alone grants
     nothing — an attacker with the URL still needs to redeem it
     before the TTL expires AND within one request (redeem deletes
     the entry).
  3. Callback page POSTs the handover id to /auth/impersonation-handover,
     which reads + deletes the key and returns the JWT in the response
     body. Token never traverses a URL.

Fail-open behavior: if Redis is unavailable, issue() returns None and
the router translates that into an HTTP 503. We do NOT fall back to
URL-embedded tokens — that would silently defeat the security fix.
"""
from __future__ import annotations

import logging
import secrets
from typing import Optional

from app.core.redis import get_redis


logger = logging.getLogger("ict_lms.impersonation")

_PREFIX = "imp:handover:"
_TTL_SECONDS = 60


async def issue(token: str) -> Optional[str]:
    """Store the token and return a single-use handover id.

    Returns None when Redis is unavailable. Caller should treat None
    as a 503: impersonation cannot be safely handed over without
    Redis-backed single-use storage.
    """
    r = get_redis()
    if r is None:
        logger.error("impersonation handover failed: Redis unavailable")
        return None
    handover_id = secrets.token_urlsafe(24)
    key = _PREFIX + handover_id
    try:
        # NX ensures we never overwrite; EX is the TTL.
        await r.set(key, token, ex=_TTL_SECONDS, nx=True)
        return handover_id
    except Exception as e:
        logger.error("impersonation handover store failed: %s", e)
        return None


async def redeem(handover_id: str) -> Optional[str]:
    """Fetch + delete the token keyed by handover_id.

    Returns None if the key is missing, expired, or already redeemed.
    This is the single-use invariant — even if an attacker intercepts
    the URL with the handover id, they must beat the legitimate
    callback to it (and then the legitimate flow fails, which is
    detectable in audit logs as a failed impersonation hand-off).
    """
    r = get_redis()
    if r is None:
        logger.error("impersonation redeem failed: Redis unavailable")
        return None
    key = _PREFIX + handover_id
    try:
        # GETDEL is atomic (Redis 6.2+). Falls back to pipelined
        # GET + DEL for older Redis.
        try:
            token = await r.getdel(key)
        except AttributeError:
            pipe = r.pipeline()
            pipe.get(key)
            pipe.delete(key)
            token, _ = await pipe.execute()
        if token is None:
            return None
        if isinstance(token, bytes):
            token = token.decode("utf-8")
        return token
    except Exception as e:
        logger.error("impersonation redeem failed: %s", e)
        return None

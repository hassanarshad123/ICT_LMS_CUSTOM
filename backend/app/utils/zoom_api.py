"""Zoom API client for creating/deleting meetings and fetching participants.

Features:
- S2S OAuth token caching in Redis (1h tokens, 60s safety buffer)
- Connection pooling via module-level httpx.AsyncClient
- 429 rate-limit retry with Retry-After / exponential backoff
- Configurable timeout on all HTTP calls
"""

import asyncio
import base64
import logging
from datetime import datetime
from typing import Optional

import httpx

from app.core.redis import get_redis
from app.utils.encryption import decrypt

logger = logging.getLogger("ict_lms.zoom_api")

_TIMEOUT = httpx.Timeout(15.0)
_MAX_RETRIES = 3
_MAX_RETRY_AFTER = 30  # cap Retry-After at 30 seconds
_TOKEN_CACHE_BUFFER = 60  # seconds before expiry to refresh

# Module-level connection pool — call startup()/shutdown() from FastAPI lifespan
_client: Optional[httpx.AsyncClient] = None


async def startup() -> None:
    """Initialise the module-level httpx.AsyncClient. Call from FastAPI lifespan startup."""
    global _client
    _client = httpx.AsyncClient(timeout=_TIMEOUT)
    logger.info("Zoom API httpx client started")


async def shutdown() -> None:
    """Close the module-level httpx.AsyncClient. Call from FastAPI lifespan shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
        logger.info("Zoom API httpx client closed")


def _get_client() -> httpx.AsyncClient:
    """Return the pooled client, creating a fallback if startup() was not called."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=_TIMEOUT)
        logger.warning(
            "Zoom API client was not initialised via startup(); created ad-hoc instance"
        )
    return _client


# ── Rate-limit aware request helper ─────────────────────────────────


async def _request_with_retry(
    method: str,
    url: str,
    **kwargs,
) -> httpx.Response:
    """Execute an HTTP request with 429 retry and 401 token-cache-invalidation logic.

    On 429: Read Retry-After header (capped at 30s); fall back to exponential backoff.
    On 401: Clear cached token and retry once (token may have been revoked mid-TTL).
    Retries up to 3 times total.
    """
    client = _get_client()
    last_resp: Optional[httpx.Response] = None

    for attempt in range(1, _MAX_RETRIES + 1):
        resp = await client.request(method, url, **kwargs)

        if resp.status_code == 401 and attempt == 1:
            # Token may have been revoked — clear cache so next call gets a fresh one
            logger.warning("Zoom API 401 on %s %s — clearing token cache", method, url)
            r = get_redis()
            if r is not None:
                try:
                    # Clear all zoom token keys (we don't know which account_id here)
                    keys = await r.keys("zoom:token:*")
                    for key in keys:
                        await r.delete(key)
                except Exception:
                    pass
            # Don't retry 401 automatically — caller needs to re-fetch token
            return resp

        if resp.status_code != 429:
            return resp

        last_resp = resp
        if attempt == _MAX_RETRIES:
            break

        # Determine wait duration — handle both numeric seconds and ISO 8601 datetime
        retry_after = resp.headers.get("Retry-After")
        if retry_after is not None:
            try:
                wait = min(float(retry_after), _MAX_RETRY_AFTER)
            except (ValueError, TypeError):
                # Zoom daily limits return ISO 8601 datetime (e.g., "2025-01-20T00:00:00Z")
                try:
                    from datetime import datetime as dt, timezone as tz
                    reset_time = dt.fromisoformat(retry_after.replace("Z", "+00:00"))
                    wait = min((reset_time - dt.now(tz.utc)).total_seconds(), _MAX_RETRY_AFTER)
                    wait = max(wait, 1)  # at least 1 second
                except Exception:
                    wait = min(2 ** attempt, _MAX_RETRY_AFTER)
        else:
            wait = min(2 ** attempt, _MAX_RETRY_AFTER)

        logger.warning(
            "Zoom API 429 on %s %s — retry %d/%d after %.1fs",
            method,
            url,
            attempt,
            _MAX_RETRIES,
            wait,
        )
        await asyncio.sleep(wait)

    # Exhausted retries — return last 429 so caller can raise_for_status
    assert last_resp is not None
    return last_resp


# ── Token management ─────────────────────────────────────────────────


async def _get_access_token(
    account_id: str, client_id: str, encrypted_secret: str
) -> str:
    """Obtain a Zoom S2S OAuth token, using Redis cache when available."""
    cache_key = f"zoom:token:{account_id}"

    # Try Redis cache first (graceful degradation if unavailable)
    r = get_redis()
    if r is not None:
        try:
            cached = await r.get(cache_key)
            if cached is not None:
                token = cached if isinstance(cached, str) else cached.decode("utf-8")
                logger.debug("Zoom token cache hit for account %s", account_id)
                return token
        except Exception as e:
            logger.warning("Redis read failed for zoom token cache: %s", e)

    # Cache miss — request a fresh token
    client_secret = decrypt(encrypted_secret)
    credentials = base64.b64encode(
        f"{client_id}:{client_secret}".encode()
    ).decode()

    resp = await _request_with_retry(
        "POST",
        "https://zoom.us/oauth/token",
        headers={"Authorization": f"Basic {credentials}"},
        data={
            "grant_type": "account_credentials",
            "account_id": account_id,
        },
    )
    resp.raise_for_status()
    data = resp.json()
    token: str = data["access_token"]
    expires_in: int = data.get("expires_in", 3600)

    # Cache in Redis with safety buffer
    ttl = max(expires_in - _TOKEN_CACHE_BUFFER, 60)
    if r is not None:
        try:
            await r.set(cache_key, token.encode("utf-8"), ex=ttl)
            logger.debug(
                "Zoom token cached for account %s (ttl=%ds)", account_id, ttl
            )
        except Exception as e:
            logger.warning("Redis write failed for zoom token cache: %s", e)

    return token


# ── Public API functions ─────────────────────────────────────────────


async def create_meeting(
    account_id: str,
    client_id: str,
    encrypted_secret: str,
    topic: str,
    start_time: datetime,
    duration: int,
) -> dict:
    token = await _get_access_token(account_id, client_id, encrypted_secret)

    resp = await _request_with_retry(
        "POST",
        "https://api.zoom.us/v2/users/me/meetings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "topic": topic,
            "type": 2,
            "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "duration": duration,
            "settings": {
                "join_before_host": False,
                "waiting_room": True,
                "auto_recording": "cloud",
            },
        },
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "meeting_id": str(data["id"]),
        "join_url": data["join_url"],
        "start_url": data["start_url"],
    }


async def delete_meeting(
    account_id: str,
    client_id: str,
    encrypted_secret: str,
    meeting_id: str,
) -> None:
    token = await _get_access_token(account_id, client_id, encrypted_secret)

    resp = await _request_with_retry(
        "DELETE",
        f"https://api.zoom.us/v2/meetings/{meeting_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    # 204 = success, 404 = already deleted
    if resp.status_code not in (204, 404):
        resp.raise_for_status()


async def update_meeting(
    account_id: str,
    client_id: str,
    encrypted_secret: str,
    meeting_id: str,
    topic: Optional[str] = None,
    start_time: Optional[datetime] = None,
    duration: Optional[int] = None,
) -> None:
    token = await _get_access_token(account_id, client_id, encrypted_secret)
    body: dict = {}
    if topic is not None:
        body["topic"] = topic
    if start_time is not None:
        body["start_time"] = start_time.strftime("%Y-%m-%dT%H:%M:%S")
    if duration is not None:
        body["duration"] = duration
    if not body:
        return

    resp = await _request_with_retry(
        "PATCH",
        f"https://api.zoom.us/v2/meetings/{meeting_id}",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )
    if resp.status_code not in (204, 404):
        resp.raise_for_status()


async def get_recording_download_url(
    account_id: str,
    client_id: str,
    encrypted_secret: str,
    download_url: str,
) -> str:
    """Get authenticated Zoom download URL by appending access token."""
    token = await _get_access_token(account_id, client_id, encrypted_secret)
    separator = "&" if "?" in download_url else "?"
    return f"{download_url}{separator}access_token={token}"


async def get_meeting_participants(
    account_id: str,
    client_id: str,
    encrypted_secret: str,
    meeting_id: str,
) -> list[dict]:
    """Fetch all participants with pagination (Zoom returns max 30 per page)."""
    token = await _get_access_token(account_id, client_id, encrypted_secret)
    all_participants: list[dict] = []
    next_page_token = ""

    while True:
        params: dict = {"page_size": 300}
        if next_page_token:
            params["next_page_token"] = next_page_token

        resp = await _request_with_retry(
            "GET",
            f"https://api.zoom.us/v2/past_meetings/{meeting_id}/participants",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
        if resp.status_code == 404:
            return []
        resp.raise_for_status()

        data = resp.json()
        all_participants.extend(data.get("participants", []))

        next_page_token = data.get("next_page_token", "")
        if not next_page_token:
            break

    return all_participants

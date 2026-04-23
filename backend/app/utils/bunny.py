"""Bunny.net Stream video integration — TUS direct upload + embed tokens."""
import hashlib
import time
from typing import Optional

import httpx

from app.config import get_settings

settings = get_settings()

# Bunny encoding status codes → our status strings
_BUNNY_STATUS_MAP = {
    0: "processing",   # queued
    1: "processing",   # processing
    2: "processing",   # encoding
    3: "ready",        # finished
    4: "ready",        # resolution_finished
    5: "failed",       # failed
    6: "failed",       # fetch_failed (source URL expired or unreachable)
}


async def create_video_entry(title: str) -> dict:
    """Create a Bunny Stream video entry. Returns {"video_id": str, "library_id": str}."""
    library_id = settings.BUNNY_LIBRARY_ID
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://video.bunnycdn.com/library/{library_id}/videos",
            headers={"AccessKey": settings.BUNNY_API_KEY},
            json={"title": title},
        )
        resp.raise_for_status()
        video_id = resp.json()["guid"]
        return {"video_id": video_id, "library_id": library_id}


def generate_tus_auth(video_id: str, expires_in: int = 7200) -> dict:
    """Generate TUS direct-upload authorization for frontend."""
    library_id = settings.BUNNY_LIBRARY_ID
    expiry = int(time.time()) + expires_in
    # TUS auth formula: SHA256(library_id + api_key + expiry + video_id)
    sig_string = f"{library_id}{settings.BUNNY_API_KEY}{expiry}{video_id}"
    signature = hashlib.sha256(sig_string.encode()).hexdigest()
    return {
        "tus_endpoint": f"https://video.bunnycdn.com/tusupload",
        "auth_signature": signature,
        "auth_expire": expiry,
        "video_id": video_id,
        "library_id": library_id,
    }


def generate_embed_token(video_id: str, expires_in: int = 18000) -> tuple[str, int]:
    """Generate a signed Bunny Stream embed URL. Returns (embed_url, expires_at).

    Default expiry is 5 hours (18000s). Combined with referer restriction
    on the Bunny library, this covers long recordings at slow playback
    speeds while keeping the security window tight.
    """
    library_id = settings.BUNNY_LIBRARY_ID
    token_key = settings.BUNNY_TOKEN_KEY
    expires_at = int(time.time()) + expires_in
    # Bunny Stream embed token: SHA256(token_key + video_id + expires_at)
    token_string = f"{token_key}{video_id}{expires_at}"
    token = hashlib.sha256(token_string.encode()).hexdigest()
    embed_url = (
        f"https://iframe.mediadelivery.net/embed/{library_id}/{video_id}"
        f"?token={token}&expires={expires_at}&autoplay=false&responsive=true"
    )
    return embed_url, expires_at


async def get_video_status(video_id: str) -> tuple[str, int]:
    """Poll Bunny API for encoding status and duration.

    Returns (status_string, duration_seconds).
    """
    library_id = settings.BUNNY_LIBRARY_ID
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://video.bunnycdn.com/library/{library_id}/videos/{video_id}",
            headers={"AccessKey": settings.BUNNY_API_KEY},
        )
        resp.raise_for_status()
        data = resp.json()
        bunny_status = data.get("status", 0)
        duration = int(data.get("length", 0))
        return _BUNNY_STATUS_MAP.get(bunny_status, "processing"), duration


async def get_video_details(video_id: str) -> dict:
    """Fetch full video metadata including storage size.

    Returns {"status": str, "duration": int, "storage_size": int}.
    """
    library_id = settings.BUNNY_LIBRARY_ID
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://video.bunnycdn.com/library/{library_id}/videos/{video_id}",
            headers={"AccessKey": settings.BUNNY_API_KEY},
        )
        resp.raise_for_status()
        data = resp.json()
        bunny_status = data.get("status", 0)
        return {
            "status": _BUNNY_STATUS_MAP.get(bunny_status, "processing"),
            "duration": int(data.get("length", 0)),
            "storage_size": int(data.get("storageSize", 0)),
        }


async def create_video_from_url(title: str, source_url: str) -> dict:
    """Create a Bunny Stream video and tell Bunny to fetch from a remote URL.
    Returns {"video_id": str, "library_id": str}."""
    entry = await create_video_entry(title)
    video_id = entry["video_id"]
    library_id = entry["library_id"]
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://video.bunnycdn.com/library/{library_id}/videos/{video_id}/fetch",
            headers={"AccessKey": settings.BUNNY_API_KEY},
            json={"url": source_url},
        )
        resp.raise_for_status()
    return {"video_id": video_id, "library_id": library_id}


async def reencode_video(video_id: str) -> None:
    """Request Bunny to re-encode a video from already-uploaded source."""
    library_id = settings.BUNNY_LIBRARY_ID
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://video.bunnycdn.com/library/{library_id}/videos/{video_id}/reencode",
            headers={"AccessKey": settings.BUNNY_API_KEY},
        )
        resp.raise_for_status()


def get_thumbnail_url(video_id: str) -> str | None:
    """Return a Bunny CDN thumbnail URL for a video, or None if CDN not configured."""
    cdn = settings.BUNNY_CDN_HOSTNAME
    if not cdn:
        return None
    return f"https://{cdn}/{video_id}/thumbnail.jpg"


async def delete_video(video_id: str) -> None:
    """Delete a video from Bunny Stream."""
    library_id = settings.BUNNY_LIBRARY_ID
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"https://video.bunnycdn.com/library/{library_id}/videos/{video_id}",
            headers={"AccessKey": settings.BUNNY_API_KEY},
        )
        if resp.status_code not in (200, 404):
            resp.raise_for_status()

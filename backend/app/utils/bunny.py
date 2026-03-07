"""Bunny.net video CDN integration."""
import hashlib
import time
from typing import Optional

import httpx

from app.config import get_settings

settings = get_settings()


async def upload_video(
    title: str,
    file_data: bytes,
) -> dict:
    """Upload a video to Bunny.net Stream. Returns {video_id, library_id}."""
    library_id = settings.BUNNY_LIBRARY_ID

    async with httpx.AsyncClient(timeout=300) as client:
        # Create video entry
        resp = await client.post(
            f"https://video.bunnycdn.com/library/{library_id}/videos",
            headers={"AccessKey": settings.BUNNY_API_KEY},
            json={"title": title},
        )
        resp.raise_for_status()
        video_id = resp.json()["guid"]

        # Upload video data
        resp = await client.put(
            f"https://video.bunnycdn.com/library/{library_id}/videos/{video_id}",
            headers={"AccessKey": settings.BUNNY_API_KEY},
            content=file_data,
        )
        resp.raise_for_status()

        return {"video_id": video_id, "library_id": library_id}


def generate_signed_url(
    video_id: str,
    expires_in: int = 3600,
) -> tuple[str, int]:
    """Generate a signed URL for Bunny.net video playback. Returns (url, expires_at_ts)."""
    hostname = settings.BUNNY_CDN_HOSTNAME
    token_key = settings.BUNNY_TOKEN_KEY
    expires_at = int(time.time()) + expires_in
    path = f"/{video_id}/playlist.m3u8"

    # Generate token: SHA256(token_key + path + expires_at)
    token_string = f"{token_key}{path}{expires_at}"
    token = hashlib.sha256(token_string.encode()).hexdigest()

    url = f"https://{hostname}{path}?token={token}&expires={expires_at}"
    return url, expires_at


async def delete_video(video_id: str) -> None:
    library_id = settings.BUNNY_LIBRARY_ID
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"https://video.bunnycdn.com/library/{library_id}/videos/{video_id}",
            headers={"AccessKey": settings.BUNNY_API_KEY},
        )
        if resp.status_code not in (200, 404):
            resp.raise_for_status()

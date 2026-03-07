"""Zoom API client for creating/deleting meetings and fetching participants."""
import base64
from datetime import datetime
from typing import Optional

import httpx

from app.utils.encryption import decrypt


async def _get_access_token(account_id: str, client_id: str, encrypted_secret: str) -> str:
    client_secret = decrypt(encrypted_secret)
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://zoom.us/oauth/token",
            headers={"Authorization": f"Basic {credentials}"},
            data={
                "grant_type": "account_credentials",
                "account_id": account_id,
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def create_meeting(
    account_id: str,
    client_id: str,
    encrypted_secret: str,
    topic: str,
    start_time: datetime,
    duration: int,
) -> dict:
    token = await _get_access_token(account_id, client_id, encrypted_secret)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
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

    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"https://api.zoom.us/v2/meetings/{meeting_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        # 204 = success, 404 = already deleted
        if resp.status_code not in (204, 404):
            resp.raise_for_status()


async def get_meeting_participants(
    account_id: str,
    client_id: str,
    encrypted_secret: str,
    meeting_id: str,
) -> list[dict]:
    token = await _get_access_token(account_id, client_id, encrypted_secret)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.zoom.us/v2/past_meetings/{meeting_id}/participants",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return resp.json().get("participants", [])

import logging
from datetime import datetime, timezone

import httpx

from app.config import get_settings

logger = logging.getLogger("ict_lms.discord")


async def send_discord_alert(
    title: str,
    description: str,
    color: int = 0xFF0000,
    fields: list[dict] | None = None,
):
    """Send an embed message to a Discord webhook. Silently fails if not configured."""
    settings = get_settings()
    webhook_url = settings.DISCORD_WEBHOOK_URL
    if not webhook_url:
        return

    embed: dict = {
        "title": title[:256],
        "description": description[:2048],
        "color": color,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if fields:
        embed["fields"] = fields[:25]

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                webhook_url,
                json={"embeds": [embed]},
                timeout=5,
            )
    except Exception as e:
        logger.warning("Discord alert failed: %s", e)

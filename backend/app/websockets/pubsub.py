"""Redis Pub/Sub bridge for cross-worker WebSocket broadcasts.

When the backend publishes a notification event, it goes through Redis Pub/Sub
so ALL uvicorn workers (not just the one handling the request) can deliver it
to their locally connected WebSocket clients.
"""

import asyncio
import json
import logging

from app.core.redis import get_redis

logger = logging.getLogger("ict_lms.pubsub")

PUBSUB_CHANNEL = "lms:ws:broadcast"


async def publish_ws_event(channel: str, message: dict) -> None:
    """Publish a WebSocket event via Redis Pub/Sub for cross-worker delivery."""
    r = get_redis()
    if r is None:
        # No Redis — fall back to direct local broadcast
        from app.websockets.manager import manager
        await manager.broadcast(channel, message)
        return

    try:
        payload = json.dumps({"channel": channel, "message": message})
        await r.publish(PUBSUB_CHANNEL, payload)
    except Exception as e:
        logger.warning("Pub/Sub publish failed, falling back to local broadcast: %s", e)
        from app.websockets.manager import manager
        await manager.broadcast(channel, message)


async def start_pubsub_listener() -> asyncio.Task:
    """Start a background task that listens to Redis Pub/Sub and forwards to local WebSocket manager.

    Automatically reconnects with exponential backoff if Redis connection drops.
    Returns the asyncio.Task so it can be cancelled on shutdown.
    """
    r = get_redis()
    if r is None:
        logger.info("Redis unavailable — Pub/Sub listener not started")
        return None

    async def _listener():
        from app.websockets.manager import manager

        backoff = 1  # seconds
        max_backoff = 30

        while True:
            try:
                redis_conn = get_redis()
                if redis_conn is None:
                    logger.warning("Redis unavailable, retrying Pub/Sub in %ds", backoff)
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, max_backoff)
                    continue

                pubsub = redis_conn.pubsub()
                await pubsub.subscribe(PUBSUB_CHANNEL)
                logger.info("Pub/Sub listener connected on channel: %s", PUBSUB_CHANNEL)
                backoff = 1  # Reset backoff on successful connection

                async for raw_message in pubsub.listen():
                    if raw_message["type"] != "message":
                        continue
                    try:
                        data = json.loads(raw_message["data"])
                        channel = data["channel"]
                        message = data["message"]
                        await manager.broadcast(channel, message)
                    except Exception as e:
                        logger.warning("Pub/Sub message handling error: %s", e)

            except asyncio.CancelledError:
                logger.info("Pub/Sub listener stopped")
                return
            except Exception as e:
                logger.warning("Pub/Sub listener disconnected: %s — reconnecting in %ds", e, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, max_backoff)

    task = asyncio.create_task(_listener())
    return task

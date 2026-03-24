"""Async Redis connection pool for caching.

Fail-open design: if Redis is unavailable, all operations become no-ops.
The app continues to function identically, just without caching.
"""

import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger("ict_lms.cache")

_redis: Optional["redis.asyncio.Redis"] = None


async def init_redis() -> Optional["redis.asyncio.Redis"]:
    """Initialize the async Redis connection pool. Call during FastAPI lifespan startup."""
    global _redis
    settings = get_settings()

    if not settings.CACHE_ENABLED:
        logger.info("Caching is disabled (CACHE_ENABLED=false)")
        return None

    try:
        import redis.asyncio as aioredis

        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=False,  # We handle serialization ourselves via orjson
            socket_connect_timeout=3,
            socket_timeout=2,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        # Verify connectivity
        await _redis.ping()
        logger.info("Redis connected: %s", settings.REDIS_URL)
        return _redis
    except Exception as e:
        logger.warning("Redis unavailable, caching disabled: %s", e)
        _redis = None
        return None


async def close_redis() -> None:
    """Close the Redis connection pool. Call during FastAPI lifespan shutdown."""
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
        except Exception:
            pass
        _redis = None
        logger.info("Redis connection closed")


def get_redis() -> Optional["redis.asyncio.Redis"]:
    """Get the current Redis connection. Returns None if unavailable."""
    return _redis

"""Transparent async cache service backed by Redis.

Fail-open: every operation silently degrades if Redis is unavailable.
All keys are namespaced per institute for multi-tenant isolation.
"""

import logging
from typing import Any, Callable, Awaitable, Optional

import orjson

from app.core.redis import get_redis

logger = logging.getLogger("ict_lms.cache")


class CacheService:
    """Async cache with multi-tenant key isolation and fail-open semantics."""

    # ── Core operations ─────────────────────────────────────────────

    async def get(self, key: str) -> Any:
        """Get a value from cache. Returns None on miss or error."""
        r = get_redis()
        if r is None:
            return None
        try:
            raw = await r.get(key)
            if raw is None:
                return None
            return orjson.loads(raw)
        except Exception as e:
            logger.debug("cache.get error key=%s: %s", key, e)
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """Set a value in cache with TTL (seconds). No-op on error."""
        r = get_redis()
        if r is None:
            return
        try:
            raw = orjson.dumps(value, option=orjson.OPT_NON_STR_KEYS)
            await r.set(key, raw, ex=ttl)
        except Exception as e:
            logger.debug("cache.set error key=%s: %s", key, e)

    async def delete(self, key: str) -> None:
        """Delete a key from cache. No-op on error."""
        r = get_redis()
        if r is None:
            return
        try:
            await r.delete(key)
        except Exception as e:
            logger.debug("cache.delete error key=%s: %s", key, e)

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a glob pattern (uses SCAN, not KEYS). Returns count deleted."""
        r = get_redis()
        if r is None:
            return 0
        try:
            count = 0
            async for key in r.scan_iter(match=pattern, count=100):
                await r.delete(key)
                count += 1
            if count:
                logger.debug("cache.delete_pattern pattern=%s deleted=%d", pattern, count)
            return count
        except Exception as e:
            logger.debug("cache.delete_pattern error pattern=%s: %s", pattern, e)
            return 0

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Awaitable[Any]],
        ttl: int = 300,
    ) -> Any:
        """Check cache; on miss, call factory, cache result, return it.

        This is the primary pattern for lazy cache fill. The factory is an
        async callable that produces the value (typically a DB query).
        """
        cached = await self.get(key)
        if cached is not None:
            return cached

        # Cache miss — call the factory
        value = await factory()
        if value is not None:
            await self.set(key, value, ttl)
        return value

    # ── Helpers ──────────────────────────────────────────────────────

    @staticmethod
    def user_key(institute_id: Optional[str], user_id: str) -> str:
        """Cache key for authenticated user data."""
        return f"lms:{institute_id or 'global'}:user:{user_id}"

    @staticmethod
    def notif_count_key(institute_id: Optional[str], user_id: str) -> str:
        """Cache key for unread notification count."""
        return f"lms:{institute_id or 'global'}:notif_count:{user_id}"

    @staticmethod
    def dashboard_key(institute_id: str) -> str:
        """Cache key for admin dashboard aggregations."""
        return f"lms:{institute_id}:dashboard"

    @staticmethod
    def insights_key(institute_id: str) -> str:
        """Cache key for admin insights aggregations."""
        return f"lms:{institute_id}:insights"

    @staticmethod
    def branding_key(institute_id: Optional[str]) -> str:
        """Cache key for institute branding settings."""
        return f"lms:{institute_id or 'global'}:branding"

    @staticmethod
    def slug_key(slug: str) -> str:
        """Cache key for slug-to-institute-ID resolution."""
        return f"lms:global:institute:{slug}"


    async def invalidate_dashboard(self, institute_id: str) -> None:
        """Invalidate dashboard + insights caches for an institute."""
        await self.delete(self.dashboard_key(institute_id))
        await self.delete(self.insights_key(institute_id))


# Singleton instance — import this everywhere
cache = CacheService()

"""Redis-based distributed lock for scheduler job deduplication.

Prevents duplicate job execution when multiple containers are running
during blue-green deployments.
"""

import os
import functools
import logging

from app.core.redis import get_redis

logger = logging.getLogger("ict_lms.scheduler")

LOCK_TTL = 300  # 5 minutes — longer than any job should take


def scheduler_lock(job_name: str):
    """Decorator: only one container can run this job at a time."""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            r = get_redis()
            if r is None:
                return await func(*args, **kwargs)

            lock_key = f"lms:job_lock:{job_name}"
            slot = os.getenv("DEPLOY_SLOT", "unknown")

            acquired = await r.set(lock_key, slot, nx=True, ex=LOCK_TTL)
            if not acquired:
                holder = await r.get(lock_key)
                if holder and holder.decode() != slot:
                    logger.debug("Job %s skipped — held by %s", job_name, holder.decode())
                    return
            try:
                return await func(*args, **kwargs)
            finally:
                await r.delete(lock_key)

        return wrapper
    return decorator

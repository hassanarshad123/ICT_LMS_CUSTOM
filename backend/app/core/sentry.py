"""Centralized Sentry error monitoring configuration.

All Sentry setup is consolidated here: init, before_send filtering,
PII scrubbing, job wrapper, and safe capture helpers.
"""

import functools
import logging
from typing import Any

logger = logging.getLogger("ict_lms.sentry")

# Sensitive keys to redact from request bodies and local variables
_SENSITIVE_KEYS = {
    "password", "secret", "token", "api_key", "apikey", "credit_card", "dsn",
    "encryption", "jwt", "bunny", "zoom", "resend", "webhook", "database",
    "redis", "key", "credential", "auth",
}

# Sensitive headers to strip from Sentry events
_SENSITIVE_HEADERS = {"authorization", "cookie", "x-api-key"}

# Paths to drop from Sentry (health checks / monitoring noise)
_DROP_PATHS = {"/api/health", "/api/v1/monitoring/health"}


def _scrub_dict(d: dict) -> dict:
    """Redact values whose keys contain sensitive substrings. Recurses into nested dicts."""
    if not isinstance(d, dict):
        return d
    return {
        k: "[Filtered]" if any(s in k.lower() for s in _SENSITIVE_KEYS)
           else (_scrub_dict(v) if isinstance(v, dict) else v)
        for k, v in d.items()
    }


def _scrub_headers(headers: dict | list) -> dict | list:
    """Remove sensitive headers from Sentry event request."""
    if isinstance(headers, dict):
        return {k: "[Filtered]" if k.lower() in _SENSITIVE_HEADERS else v for k, v in headers.items()}
    if isinstance(headers, list):
        return [[k, "[Filtered]" if k.lower() in _SENSITIVE_HEADERS else v] for k, v in headers]
    return headers


def before_send(event: dict, hint: dict) -> dict | None:
    """Filter noise and scrub PII before sending events to Sentry."""

    # ── Drop health check events ──
    request = event.get("request", {})
    url = request.get("url", "")
    for path in _DROP_PATHS:
        if path in url:
            return None

    # ── Drop expected exceptions by type ──
    if "exc_info" in hint:
        exc_type = hint["exc_info"][0]
        exc_value = hint["exc_info"][1] if len(hint["exc_info"]) > 1 else None
        type_name = exc_type.__name__ if exc_type else ""

        # Drop WebSocketDisconnect — normal client behavior
        if type_name == "WebSocketDisconnect":
            return None

        # Drop RateLimitExceeded — operational, not a bug
        if type_name == "RateLimitExceeded":
            return None

        # Drop HTTPException 404, 422, 429 — client errors, not server bugs
        if type_name == "HTTPException" and exc_value is not None:
            status_code = getattr(exc_value, "status_code", None)
            if status_code in (404, 422, 429):
                return None

    # ── Scrub sensitive headers ──
    if "headers" in request:
        request["headers"] = _scrub_headers(request["headers"])

    # ── Scrub request body ──
    if "data" in request and isinstance(request["data"], dict):
        request["data"] = _scrub_dict(request["data"])

    # ── Scrub local variables in stack frames ──
    for exc_entry in event.get("exception", {}).get("values", []):
        for frame in exc_entry.get("stacktrace", {}).get("frames", []):
            if "vars" in frame and isinstance(frame["vars"], dict):
                frame["vars"] = _scrub_dict(frame["vars"])

    return event


def before_send_transaction(event: dict, hint: dict) -> dict | None:
    """Drop noisy performance transactions (health checks)."""
    transaction = event.get("transaction", "")
    for path in _DROP_PATHS:
        if path in transaction:
            return None
    return event


def init_sentry(settings: Any) -> bool:
    """Initialize Sentry SDK. Returns True if initialized, False if skipped."""
    if not settings.SENTRY_DSN:
        logger.info("Sentry disabled (SENTRY_DSN not set)")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.httpx import HttpxIntegration

        git_sha = getattr(settings, "GIT_SHA", "unknown")
        deploy_slot = getattr(settings, "DEPLOY_SLOT", "standalone")

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            release=f"ict-lms@{git_sha}",
            send_default_pii=True,
            traces_sample_rate=1.0,
            profiles_sample_rate=0.1,
            enable_db_query_source=False,
            include_local_variables=True,
            max_request_body_size="medium",
            before_send=before_send,
            before_send_transaction=before_send_transaction,
            integrations=[
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(transaction_style="endpoint"),
                LoggingIntegration(
                    level=logging.WARNING,      # breadcrumbs for WARNING+
                    event_level=logging.ERROR,   # Sentry events for ERROR+
                ),
                HttpxIntegration(),
            ],
        )
        # Tag every event with deploy slot for blue-green visibility
        sentry_sdk.set_tag("deploy_slot", deploy_slot)
        sentry_sdk.set_tag("git_sha", git_sha)

        logger.info("Sentry initialized (env=%s, release=ict-lms@%s, slot=%s)", settings.APP_ENV, git_sha, deploy_slot)
        return True
    except Exception as e:
        logger.warning("Sentry init failed: %s", e)
        return False


def capture_exception_safe(exc: Exception) -> None:
    """Capture an exception to Sentry. Best-effort, never raises."""
    try:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
    except Exception:
        pass


_SCHEDULER_OWNER_KEY = "lms:scheduler:owner"
_DEFAULT_JOB_LOCK_TTL_SECONDS = 300  # 5 minutes max job runtime before lock auto-expires


async def _is_scheduler_owner() -> bool:
    """Check whether this container is the scheduler owner.

    Returns True (fail-open) if Redis is unavailable or the ownership key is
    unset — we'd rather have potential duplicates than miss jobs entirely.
    The deploy script writes this key at cutover so only the active slot
    runs recurring work.
    """
    try:
        from app.config import get_settings
        from app.core.redis import get_redis

        redis = get_redis()
        if redis is None:
            return True  # Redis not available — fail open

        raw = await redis.get(_SCHEDULER_OWNER_KEY)
        if raw is None:
            return True  # No owner set yet — fail open (first deploy case)

        owner = raw.decode() if isinstance(raw, (bytes, bytearray)) else str(raw)
        my_slot = get_settings().DEPLOY_SLOT
        return owner == my_slot
    except Exception:
        return True  # Any unexpected error — fail open


async def _acquire_job_lock(job_name: str, ttl_seconds: int):
    """Try to acquire an exclusive per-fire lock for a scheduler job.

    Returns the Redis client and lock key on success, or (None, None) if
    another process already holds the lock OR if Redis is unavailable.

    Why: uvicorn runs with ``--workers N``; each worker boots its own
    AsyncIOScheduler on lifespan startup, so every interval fires the job
    once per worker. The lock lets exactly one worker actually execute.

    Fail-open: Redis unreachable → return a sentinel so the job runs.
    (Caller sees non-None redis AND lock_key → "I got the lock, run".)
    """
    try:
        from app.core.redis import get_redis

        redis = get_redis()
        if redis is None:
            return None, None  # Redis unavailable → fail open (run anyway)

        lock_key = f"lms:scheduler:lock:{job_name}"
        # SET NX with TTL — atomic "acquire if not held".
        acquired = await redis.set(lock_key, b"1", nx=True, ex=ttl_seconds)
        if acquired:
            return redis, lock_key
        return None, "held"  # Sentinel: another worker has it, skip
    except Exception:
        logger.debug("Job lock acquisition crashed for %s — failing open", job_name, exc_info=True)
        return None, None  # Redis blew up → fail open (run anyway)


async def _release_job_lock(redis, lock_key) -> None:
    if redis is None or lock_key is None:
        return
    try:
        await redis.delete(lock_key)
    except Exception:
        # Lock will expire on its own via TTL; no action needed.
        logger.debug("Job lock release failed for %s", lock_key, exc_info=True)


def sentry_job_wrapper(job_name: str, lock_ttl_seconds: int = _DEFAULT_JOB_LOCK_TTL_SECONDS):
    """Decorator for APScheduler async jobs — captures exceptions to Sentry
    with job context AND enforces exactly-once execution across two layers:

    1. **Slot ownership** (blue/green dedup): only the slot whose name
       matches ``lms:scheduler:owner`` in Redis runs jobs.
    2. **Worker lock** (multi-worker uvicorn dedup): on each fire, the
       first worker to SET NX ``lms:scheduler:lock:<job_name>`` wins;
       other workers skip.

    Both checks fail-open on Redis unavailability.

    ``lock_ttl_seconds`` bounds how long a crashed worker can hold the lock
    before auto-release. Default 5 minutes is longer than any well-behaved
    recurring job but short enough to recover from a worker crash within
    one or two intervals for most schedules.
    """

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Layer 1 — slot ownership (blue/green dedup).
            if not await _is_scheduler_owner():
                logger.debug("Skipping %s — not scheduler owner", job_name)
                return None

            # Layer 2 — worker lock (multi-worker dedup).
            redis, lock_key = await _acquire_job_lock(job_name, lock_ttl_seconds)
            if lock_key == "held":
                # Another uvicorn worker in this same container already runs it.
                logger.debug("Skipping %s — lock held by sibling worker", job_name)
                return None

            # Heartbeat — upsert a row in system_jobs on every actual run
            # (slot-ownership + lock acquired). Best-effort, never raises.
            import time as _time
            from app.utils.job_heartbeat import _upsert as _hb_upsert
            start = _time.monotonic()
            await _hb_upsert(job_name, status="running", duration_ms=None, error=None)

            def _duration_ms() -> int:
                return int((_time.monotonic() - start) * 1000)

            try:
                import sentry_sdk
            except ImportError:
                # sentry_sdk not installed — run job without instrumentation
                try:
                    result = await func(*args, **kwargs)
                    await _hb_upsert(job_name, status="success", duration_ms=_duration_ms(), error=None)
                    return result
                except Exception as exc:
                    await _hb_upsert(
                        job_name, status="failure",
                        duration_ms=_duration_ms(),
                        error=f"{type(exc).__name__}: {exc}"[:500],
                    )
                    raise
                finally:
                    await _release_job_lock(redis, lock_key)

            with sentry_sdk.new_scope() as scope:
                scope.set_tag("job_name", job_name)
                scope.set_context("scheduler", {
                    "job_name": job_name,
                    "trigger": "interval",
                })
                try:
                    result = await func(*args, **kwargs)
                    await _hb_upsert(job_name, status="success", duration_ms=_duration_ms(), error=None)
                    return result
                except Exception as exc:
                    await _hb_upsert(
                        job_name, status="failure",
                        duration_ms=_duration_ms(),
                        error=f"{type(exc).__name__}: {exc}"[:500],
                    )
                    # Capture inside scope so job tags are attached to the event
                    sentry_sdk.capture_exception(exc)
                    raise
                finally:
                    await _release_job_lock(redis, lock_key)

        return wrapper

    return decorator

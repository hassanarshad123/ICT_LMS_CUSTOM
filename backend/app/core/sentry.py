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


def sentry_job_wrapper(job_name: str):
    """Decorator for APScheduler async jobs — captures exceptions to Sentry with job context."""

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                import sentry_sdk
            except ImportError:
                # sentry_sdk not installed — run job without instrumentation
                return await func(*args, **kwargs)

            with sentry_sdk.new_scope() as scope:
                scope.set_tag("job_name", job_name)
                scope.set_context("scheduler", {
                    "job_name": job_name,
                    "trigger": "interval",
                })
                try:
                    return await func(*args, **kwargs)
                except Exception as exc:
                    # Capture inside scope so job tags are attached to the event
                    sentry_sdk.capture_exception(exc)
                    raise

        return wrapper

    return decorator

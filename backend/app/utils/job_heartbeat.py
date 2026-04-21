"""Heartbeat decorator for scheduler jobs.

Usage:

    from app.utils.job_heartbeat import record_heartbeat

    @sentry_job_wrapper("generate_monthly_invoices")
    @record_heartbeat("generate_monthly_invoices")
    async def generate_monthly_invoices() -> None:
        ...

The decorator upserts a row in ``system_jobs`` on every invocation:
  - on entry: last_status = "running"
  - on success: last_status = "success", last_error = None, duration set
  - on exception: last_status = "failure", last_error = short trace,
    duration set, then re-raises so Sentry still sees it.

Fail-open: if the heartbeat write itself fails (e.g., DB outage), we
log and swallow the heartbeat error so the job body still runs /
propagates as intended. A failed heartbeat must not mask a real
business-logic failure.
"""
from __future__ import annotations

import functools
import logging
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable


logger = logging.getLogger("ict_lms.job_heartbeat")


async def _upsert(
    name: str,
    *,
    status: str,
    duration_ms: int | None,
    error: str | None,
) -> None:
    """Upsert a system_jobs row. Best-effort — never raises."""
    try:
        # Lazy import so unit tests of the decorator don't need a DB.
        from app.database import async_session
        from app.models.system_job import SystemJob
        from sqlmodel import select

        async with async_session() as session:
            r = await session.execute(
                select(SystemJob).where(SystemJob.name == name)
            )
            row = r.scalar_one_or_none()
            now = datetime.now(timezone.utc)
            if row is None:
                row = SystemJob(
                    name=name,
                    last_run_at=now,
                    last_status=status,
                    last_error=error,
                    last_duration_ms=duration_ms,
                    updated_at=now,
                )
                session.add(row)
            else:
                row.last_run_at = now
                row.last_status = status
                row.last_error = error
                row.last_duration_ms = duration_ms
                row.updated_at = now
                session.add(row)
            await session.commit()
    except Exception as e:
        logger.warning("heartbeat upsert failed for %s: %s", name, e)


def record_heartbeat(name: str) -> Callable[..., Any]:
    """Decorator that records start/success/failure in system_jobs."""

    def decorator(
        fn: Callable[..., Awaitable[Any]],
    ) -> Callable[..., Awaitable[Any]]:
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            start = time.monotonic()
            await _upsert(name, status="running", duration_ms=None, error=None)
            try:
                result = await fn(*args, **kwargs)
            except Exception as exc:
                duration_ms = int((time.monotonic() - start) * 1000)
                # Truncate error to match column limit (500 chars).
                err_text = f"{type(exc).__name__}: {exc}"[:500]
                await _upsert(
                    name, status="failure",
                    duration_ms=duration_ms, error=err_text,
                )
                raise
            else:
                duration_ms = int((time.monotonic() - start) * 1000)
                await _upsert(
                    name, status="success",
                    duration_ms=duration_ms, error=None,
                )
                return result

        return wrapper

    return decorator

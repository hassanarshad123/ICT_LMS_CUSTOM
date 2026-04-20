import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlmodel import select, func

from app.models.error_log import ErrorLog
from app.services.monitoring_service import list_errors, resolve_error


async def get_cross_institute_error_stats(session: AsyncSession) -> dict:
    """Aggregate error stats across ALL institutes for SA dashboard."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    # Total 24h
    r = await session.execute(
        select(func.count()).select_from(ErrorLog).where(ErrorLog.created_at >= day_ago)
    )
    total_24h = r.scalar() or 0

    # Unresolved
    r = await session.execute(
        select(func.count()).select_from(ErrorLog).where(ErrorLog.resolved == False)
    )
    unresolved = r.scalar() or 0

    # Error trend by day (last 7 days)
    week_ago = now - timedelta(days=7)
    r = await session.execute(text("""
        SELECT created_at::date AS day,
               COUNT(*) FILTER (WHERE level = 'critical') AS critical,
               COUNT(*) FILTER (WHERE level = 'error') AS error,
               COUNT(*) FILTER (WHERE level = 'warning') AS warning,
               COUNT(*) AS total
        FROM error_logs
        WHERE created_at >= :since
        GROUP BY day
        ORDER BY day
    """), {"since": week_ago})
    error_trend = [
        {
            "date": row[0].isoformat(),
            "critical": row[1] or 0,
            "error": row[2] or 0,
            "warning": row[3] or 0,
            "total": row[4] or 0,
        }
        for row in r.all()
    ]

    # Top erroring institutes (24h)
    r = await session.execute(text("""
        SELECT e.institute_id, i.name, COUNT(*) AS cnt
        FROM error_logs e
        LEFT JOIN institutes i ON i.id = e.institute_id
        WHERE e.created_at >= :since AND e.institute_id IS NOT NULL
        GROUP BY e.institute_id, i.name
        ORDER BY cnt DESC
        LIMIT 10
    """), {"since": day_ago})
    top_institutes = [
        {"institute_id": str(row[0]), "name": row[1] or "Unknown", "count": row[2]}
        for row in r.all()
    ]

    # By source
    r = await session.execute(text("""
        SELECT source, COUNT(*) FROM error_logs
        WHERE created_at >= :since GROUP BY source
    """), {"since": day_ago})
    raw_source = {row[0]: row[1] for row in r.all()}
    by_source = {"backend": 0, "frontend": 0, **raw_source}

    # By level
    r = await session.execute(text("""
        SELECT level, COUNT(*) FROM error_logs
        WHERE created_at >= :since GROUP BY level
    """), {"since": day_ago})
    raw_level = {row[0]: row[1] for row in r.all()}
    by_level = {"critical": 0, "error": 0, "warning": 0, **raw_level}

    return {
        "total_errors_24h": total_24h,
        "unresolved_count": unresolved,
        "error_trend": error_trend,
        "top_error_institutes": top_institutes,
        "errors_by_source": by_source,
        "errors_by_level": by_level,
    }


async def get_sa_errors(
    session: AsyncSession,
    filters: dict,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list, int]:
    """List errors across all institutes with optional institute_id filter."""
    institute_filter = filters.pop("institute_id", None)

    query = select(ErrorLog)
    count_query = select(func.count()).select_from(ErrorLog)

    if institute_filter:
        query = query.where(ErrorLog.institute_id == uuid.UUID(institute_filter))
        count_query = count_query.where(ErrorLog.institute_id == uuid.UUID(institute_filter))

    source = filters.get("source")
    level = filters.get("level")
    resolved = filters.get("resolved")

    if source:
        query = query.where(ErrorLog.source == source)
        count_query = count_query.where(ErrorLog.source == source)
    if level:
        query = query.where(ErrorLog.level == level)
        count_query = count_query.where(ErrorLog.level == level)
    if resolved is not None:
        query = query.where(ErrorLog.resolved == resolved)
        count_query = count_query.where(ErrorLog.resolved == resolved)

    r = await session.execute(count_query)
    total = r.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(ErrorLog.created_at.desc()).offset(offset).limit(per_page)
    r = await session.execute(query)
    errors = list(r.scalars().all())

    return errors, total


async def get_system_health(session: AsyncSession) -> dict:
    """System health: DB, Redis, scheduled jobs, video pipeline, webhooks."""
    # DB health
    db_status = "connected"
    t0 = time.monotonic()
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "unreachable"
    db_latency = round((time.monotonic() - t0) * 1000, 1)

    # Redis health
    redis_status = "disconnected"
    redis_memory = 0.0
    redis_hit_rate = 0.0
    redis_keys = 0
    try:
        from app.core.redis import get_redis
        r = get_redis()
        if r:
            redis_status = "connected"
            info_mem = await r.info("memory")
            info_stats = await r.info("stats")
            redis_memory = round(info_mem.get("used_memory", 0) / (1024 * 1024), 2)
            hits = info_stats.get("keyspace_hits", 0)
            misses = info_stats.get("keyspace_misses", 0)
            redis_hit_rate = round(hits / (hits + misses) * 100, 1) if (hits + misses) > 0 else 0.0
            redis_keys = await r.dbsize()
    except Exception:
        pass

    # Scheduled jobs — static metadata merged with live heartbeat data.
    # system_jobs is upserted by sentry_job_wrapper on every actual run
    # (see app/core/sentry.py + app/utils/job_heartbeat.py). If the
    # heartbeat row is missing, the job has never run successfully
    # since the heartbeat migration landed.
    job_metadata = [
        ("cleanup_expired_sessions", "Deactivate expired sessions", "Hourly"),
        ("retry_failed_recordings", "Retry stuck recordings", "Every 30 min"),
        ("send_zoom_reminders", "Send class reminders", "Every 10 min"),
        ("auto_suspend_expired_institutes", "Suspend expired institutes", "Daily"),
        ("send_trial_expiry_warnings", "Trial expiry warnings", "Daily"),
        ("deactivate_unverified_users", "Deactivate unverified users", "Every 12h"),
        ("process_webhook_deliveries", "Process pending webhooks", "Every 1 min"),
        ("process_frappe_sync_tasks", "Frappe sync tasks", "Every 30s"),
        ("send_integration_weekly_digest", "Integration weekly digest", "Daily"),
        ("cleanup_stale_uploads", "Clean up stale uploads", "Daily"),
        ("sync_stuck_video_statuses", "Sync stuck video statuses", "Every 30 min"),
        ("backfill_video_durations", "Backfill video durations", "Every 6h"),
        ("recalculate_all_usage", "Recalculate usage counters", "Daily"),
        ("send_batch_expiry_notifications", "Batch expiry alerts", "Daily"),
        ("send_fee_reminders", "Fee reminders", "Daily"),
        ("purge_stale_records", "Purge stale records", "Daily"),
        ("generate_monthly_invoices", "Monthly v2 invoice cron", "1st of month"),
        ("enforce_late_payments", "Late-payment enforcement", "Daily"),
    ]

    r = await session.execute(text("""
        SELECT name, last_run_at, last_status, last_error, last_duration_ms
        FROM system_jobs
    """))
    heartbeats = {row[0]: row for row in r.all()}

    jobs = []
    for name, desc, freq in job_metadata:
        hb = heartbeats.get(name)
        jobs.append({
            "name": name,
            "description": desc,
            "frequency": freq,
            # Live status from heartbeat; falls back to 'unknown' if
            # the job has not run since the heartbeat table landed.
            "status": (hb[2] if hb else "unknown"),
            "last_run_at": (hb[1].isoformat() if hb and hb[1] else None),
            "last_error": (hb[3] if hb else None),
            "last_duration_ms": (hb[4] if hb else None),
        })

    # Video pipeline
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE video_status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE video_status = 'processing') AS processing,
            COUNT(*) FILTER (WHERE video_status = 'ready') AS ready,
            COUNT(*) FILTER (WHERE video_status = 'failed') AS failed
        FROM lectures
        WHERE deleted_at IS NULL AND video_status IS NOT NULL
    """))
    vp = r.one()

    # Webhook delivery stats (24h)
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    r = await session.execute(text("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'success' OR status = 'delivered') AS success,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending
        FROM webhook_deliveries
        WHERE created_at >= :since
    """), {"since": day_ago})
    wh = r.one()

    # Webhook stats by institute
    r = await session.execute(text("""
        SELECT wd.institute_id, i.name,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE wd.status = 'failed') AS failed
        FROM webhook_deliveries wd
        LEFT JOIN institutes i ON i.id = wd.institute_id
        WHERE wd.created_at >= :since AND wd.institute_id IS NOT NULL
        GROUP BY wd.institute_id, i.name
        ORDER BY failed DESC
        LIMIT 10
    """), {"since": day_ago})
    wh_by_inst = [
        {
            "institute_id": str(row[0]),
            "institute_name": row[1] or "Unknown",
            "total_24h": row[2],
            "failed_24h": row[3],
        }
        for row in r.all()
    ]

    return {
        "db_status": db_status,
        "db_latency_ms": db_latency,
        "redis_status": redis_status,
        "redis_memory_mb": redis_memory,
        "redis_hit_rate": redis_hit_rate,
        "redis_total_keys": redis_keys,
        "jobs": jobs,
        "video_pipeline": {
            "pending": vp[0] or 0,
            "processing": vp[1] or 0,
            "ready": vp[2] or 0,
            "failed": vp[3] or 0,
        },
        "webhook_stats": {
            "total_24h": wh[0] or 0,
            "success_24h": wh[1] or 0,
            "failed_24h": wh[2] or 0,
            "pending": wh[3] or 0,
            "by_institute": wh_by_inst,
        },
    }

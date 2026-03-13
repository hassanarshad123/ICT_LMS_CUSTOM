import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlmodel import select, func, col

from app.models.error_log import ErrorLog


async def list_errors(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID],
    is_super_admin: bool,
    filters: dict,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[ErrorLog], int]:
    """List error logs with filtering and pagination.

    Args:
        filters: dict with optional keys: source, level, resolved, search
    Returns:
        (errors, total_count)
    """
    query = select(ErrorLog)
    count_query = select(func.count()).select_from(ErrorLog)

    # Super admin sees all errors; regular admin sees only their institute's
    if not is_super_admin and institute_id:
        query = query.where(ErrorLog.institute_id == institute_id)
        count_query = count_query.where(ErrorLog.institute_id == institute_id)

    source = filters.get("source")
    level = filters.get("level")
    resolved = filters.get("resolved")
    search = filters.get("search")

    if source:
        query = query.where(ErrorLog.source == source)
        count_query = count_query.where(ErrorLog.source == source)
    if level:
        query = query.where(ErrorLog.level == level)
        count_query = count_query.where(ErrorLog.level == level)
    if resolved is not None:
        query = query.where(ErrorLog.resolved == resolved)
        count_query = count_query.where(ErrorLog.resolved == resolved)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            col(ErrorLog.message).ilike(pattern)
            | col(ErrorLog.request_path).ilike(pattern)
        )
        count_query = count_query.where(
            col(ErrorLog.message).ilike(pattern)
            | col(ErrorLog.request_path).ilike(pattern)
        )

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(ErrorLog.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    errors = list(result.scalars().all())

    return errors, total


async def get_error_stats(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID],
    is_super_admin: bool,
) -> dict:
    """Get error statistics for the monitoring dashboard.

    Returns dict with keys: total_errors_24h, unresolved_count,
    errors_by_hour, top_paths, errors_by_source, errors_by_level
    """
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    # Total errors in last 24h
    q = select(func.count()).select_from(ErrorLog).where(ErrorLog.created_at >= day_ago)
    if not is_super_admin and institute_id:
        q = q.where(ErrorLog.institute_id == institute_id)
    result = await session.execute(q)
    total_24h = result.scalar() or 0

    # Unresolved count
    q = select(func.count()).select_from(ErrorLog).where(ErrorLog.resolved == False)
    if not is_super_admin and institute_id:
        q = q.where(ErrorLog.institute_id == institute_id)
    result = await session.execute(q)
    unresolved = result.scalar() or 0

    # Errors by hour (last 24h)
    inst_clause = "" if is_super_admin else " AND institute_id = :inst_id"
    params: dict = {"since": day_ago}
    if not is_super_admin and institute_id:
        params["inst_id"] = str(institute_id)

    result = await session.execute(text(f"""
        SELECT date_trunc('hour', created_at) as hour, count(*) as count
        FROM error_logs
        WHERE created_at >= :since{inst_clause}
        GROUP BY hour
        ORDER BY hour
    """), params)
    errors_by_hour = [
        {"hour": row[0].isoformat() if row[0] else None, "count": row[1]}
        for row in result.fetchall()
    ]

    # Top error paths
    result = await session.execute(text(f"""
        SELECT request_path, count(*) as count
        FROM error_logs
        WHERE created_at >= :since AND request_path IS NOT NULL{inst_clause}
        GROUP BY request_path
        ORDER BY count DESC
        LIMIT 10
    """), params)
    top_paths = [
        {"path": row[0], "count": row[1]}
        for row in result.fetchall()
    ]

    # Errors by source
    result = await session.execute(text(f"""
        SELECT source, count(*) as count
        FROM error_logs
        WHERE created_at >= :since{inst_clause}
        GROUP BY source
    """), params)
    by_source = {row[0]: row[1] for row in result.fetchall()}

    # Errors by level
    result = await session.execute(text(f"""
        SELECT level, count(*) as count
        FROM error_logs
        WHERE created_at >= :since{inst_clause}
        GROUP BY level
    """), params)
    by_level = {row[0]: row[1] for row in result.fetchall()}

    return {
        "total_errors_24h": total_24h,
        "unresolved_count": unresolved,
        "errors_by_hour": errors_by_hour,
        "top_paths": top_paths,
        "errors_by_source": by_source,
        "errors_by_level": by_level,
    }


async def get_error(
    session: AsyncSession,
    error_id: uuid.UUID,
    institute_id: Optional[uuid.UUID],
    is_super_admin: bool,
) -> Optional[ErrorLog]:
    """Get a single error log by ID. Returns None if not found."""
    query = select(ErrorLog).where(ErrorLog.id == error_id)
    if not is_super_admin and institute_id:
        query = query.where(ErrorLog.institute_id == institute_id)
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def resolve_error(
    session: AsyncSession,
    error_id: uuid.UUID,
    user_id: uuid.UUID,
    institute_id: Optional[uuid.UUID],
    is_super_admin: bool,
    resolved: bool,
) -> Optional[ErrorLog]:
    """Mark an error as resolved or unresolved. Returns None if not found."""
    query = select(ErrorLog).where(ErrorLog.id == error_id)
    if not is_super_admin and institute_id:
        query = query.where(ErrorLog.institute_id == institute_id)
    result = await session.execute(query)
    error = result.scalar_one_or_none()
    if not error:
        return None

    error.resolved = resolved
    if resolved:
        error.resolved_at = datetime.now(timezone.utc)
        error.resolved_by = user_id
    else:
        error.resolved_at = None
        error.resolved_by = None

    session.add(error)
    await session.commit()
    await session.refresh(error)
    return error


async def resolve_all_errors(
    session: AsyncSession,
    user_id: uuid.UUID,
    institute_id: Optional[uuid.UUID],
    is_super_admin: bool,
) -> int:
    """Resolve all unresolved errors. Returns count of resolved errors."""
    query = select(ErrorLog).where(ErrorLog.resolved == False)
    if not is_super_admin and institute_id:
        query = query.where(ErrorLog.institute_id == institute_id)
    result = await session.execute(query)
    count = 0
    for error in result.scalars().all():
        error.resolved = True
        error.resolved_at = datetime.now(timezone.utc)
        error.resolved_by = user_id
        session.add(error)
        count += 1

    await session.commit()
    return count


async def clear_resolved_errors(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID],
    is_super_admin: bool,
    older_than_days: int = 7,
) -> int:
    """Delete resolved errors older than N days. Returns count of deleted errors."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    query = select(ErrorLog).where(
        ErrorLog.resolved == True,
        ErrorLog.created_at < cutoff,
    )
    if not is_super_admin and institute_id:
        query = query.where(ErrorLog.institute_id == institute_id)
    result = await session.execute(query)
    count = 0
    for error in result.scalars().all():
        await session.delete(error)
        count += 1

    await session.commit()
    return count


async def record_client_error(
    session: AsyncSession,
    error_data: dict,
) -> ErrorLog:
    """Record a client-side error report.

    Args:
        error_data: dict with keys: message, stack, url, component, extra
    Returns:
        The created ErrorLog instance.
    """
    message = error_data["message"]
    stack = error_data.get("stack")
    url = error_data.get("url")
    component = error_data.get("component")
    extra = error_data.get("extra")

    error_log = ErrorLog(
        level="error",
        message=message[:2000],
        traceback=stack[:10000] if stack else None,
        request_path=url[:500] if url else None,
        source="frontend",
        extra={
            **(extra or {}),
            **({"component": component} if component else {}),
        } or None,
    )

    session.add(error_log)
    await session.commit()
    return error_log


async def enhanced_health_check(
    session: AsyncSession,
) -> dict:
    """Enhanced health check with error counts.

    Returns dict with keys: version, environment, database, errors_last_hour,
    unresolved_errors, status
    """
    from app.config import get_settings

    settings = get_settings()
    checks: dict = {"version": "1.0.0", "environment": settings.APP_ENV}

    # Database
    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "connected"
    except Exception:
        checks["database"] = "unreachable"
        checks["status"] = "degraded"

    # Error count (last hour)
    try:
        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        result = await session.execute(
            select(func.count()).select_from(ErrorLog).where(ErrorLog.created_at >= hour_ago)
        )
        checks["errors_last_hour"] = result.scalar() or 0
    except Exception:
        checks["errors_last_hour"] = -1

    # Unresolved errors
    try:
        result = await session.execute(
            select(func.count()).select_from(ErrorLog).where(ErrorLog.resolved == False)
        )
        checks["unresolved_errors"] = result.scalar() or 0
    except Exception:
        checks["unresolved_errors"] = -1

    checks.setdefault("status", "ok")

    return checks

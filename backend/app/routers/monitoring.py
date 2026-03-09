import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlmodel import select, func

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.models.error_log import ErrorLog
from app.schemas.monitoring import (
    ErrorLogOut,
    ErrorStatsResponse,
    ClientErrorReport,
    ResolveRequest,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()

Admin = Annotated[User, Depends(require_roles("admin"))]


@router.get("/errors", response_model=PaginatedResponse[ErrorLogOut])
async def list_errors(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    source: Optional[str] = None,
    level: Optional[str] = None,
    resolved: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List error logs with filtering and pagination."""
    query = select(ErrorLog)
    count_query = select(func.count()).select_from(ErrorLog)

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
        from sqlmodel import col
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
    errors = result.scalars().all()

    return PaginatedResponse(
        data=[ErrorLogOut.model_validate(e) for e in errors],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/errors/stats", response_model=ErrorStatsResponse)
async def error_stats(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get error statistics for the monitoring dashboard."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    # Total errors in last 24h
    result = await session.execute(
        select(func.count()).select_from(ErrorLog).where(ErrorLog.created_at >= day_ago)
    )
    total_24h = result.scalar() or 0

    # Unresolved count
    result = await session.execute(
        select(func.count()).select_from(ErrorLog).where(ErrorLog.resolved == False)
    )
    unresolved = result.scalar() or 0

    # Errors by hour (last 24h)
    result = await session.execute(text("""
        SELECT date_trunc('hour', created_at) as hour, count(*) as count
        FROM error_logs
        WHERE created_at >= :since
        GROUP BY hour
        ORDER BY hour
    """), {"since": day_ago})
    errors_by_hour = [
        {"hour": row[0].isoformat() if row[0] else None, "count": row[1]}
        for row in result.fetchall()
    ]

    # Top error paths
    result = await session.execute(text("""
        SELECT request_path, count(*) as count
        FROM error_logs
        WHERE created_at >= :since AND request_path IS NOT NULL
        GROUP BY request_path
        ORDER BY count DESC
        LIMIT 10
    """), {"since": day_ago})
    top_paths = [
        {"path": row[0], "count": row[1]}
        for row in result.fetchall()
    ]

    # Errors by source
    result = await session.execute(text("""
        SELECT source, count(*) as count
        FROM error_logs
        WHERE created_at >= :since
        GROUP BY source
    """), {"since": day_ago})
    by_source = {row[0]: row[1] for row in result.fetchall()}

    # Errors by level
    result = await session.execute(text("""
        SELECT level, count(*) as count
        FROM error_logs
        WHERE created_at >= :since
        GROUP BY level
    """), {"since": day_ago})
    by_level = {row[0]: row[1] for row in result.fetchall()}

    return ErrorStatsResponse(
        total_errors_24h=total_24h,
        unresolved_count=unresolved,
        errors_by_hour=errors_by_hour,
        top_paths=top_paths,
        errors_by_source=by_source,
        errors_by_level=by_level,
    )


@router.get("/errors/{error_id}", response_model=ErrorLogOut)
async def get_error(
    error_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get full error details including traceback."""
    result = await session.execute(select(ErrorLog).where(ErrorLog.id == error_id))
    error = result.scalar_one_or_none()
    if not error:
        raise HTTPException(status_code=404, detail="Error log not found")
    return ErrorLogOut.model_validate(error)


@router.patch("/errors/{error_id}", response_model=ErrorLogOut)
async def resolve_error(
    error_id: uuid.UUID,
    body: ResolveRequest,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Mark an error as resolved or unresolved."""
    result = await session.execute(select(ErrorLog).where(ErrorLog.id == error_id))
    error = result.scalar_one_or_none()
    if not error:
        raise HTTPException(status_code=404, detail="Error log not found")

    error.resolved = body.resolved
    if body.resolved:
        error.resolved_at = datetime.now(timezone.utc)
        error.resolved_by = current_user.id
    else:
        error.resolved_at = None
        error.resolved_by = None

    session.add(error)
    await session.commit()
    await session.refresh(error)
    return ErrorLogOut.model_validate(error)


@router.post("/errors/resolve-all", status_code=status.HTTP_200_OK)
async def resolve_all_errors(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Resolve all unresolved errors."""
    result = await session.execute(
        select(ErrorLog).where(ErrorLog.resolved == False)
    )
    count = 0
    for error in result.scalars().all():
        error.resolved = True
        error.resolved_at = datetime.now(timezone.utc)
        error.resolved_by = current_user.id
        session.add(error)
        count += 1

    await session.commit()
    return {"resolved_count": count}


@router.delete("/errors/clear-resolved", status_code=status.HTTP_200_OK)
async def clear_resolved_errors(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    older_than_days: int = Query(7, ge=1, le=365),
):
    """Delete resolved errors older than N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    result = await session.execute(
        select(ErrorLog).where(
            ErrorLog.resolved == True,
            ErrorLog.created_at < cutoff,
        )
    )
    count = 0
    for error in result.scalars().all():
        await session.delete(error)
        count += 1

    await session.commit()
    return {"deleted_count": count}


@router.post("/client-errors", status_code=status.HTTP_201_CREATED)
async def report_client_error(
    body: ClientErrorReport,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Receive error reports from the frontend. No auth required for error reporting."""
    error_log = ErrorLog(
        level="error",
        message=body.message[:2000],
        traceback=body.stack[:10000] if body.stack else None,
        request_path=body.url[:500] if body.url else None,
        source="frontend",
        extra={
            **(body.extra or {}),
            **({"component": body.component} if body.component else {}),
        } or None,
    )

    session.add(error_log)
    await session.commit()

    # Discord alert for frontend errors too
    from app.utils.discord import send_discord_alert
    await send_discord_alert(
        title="Frontend Error",
        description=f"```\n{body.message[:500]}\n```",
        color=0xFFA500,
        fields=[
            {"name": "URL", "value": body.url or "unknown", "inline": True},
            {"name": "Component", "value": body.component or "unknown", "inline": True},
        ],
    )

    return {"status": "recorded"}


@router.post("/test-alert", status_code=status.HTTP_200_OK)
async def test_discord_alert(current_user: Admin):
    """Send a test alert to verify Discord webhook is working."""
    from app.utils.discord import send_discord_alert
    from app.config import get_settings

    settings = get_settings()
    if not settings.DISCORD_WEBHOOK_URL:
        raise HTTPException(
            status_code=400,
            detail="DISCORD_WEBHOOK_URL not configured in environment",
        )

    await send_discord_alert(
        title="Test Alert",
        description="This is a test alert from ICT LMS monitoring system.",
        color=0x00FF00,
        fields=[
            {"name": "Triggered by", "value": current_user.email, "inline": True},
            {"name": "Environment", "value": settings.APP_ENV, "inline": True},
        ],
    )
    return {"status": "sent"}


@router.get("/health")
async def enhanced_health_check(
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Enhanced health check with error counts. No auth required."""
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

    status_code = 200 if checks["status"] == "ok" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=status_code, content=checks)

import math
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles, get_current_user
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.monitoring import (
    ErrorLogOut,
    ErrorStatsResponse,
    ClientErrorReport,
    ResolveRequest,
)
from app.schemas.common import PaginatedResponse
from app.services import monitoring_service

router = APIRouter()

Admin = Annotated[User, Depends(require_roles("admin"))]
AdminOrSA = Annotated[User, Depends(require_roles("admin", "super_admin"))]


@router.get("/errors", response_model=PaginatedResponse[ErrorLogOut])
async def list_errors(
    current_user: AdminOrSA,
    session: Annotated[AsyncSession, Depends(get_session)],
    source: Optional[str] = None,
    level: Optional[str] = None,
    resolved: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List error logs with filtering and pagination."""
    is_sa = current_user.role == UserRole.super_admin
    filters = {
        "source": source,
        "level": level,
        "resolved": resolved,
        "search": search,
    }

    errors, total = await monitoring_service.list_errors(
        session=session,
        institute_id=current_user.institute_id,
        is_super_admin=is_sa,
        filters=filters,
        page=page,
        per_page=per_page,
    )

    return PaginatedResponse(
        data=[ErrorLogOut.model_validate(e) for e in errors],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/errors/stats", response_model=ErrorStatsResponse)
async def error_stats(
    current_user: AdminOrSA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get error statistics for the monitoring dashboard."""
    is_sa = current_user.role == UserRole.super_admin
    stats = await monitoring_service.get_error_stats(
        session=session,
        institute_id=current_user.institute_id,
        is_super_admin=is_sa,
    )

    return ErrorStatsResponse(
        total_errors_24h=stats["total_errors_24h"],
        unresolved_count=stats["unresolved_count"],
        errors_by_hour=stats["errors_by_hour"],
        top_paths=stats["top_paths"],
        errors_by_source=stats["errors_by_source"],
        errors_by_level=stats["errors_by_level"],
    )


@router.get("/errors/{error_id}", response_model=ErrorLogOut)
async def get_error(
    error_id: uuid.UUID,
    current_user: AdminOrSA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get full error details including traceback."""
    is_sa = current_user.role == UserRole.super_admin
    error = await monitoring_service.get_error(
        session=session,
        error_id=error_id,
        institute_id=current_user.institute_id,
        is_super_admin=is_sa,
    )
    if not error:
        raise HTTPException(status_code=404, detail="Error log not found")
    return ErrorLogOut.model_validate(error)


@router.patch("/errors/{error_id}", response_model=ErrorLogOut)
async def resolve_error(
    error_id: uuid.UUID,
    body: ResolveRequest,
    current_user: AdminOrSA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Mark an error as resolved or unresolved."""
    is_sa = current_user.role == UserRole.super_admin
    error = await monitoring_service.resolve_error(
        session=session,
        error_id=error_id,
        user_id=current_user.id,
        institute_id=current_user.institute_id,
        is_super_admin=is_sa,
        resolved=body.resolved,
    )
    if not error:
        raise HTTPException(status_code=404, detail="Error log not found")
    return ErrorLogOut.model_validate(error)


@router.post("/errors/resolve-all", status_code=status.HTTP_200_OK)
async def resolve_all_errors(
    current_user: AdminOrSA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Resolve all unresolved errors."""
    is_sa = current_user.role == UserRole.super_admin
    count = await monitoring_service.resolve_all_errors(
        session=session,
        user_id=current_user.id,
        institute_id=current_user.institute_id,
        is_super_admin=is_sa,
    )
    return {"resolved_count": count}


@router.delete("/errors/clear-resolved", status_code=status.HTTP_200_OK)
async def clear_resolved_errors(
    current_user: AdminOrSA,
    session: Annotated[AsyncSession, Depends(get_session)],
    older_than_days: int = Query(7, ge=1, le=365),
):
    """Delete resolved errors older than N days."""
    is_sa = current_user.role == UserRole.super_admin
    count = await monitoring_service.clear_resolved_errors(
        session=session,
        institute_id=current_user.institute_id,
        is_super_admin=is_sa,
        older_than_days=older_than_days,
    )
    return {"deleted_count": count}


@router.post("/client-errors", status_code=status.HTTP_201_CREATED)
async def report_client_error(
    request: Request,
    body: ClientErrorReport,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Receive error reports from the frontend. No auth required for error reporting."""
    # Resolve institute context from X-Institute-Slug header (best-effort)
    institute_id = None
    slug = request.headers.get("X-Institute-Slug")
    if slug:
        from app.models.institute import Institute
        from sqlmodel import select as _select
        r = await session.execute(
            _select(Institute.id).where(Institute.slug == slug, Institute.deleted_at.is_(None))
        )
        row = r.scalar_one_or_none()
        if row:
            institute_id = row

    await monitoring_service.record_client_error(
        session=session,
        error_data={
            "message": body.message,
            "stack": body.stack,
            "url": body.url,
            "component": body.component,
            "extra": body.extra,
        },
        institute_id=institute_id,
    )

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


@router.get("/sentry-test")
async def sentry_test(current_user: Admin):
    """Trigger a test error to verify Sentry is capturing exceptions."""
    raise RuntimeError("Sentry integration test — this error is intentional")


@router.get("/health")
async def enhanced_health_check(
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Enhanced health check with error counts. No auth required."""
    checks = await monitoring_service.enhanced_health_check(session=session)

    status_code = 200 if checks["status"] == "ok" else 503
    return JSONResponse(status_code=status_code, content=checks)


@router.get("/cache-stats")
async def get_cache_stats(current_user: AdminOrSA):
    """Admin-only — returns Redis cache health metrics."""
    from app.core.redis import get_redis

    r = get_redis()
    if r is None:
        return {"redis_connected": False, "message": "Redis is not configured or unavailable"}

    try:
        info_memory = await r.info("memory")
        info_stats = await r.info("stats")
        info_keyspace = await r.info("keyspace")
        db_size = await r.dbsize()

        return {
            "redis_connected": True,
            "memory_used_mb": round(info_memory.get("used_memory", 0) / 1024 / 1024, 2),
            "memory_max_mb": round(info_memory.get("maxmemory", 0) / 1024 / 1024, 2),
            "total_keys": db_size,
            "hits": info_stats.get("keyspace_hits", 0),
            "misses": info_stats.get("keyspace_misses", 0),
            "hit_rate_percent": round(
                info_stats.get("keyspace_hits", 0)
                / max(info_stats.get("keyspace_hits", 0) + info_stats.get("keyspace_misses", 0), 1)
                * 100,
                1,
            ),
            "evictions": info_stats.get("evicted_keys", 0),
            "connected_clients": info_memory.get("connected_clients", 0),
        }
    except Exception as e:
        return {"redis_connected": False, "error": str(e)}

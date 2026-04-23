import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.sa_monitoring import (
    SAErrorLogOut,
    CrossInstituteErrorStats,
    SystemHealthResponse,
)
from app.schemas.monitoring import ResolveRequest
from app.services import sa_monitoring_service
from app.services.monitoring_service import resolve_error

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


@router.get("/errors/stats", response_model=CrossInstituteErrorStats)
async def get_error_stats(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_monitoring_service.get_cross_institute_error_stats(session)
    return CrossInstituteErrorStats(**data)


@router.get("/errors", response_model=PaginatedResponse[SAErrorLogOut])
async def list_errors(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    institute_id: Optional[str] = None,
    level: Optional[str] = None,
    source: Optional[str] = None,
    resolved: Optional[bool] = None,
):
    filters: dict = {}
    if institute_id:
        filters["institute_id"] = institute_id
    if level:
        filters["level"] = level
    if source:
        filters["source"] = source
    if resolved is not None:
        filters["resolved"] = resolved

    errors, total = await sa_monitoring_service.get_sa_errors(
        session, filters, page, per_page
    )

    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[SAErrorLogOut.model_validate(e) for e in errors],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.patch("/errors/{error_id}", response_model=SAErrorLogOut)
async def resolve_sa_error(
    error_id: uuid.UUID,
    body: ResolveRequest,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from fastapi import HTTPException

    error = await resolve_error(
        session,
        error_id=error_id,
        user_id=sa.id,
        institute_id=None,
        is_super_admin=True,
        resolved=body.resolved,
        notes=body.notes,
    )
    if not error:
        raise HTTPException(status_code=404, detail="Error not found")
    return SAErrorLogOut.model_validate(error)


@router.get("/errors/{error_id}", response_model=SAErrorLogOut)
async def get_error_detail(
    error_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from fastapi import HTTPException
    from app.models.error_log import ErrorLog
    from sqlalchemy import select

    result = await session.execute(select(ErrorLog).where(ErrorLog.id == error_id))
    error = result.scalar_one_or_none()
    if not error:
        raise HTTPException(status_code=404, detail="Error not found")
    return SAErrorLogOut.model_validate(error)


@router.get("/errors/export/csv")
async def export_errors_csv(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    institute_id: Optional[str] = None,
    level: Optional[str] = None,
    source: Optional[str] = None,
    resolved: Optional[bool] = None,
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    filters: dict = {}
    if institute_id:
        filters["institute_id"] = institute_id
    if level:
        filters["level"] = level
    if source:
        filters["source"] = source
    if resolved is not None:
        filters["resolved"] = resolved

    errors, _ = await sa_monitoring_service.get_sa_errors(session, filters, 1, 5000)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ID", "Level", "Message", "Source", "Path", "Institute", "Resolved", "Notes", "Created"])
    for e in errors:
        writer.writerow([
            str(e.id), e.level, e.message[:200], e.source,
            e.request_path or "", getattr(e, "institute_name", "") or "",
            "Yes" if e.resolved else "No",
            e.resolution_notes or "",
            str(e.created_at) if e.created_at else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=errors-export.csv"},
    )


@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_monitoring_service.get_system_health(session)
    return SystemHealthResponse(**data)

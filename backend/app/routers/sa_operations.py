import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.utils.rate_limit import limiter
from app.utils.audit import log_sa_action
from app.schemas.common import PaginatedResponse, CountResponse, MessageResponse
from app.schemas.sa_operations import (
    ActivityLogItem,
    GlobalUserSearchResult,
    AdminListItem,
    ActiveSessionItem,
    BulkInstituteAction,
    PasswordResetRequest,
)
from app.services import sa_operations_service
from app.services.institute_service import recalculate_usage

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


@router.get("/activity-log", response_model=PaginatedResponse[ActivityLogItem])
async def get_activity_log(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    institute_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    inst_uuid = uuid.UUID(institute_id) if institute_id else None
    u_uuid = uuid.UUID(user_id) if user_id else None

    items, total = await sa_operations_service.get_activity_log(
        session, inst_uuid, action, entity_type, u_uuid,
        date_from, date_to, page, per_page,
    )
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[ActivityLogItem(**i) for i in items],
        total=total, page=page, per_page=per_page, total_pages=total_pages,
    )


@router.get("/impersonation-history", response_model=PaginatedResponse[ActivityLogItem])
async def get_impersonation_history(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    items, total = await sa_operations_service.get_activity_log(
        session, action="sa_impersonation_start", page=page, per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[ActivityLogItem(**i) for i in items],
        total=total, page=page, per_page=per_page, total_pages=total_pages,
    )


@router.get("/users/search", response_model=PaginatedResponse[GlobalUserSearchResult])
async def search_users(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    q: str = Query(min_length=2),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    items, total = await sa_operations_service.global_user_search(
        session, q, page, per_page,
    )
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[GlobalUserSearchResult(**i) for i in items],
        total=total, page=page, per_page=per_page, total_pages=total_pages,
    )


@router.post("/institutes/bulk-action", response_model=CountResponse)
@limiter.limit("5/minute")
async def bulk_institute_action(
    request: Request,
    body: BulkInstituteAction,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Up-front validation: every submitted ID must resolve to a
    # non-deleted institute. Previously a list of bogus IDs silently
    # returned count=0 — no indication of why nothing happened.
    if not body.institute_ids:
        raise HTTPException(status_code=400, detail="institute_ids cannot be empty")

    from app.models.institute import Institute
    from sqlmodel import select as _sel
    r = await session.execute(
        _sel(Institute.id).where(
            Institute.id.in_(body.institute_ids),
            Institute.deleted_at.is_(None),
        )
    )
    found = {row[0] for row in r.all()}
    missing = [str(iid) for iid in body.institute_ids if iid not in found]
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown or deleted institute IDs: {missing}",
        )

    # action is already validated by BulkActionField (Literal["suspend", "activate"])
    count = await sa_operations_service.bulk_update_institute_status(
        session, body.institute_ids, body.action, sa.id,
    )
    return CountResponse(count=count)


@router.get("/admins", response_model=PaginatedResponse[AdminListItem])
async def list_admins(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    items, total = await sa_operations_service.list_admins(session, page, per_page)
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[AdminListItem(**i) for i in items],
        total=total, page=page, per_page=per_page, total_pages=total_pages,
    )


@router.post("/users/{target_user_id}/reset-password", response_model=MessageResponse)
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    target_user_id: uuid.UUID,
    body: PasswordResetRequest,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await sa_operations_service.reset_user_password(
            session, target_user_id, body.new_password, sa.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return MessageResponse(detail="Password reset successfully")


@router.post("/users/{target_user_id}/deactivate", response_model=MessageResponse)
@limiter.limit("10/minute")
async def deactivate_user(
    request: Request,
    target_user_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await sa_operations_service.deactivate_user(session, target_user_id, sa.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return MessageResponse(detail="User deactivated")


@router.post("/users/{target_user_id}/activate", response_model=MessageResponse)
@limiter.limit("10/minute")
async def activate_user(
    request: Request,
    target_user_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await sa_operations_service.activate_user(session, target_user_id, sa.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return MessageResponse(detail="User activated")


@router.get("/sessions", response_model=PaginatedResponse[ActiveSessionItem])
async def list_sessions(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    institute_id: Optional[str] = None,
):
    inst_uuid = uuid.UUID(institute_id) if institute_id else None
    items, total = await sa_operations_service.list_active_sessions(
        session, inst_uuid, page, per_page,
    )
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[ActiveSessionItem(**i) for i in items],
        total=total, page=page, per_page=per_page, total_pages=total_pages,
    )


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
@limiter.limit("20/minute")
async def terminate_session(
    request: Request,
    session_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    ok = await sa_operations_service.terminate_session(session, session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return MessageResponse(detail="Session terminated")


@router.delete("/sessions/institute/{institute_id}", response_model=CountResponse)
@limiter.limit("5/minute")
async def terminate_institute_sessions(
    request: Request,
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    count = await sa_operations_service.terminate_institute_sessions(session, institute_id)
    return CountResponse(count=count)


@router.get("/export/institutes")
@limiter.limit("3/minute")
async def export_institutes(
    request: Request,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    csv_content = await sa_operations_service.export_institutes_csv(session)
    await log_sa_action(session, sa.id, "institutes_exported", "export")
    await session.commit()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=institutes.csv"},
    )


@router.get("/export/users")
@limiter.limit("3/minute")
async def export_users(
    request: Request,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    csv_content = await sa_operations_service.export_users_csv(session)
    await log_sa_action(session, sa.id, "users_exported", "export")
    await session.commit()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users.csv"},
    )


@router.post("/recalculate-usage", response_model=MessageResponse)
@limiter.limit("3/minute")
async def force_recalculate(
    request: Request,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    institute_id: Optional[str] = None,
):
    if institute_id:
        await recalculate_usage(session, uuid.UUID(institute_id))
        return MessageResponse(detail="Usage recalculated for institute")

    from app.models.institute import Institute
    r = await session.execute(
        select(Institute.id).where(Institute.deleted_at.is_(None))
    )
    for (iid,) in r.all():
        await recalculate_usage(session, iid)
    return MessageResponse(detail="Usage recalculated for all institutes")

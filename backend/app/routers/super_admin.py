from datetime import datetime, timezone
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.models.institute import Institute, InstituteUsage, InstituteStatus, PlanTier
from app.models.activity import ActivityLog
from app.models.enums import UserRole
from app.schemas.super_admin import (
    InstituteCreate, InstituteUpdate, InstituteOut, AdminCreate, PlatformDashboard
)
from app.schemas.common import PaginatedResponse
from app.services.institute_service import (
    create_institute, create_admin_for_institute, get_platform_stats,
    recalculate_usage, get_or_create_usage,
    check_and_increment_user_quota,
)
from app.utils.security import create_impersonation_token
from app.utils.rate_limit import limiter
from app.utils.audit import log_sa_action


router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


async def _institute_to_out(session: AsyncSession, institute: Institute) -> InstituteOut:
    usage = await get_or_create_usage(session, institute.id)
    return InstituteOut(
        id=institute.id,
        name=institute.name,
        slug=institute.slug,
        status=institute.status.value,
        plan_tier=institute.plan_tier.value,
        max_users=institute.max_users,
        max_storage_gb=institute.max_storage_gb,
        max_video_gb=institute.max_video_gb,
        contact_email=institute.contact_email,
        expires_at=institute.expires_at,
        created_at=institute.created_at,
        current_users=usage.current_users,
        current_storage_gb=round(usage.current_storage_bytes / (1024 ** 3), 3),
        current_video_gb=round(usage.current_video_bytes / (1024 ** 3), 3),
    )


@router.get("/dashboard", response_model=PlatformDashboard)
async def get_dashboard(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    stats = await get_platform_stats(session)
    return PlatformDashboard(**stats)


@router.get("/institutes", response_model=PaginatedResponse)
async def list_institutes(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    plan_tier: str = Query(None),
):
    query = select(Institute).where(Institute.deleted_at.is_(None))
    if status:
        query = query.where(Institute.status == InstituteStatus(status))
    if plan_tier:
        query = query.where(Institute.plan_tier == PlanTier(plan_tier))

    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await session.execute(
        query.order_by(Institute.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    institutes = result.scalars().all()
    items = [await _institute_to_out(session, i) for i in institutes]

    return PaginatedResponse(
        data=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )


@router.post("/institutes", response_model=InstituteOut, status_code=201)
async def create_institute_endpoint(
    sa: SA,
    body: InstituteCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Check slug uniqueness
    existing = await session.execute(
        select(Institute).where(Institute.slug == body.slug, Institute.deleted_at.is_(None))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Slug '{body.slug}' is already taken")

    institute = await create_institute(
        session=session,
        name=body.name,
        slug=body.slug,
        contact_email=body.contact_email,
        plan_tier=body.plan_tier,
        max_users=body.max_users,
        max_storage_gb=body.max_storage_gb,
        max_video_gb=body.max_video_gb,
        expires_at=body.expires_at,
    )
    await log_sa_action(session, sa.id, "institute_created", "institute", institute.id, details={"name": body.name, "slug": body.slug, "plan_tier": body.plan_tier})
    await session.commit()
    await session.refresh(institute)
    return await _institute_to_out(session, institute)


@router.get("/institutes/{institute_id}", response_model=InstituteOut)
async def get_institute(
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise HTTPException(404, "Institute not found")
    return await _institute_to_out(session, institute)


@router.patch("/institutes/{institute_id}", response_model=InstituteOut)
async def update_institute(
    institute_id: uuid.UUID,
    body: InstituteUpdate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise HTTPException(404, "Institute not found")

    update_data = body.model_dump(exclude_unset=True)
    if "slug" in update_data and update_data["slug"] != institute.slug:
        existing = await session.execute(
            select(Institute).where(
                Institute.slug == update_data["slug"],
                Institute.id != institute_id,
                Institute.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(400, f"Slug '{update_data['slug']}' is already taken")

    if "plan_tier" in update_data:
        update_data["plan_tier"] = PlanTier(update_data["plan_tier"])

    for key, val in update_data.items():
        setattr(institute, key, val)

    institute.updated_at = datetime.now(timezone.utc)
    session.add(institute)
    await log_sa_action(session, sa.id, "institute_updated", "institute", institute_id, institute_id=institute_id, details=update_data)
    await session.commit()
    await session.refresh(institute)
    return await _institute_to_out(session, institute)


@router.post("/institutes/{institute_id}/suspend")
@limiter.limit("10/minute")
async def suspend_institute_endpoint(
    request: Request,
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.services.institute_lifecycle import suspend_institute
    try:
        await suspend_institute(session, institute_id, sa.id, ip_address=request.client.host if request.client else None)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"detail": "Institute suspended"}


@router.post("/institutes/{institute_id}/activate")
@limiter.limit("10/minute")
async def activate_institute_endpoint(
    request: Request,
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.services.institute_lifecycle import activate_institute
    try:
        await activate_institute(session, institute_id, sa.id, ip_address=request.client.host if request.client else None)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"detail": "Institute activated"}


@router.post("/institutes/{institute_id}/admin", response_model=dict, status_code=201)
@limiter.limit("10/minute")
async def create_admin(
    request: Request,
    institute_id: uuid.UUID,
    body: AdminCreate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise HTTPException(404, "Institute not found")

    # Check email not already taken in this institute
    existing = await session.execute(
        select(User).where(
            func.lower(User.email) == body.email.strip().lower(),
            User.institute_id == institute_id,
            User.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already in use in this institute")

    # Atomically check quota and pre-increment before create (locked with FOR UPDATE)
    try:
        await check_and_increment_user_quota(session, institute_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = await create_admin_for_institute(
        session=session,
        institute_id=institute_id,
        email=body.email.strip().lower(),
        name=body.name,
        password=body.password,
        phone=body.phone,
    )

    # Single commit for quota increment + user creation + audit (atomic)
    await log_sa_action(session, sa.id, "admin_created", "user", user.id, institute_id=institute_id, details={"email": body.email, "name": body.name})
    await session.commit()
    await session.refresh(user)
    return {"id": str(user.id), "email": user.email, "name": user.name, "role": user.role.value}


@router.patch("/institutes/{institute_id}/plan")
async def update_plan(
    institute_id: uuid.UUID,
    body: InstituteUpdate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise HTTPException(404, "Institute not found")

    update_data = body.model_dump(exclude_unset=True)
    if "plan_tier" in update_data:
        update_data["plan_tier"] = PlanTier(update_data["plan_tier"])
    for key, val in update_data.items():
        setattr(institute, key, val)
    institute.updated_at = datetime.now(timezone.utc)
    session.add(institute)
    await session.commit()
    return {"detail": "Plan updated"}


@router.get("/institutes/{institute_id}/users")
async def get_institute_users(
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise HTTPException(404, "Institute not found")

    query = select(User).where(User.institute_id == institute_id, User.deleted_at.is_(None))
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await session.execute(
        query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    users = result.scalars().all()
    items = [
        {"id": str(u.id), "email": u.email, "name": u.name, "role": u.role.value, "status": u.status.value}
        for u in users
    ]
    return PaginatedResponse(
        data=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )


@router.get("/institutes/{institute_id}/courses")
async def get_institute_courses(
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    from app.models.course import Course
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise HTTPException(404, "Institute not found")

    query = select(Course).where(Course.institute_id == institute_id, Course.deleted_at.is_(None))
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await session.execute(
        query.order_by(Course.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    courses = result.scalars().all()
    items = [
        {
            "id": str(c.id),
            "title": c.title,
            "status": c.status.value,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in courses
    ]
    return PaginatedResponse(
        data=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )


@router.get("/institutes/{institute_id}/batches")
async def get_institute_batches(
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    from app.models.batch import Batch
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise HTTPException(404, "Institute not found")

    query = select(Batch).where(Batch.institute_id == institute_id, Batch.deleted_at.is_(None))
    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await session.execute(
        query.order_by(Batch.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    batches = result.scalars().all()
    items = [
        {
            "id": str(b.id),
            "name": b.name,
            "start_date": str(b.start_date),
            "end_date": str(b.end_date),
        }
        for b in batches
    ]
    return PaginatedResponse(
        data=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )


@router.post("/impersonate/{user_id}")
@limiter.limit("10/minute")
async def impersonate_user(
    user_id: uuid.UUID,
    request: Request,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create a short-lived impersonation token for SA to act as a target user."""
    target = await session.get(User, user_id)
    if not target or target.deleted_at:
        raise HTTPException(404, "User not found")
    if target.role == UserRole.super_admin:
        raise HTTPException(403, "Cannot impersonate another super admin")

    institute = await session.get(Institute, target.institute_id)
    if not institute:
        raise HTTPException(404, "Institute not found")

    token = create_impersonation_token(target.id, sa.id, target.token_version)

    # Audit log
    log = ActivityLog(
        user_id=sa.id,
        action="sa_impersonation_start",
        entity_type="user",
        entity_id=target.id,
        details={"target_email": target.email, "institute_name": institute.name},
        ip_address=request.client.host if request.client else None,
        impersonated_by=sa.id,
    )
    session.add(log)
    await session.commit()

    return {
        "token": token,
        "institute_slug": institute.slug,
        "target_user_id": str(target.id),
        "target_user_name": target.name,
        "target_user_role": target.role.value,
    }

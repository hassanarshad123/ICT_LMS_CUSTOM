from datetime import datetime, timezone
from typing import Annotated
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
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
    increment_staff_usage, change_institute_tier,
)
from app.utils.security import create_impersonation_token
from app.utils.rate_limit import limiter
from app.utils.audit import log_sa_action


router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


async def _institute_to_out(session: AsyncSession, institute: Institute) -> InstituteOut:
    usage = await get_or_create_usage(session, institute.id)
    # Count only users with role=student for the per-tier cap display.
    # Incremental tracking added in Phase 2 (see check_and_increment_student_quota).
    student_count_result = await session.execute(
        select(func.count(User.id)).where(
            User.institute_id == institute.id,
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
    )
    current_students = student_count_result.scalar_one() or 0
    return InstituteOut(
        id=institute.id,
        name=institute.name,
        slug=institute.slug,
        status=institute.status.value,
        plan_tier=institute.plan_tier.value,
        max_users=institute.max_users,
        max_students=institute.max_students,
        max_storage_gb=institute.max_storage_gb,
        max_video_gb=institute.max_video_gb,
        contact_email=institute.contact_email,
        expires_at=institute.expires_at,
        created_at=institute.created_at,
        current_users=usage.current_users,
        current_students=current_students,
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
    # Single batched query: Institute LEFT JOIN InstituteUsage LEFT
    # JOIN (per-institute student count subquery). Previously issued
    # 1 + 2N queries per page (N+1 helper call).
    from sqlalchemy.orm import aliased

    base_filters = [Institute.deleted_at.is_(None)]
    if status:
        base_filters.append(Institute.status == InstituteStatus(status))
    if plan_tier:
        base_filters.append(Institute.plan_tier == PlanTier(plan_tier))

    count_result = await session.execute(
        select(func.count(Institute.id)).where(*base_filters)
    )
    total = count_result.scalar_one() or 0

    # Subquery: count of role=student users per institute.
    student_count_sq = (
        select(
            User.institute_id.label("iid"),
            func.count(User.id).label("student_count"),
        )
        .where(
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
        .group_by(User.institute_id)
        .subquery()
    )

    usage_alias = aliased(InstituteUsage)

    stmt = (
        select(
            Institute,
            usage_alias.current_users,
            usage_alias.current_storage_bytes,
            usage_alias.current_video_bytes,
            func.coalesce(student_count_sq.c.student_count, 0).label("student_count"),
        )
        .outerjoin(usage_alias, usage_alias.institute_id == Institute.id)
        .outerjoin(student_count_sq, student_count_sq.c.iid == Institute.id)
        .where(*base_filters)
        .order_by(Institute.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = (await session.execute(stmt)).all()

    items = [
        InstituteOut(
            id=inst.id,
            name=inst.name,
            slug=inst.slug,
            status=inst.status.value,
            plan_tier=inst.plan_tier.value,
            max_users=inst.max_users,
            max_students=inst.max_students,
            max_storage_gb=inst.max_storage_gb,
            max_video_gb=inst.max_video_gb,
            contact_email=inst.contact_email,
            expires_at=inst.expires_at,
            created_at=inst.created_at,
            current_users=cu or 0,
            current_students=int(students or 0),
            current_storage_gb=round((csb or 0) / (1024 ** 3), 3),
            current_video_gb=round((cvb or 0) / (1024 ** 3), 3),
        )
        for inst, cu, csb, cvb, students in rows
    ]

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
    background_tasks: BackgroundTasks,
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
        max_students=body.max_students,
        max_storage_gb=body.max_storage_gb,
        max_video_gb=body.max_video_gb,
        expires_at=body.expires_at,
    )
    await log_sa_action(session, sa.id, "institute_created", "institute", institute.id, details={"name": body.name, "slug": body.slug, "plan_tier": body.plan_tier})
    await session.commit()
    await session.refresh(institute)

    # Pre-warm the new tenant subdomain so Vercel provisions the wildcard
    # SSL cert before anyone visits the new institute for the first time.
    from app.utils.subdomain_warmup import warmup_subdomain
    background_tasks.add_task(warmup_subdomain, institute.slug)

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
    # tier_change_reason is a write-only audit field — pulled out so it
    # never gets setattr'd onto Institute (column doesn't exist).
    tier_change_reason = update_data.pop("tier_change_reason", None)
    old_tier = institute.plan_tier

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
        new_tier = PlanTier(update_data.pop("plan_tier"))
        try:
            await change_institute_tier(
                session,
                institute=institute,
                new_tier=new_tier,
                reason=tier_change_reason,
            )
        except ValueError as e:
            raise HTTPException(400, str(e))

    # Apply remaining field updates (slug / name / contact_email / caps / expires_at).
    for key, val in update_data.items():
        setattr(institute, key, val)

    institute.updated_at = datetime.now(timezone.utc)
    session.add(institute)

    # Record the SA action; tier change gets a dedicated activity for easy filtering.
    await log_sa_action(
        session, sa.id, "institute_updated", "institute", institute_id,
        institute_id=institute_id, details=update_data,
    )
    if old_tier != institute.plan_tier:
        await log_sa_action(
            session, sa.id, "institute_tier_changed", "institute", institute_id,
            institute_id=institute_id,
            details={
                "from": old_tier.value,
                "to": institute.plan_tier.value,
                "reason": tier_change_reason,
            },
        )

    await session.commit()
    await session.refresh(institute)

    # Invalidate dashboard/insights cache so the next SA load reflects
    # the new tier/caps instead of returning stale quota numbers.
    # Best-effort — cache service fails open on Redis outage.
    try:
        from app.core.cache import cache
        await cache.invalidate_dashboard(str(institute_id))
    except Exception:
        pass

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

    # Admins are uncapped in the 5-tier model (staff uncounted).
    # Track in current_users for SA visibility only.
    await increment_staff_usage(session, institute_id)

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
    """Start SA impersonation of a target user.

    Security gates (Phase 4):
      - Self-impersonation is rejected (SA cannot impersonate itself).
      - Target must be a non-SA, non-deleted user.
      - Target's institute must exist, not be soft-deleted, and be
        active (suspended institutes can't be impersonated into —
        their regular users are already locked out).
      - Token is stored in a Redis-backed single-use handover keyed
        by a random id; the response returns the HANDOVER ID, not
        the JWT. Token never appears in any URL.
    """
    # Self-impersonation is a footgun — SA could mint a user-level
    # token for themselves and bypass SA audit scoping.
    if user_id == sa.id:
        raise HTTPException(403, "Cannot impersonate yourself")

    target = await session.get(User, user_id)
    if not target or target.deleted_at:
        raise HTTPException(404, "User not found")
    if target.role == UserRole.super_admin:
        raise HTTPException(403, "Cannot impersonate another super admin")

    institute = await session.get(Institute, target.institute_id)
    if not institute or institute.deleted_at is not None:
        raise HTTPException(404, "Institute not found")
    if institute.status != InstituteStatus.active:
        raise HTTPException(
            403,
            f"Cannot impersonate into institute with status "
            f"'{institute.status.value}' — activate it first.",
        )

    token = create_impersonation_token(target.id, sa.id, target.token_version)

    # Redis handover: store token keyed by short-lived random id.
    from app.utils.impersonation_handover import issue
    handover_id = await issue(token)
    if handover_id is None:
        raise HTTPException(
            503,
            "Impersonation unavailable: handover store is offline. "
            "Try again in a moment.",
        )

    # Audit log records the start. Token itself is never logged.
    log = ActivityLog(
        user_id=sa.id,
        action="sa_impersonation_start",
        entity_type="user",
        entity_id=target.id,
        details={
            "target_email": target.email,
            "institute_name": institute.name,
            "handover_id_prefix": handover_id[:8],  # for cross-ref only
        },
        ip_address=request.client.host if request.client else None,
        impersonated_by=sa.id,
    )
    session.add(log)
    await session.commit()

    return {
        "handover_id": handover_id,
        "institute_slug": institute.slug,
        "target_user_id": str(target.id),
        "target_user_name": target.name,
        "target_user_role": target.role.value,
    }

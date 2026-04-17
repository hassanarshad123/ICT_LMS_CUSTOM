import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.utils.rate_limit import limiter
from app.schemas.batch import (
    BatchCreate, BatchUpdate, BatchOut, BatchStudentEnroll, BatchCourseLink,
    EnrollmentToggle, ExtendAccessRequest, ExtensionOut, ExtensionHistoryItem, ExpirySummary,
    AccessAdjustRequest, BulkEnrollRequest, BulkAccessAdjustRequest,
)
from app.schemas.common import PaginatedResponse
from app.services import batch_service, webhook_event_service
from app.middleware.auth import require_roles, get_current_user
from app.middleware.access_control import verify_batch_access
from app.models.user import User

router = APIRouter()

AdminOrCC = Annotated[User, Depends(require_roles("admin", "course_creator"))]
CC = Annotated[User, Depends(require_roles("admin", "course_creator"))]
AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[BatchOut])
async def list_batches(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    teacher_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
):
    items, total = await batch_service.list_batches(
        session, current_user, page=page, per_page=per_page,
        status_filter=status, teacher_id=teacher_id, search=search,
        institute_id=current_user.institute_id,
    )
    return PaginatedResponse(
        data=[BatchOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_batch(
    request: Request,
    body: BatchCreate,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.utils.plan_limits import check_creation_limit
    try:
        await check_creation_limit(session, current_user.institute_id, "batches")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    batch = await batch_service.create_batch(
        session, name=body.name, start_date=body.start_date,
        end_date=body.end_date, teacher_id=body.teacher_id,
        created_by=current_user.id, institute_id=current_user.institute_id,
    )
    data = await batch_service.get_batch(session, batch.id, institute_id=current_user.institute_id)

    # Invalidate dashboard cache
    from app.core.cache import cache
    if current_user.institute_id:
        await cache.invalidate_dashboard(str(current_user.institute_id))

    return BatchOut(**data)


@router.get("/{batch_id}", response_model=BatchOut)
async def get_batch(
    batch_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await verify_batch_access(session, current_user, batch_id)
    data = await batch_service.get_batch(session, batch_id, institute_id=current_user.institute_id)
    if not data:
        raise HTTPException(status_code=404, detail="Batch not found")

    # For students, include their personal access status
    if current_user.role.value == "student":
        from app.models.batch import StudentBatch as SBModel
        from app.middleware.access_control import get_effective_end_date
        from app.models.batch import Batch as BatchModel
        from datetime import date as _date
        sb_result = await session.execute(
            select(SBModel).where(
                SBModel.student_id == current_user.id,
                SBModel.batch_id == batch_id,
                SBModel.removed_at.is_(None),
            )
        )
        sb = sb_result.scalar_one_or_none()
        batch_obj = await session.get(BatchModel, batch_id)
        if sb and batch_obj:
            eff = get_effective_end_date(batch_obj, sb)
            data["access_expired"] = _date.today() > eff
            data["effective_end_date"] = eff.isoformat()
            data["extended_end_date"] = sb.extended_end_date.isoformat() if sb.extended_end_date else None

    return BatchOut(**data)


@router.patch("/{batch_id}", response_model=BatchOut)
async def update_batch(
    batch_id: uuid.UUID,
    body: BatchUpdate,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await batch_service.update_batch(session, batch_id, institute_id=current_user.institute_id, **body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    data = await batch_service.get_batch(session, batch_id, institute_id=current_user.institute_id)
    return BatchOut(**data)


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_batch(
    batch_id: uuid.UUID,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await batch_service.soft_delete_batch(session, batch_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Invalidate dashboard cache
    from app.core.cache import cache
    if current_user.institute_id:
        await cache.invalidate_dashboard(str(current_user.institute_id))


@router.get("/{batch_id}/students")
async def list_batch_students(
    batch_id: uuid.UUID,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List students in a batch. Admin/CC/Teacher only — students cannot view roster."""
    await verify_batch_access(session, current_user, batch_id)
    items, total = await batch_service.list_batch_students(
        session, batch_id, institute_id=current_user.institute_id,
        search=search, page=page, per_page=per_page,
    )
    return PaginatedResponse(
        data=items, total=total, page=page, per_page=per_page,
        total_pages=max(1, math.ceil(total / per_page)),
    )


@router.post("/{batch_id}/students", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def enroll_student(
    request: Request,
    batch_id: uuid.UUID,
    body: BatchStudentEnroll,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        sb = await batch_service.enroll_student(
            session, batch_id, body.student_id, current_user.id,
            institute_id=current_user.institute_id,
            access_days=body.access_days,
            access_end_date=body.access_end_date,
            reason=body.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if current_user.institute_id:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "enrollment.created",
            {"student_id": str(body.student_id), "batch_id": str(batch_id)},
        )
        await session.commit()

    return {"id": sb.id, "student_id": sb.student_id, "batch_id": sb.batch_id, "enrolled_at": sb.enrolled_at}


@router.delete("/{batch_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_student(
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await batch_service.remove_student(
            session, batch_id, student_id, current_user.id,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if current_user.institute_id:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "enrollment.removed",
            {"student_id": str(student_id), "batch_id": str(batch_id)},
        )
        await session.commit()


@router.patch("/{batch_id}/students/{student_id}/active")
async def toggle_enrollment_status(
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    body: EnrollmentToggle,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        sb = await batch_service.toggle_enrollment_active(
            session, batch_id, student_id, body.is_active, current_user.id,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if current_user.institute_id:
        event_type = "enrollment.activated" if body.is_active else "enrollment.deactivated"
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, event_type,
            {"student_id": str(student_id), "batch_id": str(batch_id), "is_active": body.is_active},
        )
        await session.commit()

    return {"student_id": str(student_id), "batch_id": str(batch_id), "is_active": sb.is_active}


@router.get("/{batch_id}/courses")
async def list_batch_courses(
    batch_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await verify_batch_access(session, current_user, batch_id)
    return await batch_service.list_batch_courses(session, batch_id, institute_id=current_user.institute_id)


@router.post("/{batch_id}/courses", status_code=status.HTTP_201_CREATED)
async def link_course(
    batch_id: uuid.UUID,
    body: BatchCourseLink,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        bc = await batch_service.link_course(
            session, batch_id, body.course_id, current_user.id,
            institute_id=current_user.institute_id,
        )
        return {"id": bc.id, "batch_id": bc.batch_id, "course_id": bc.course_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{batch_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_course(
    batch_id: uuid.UUID,
    course_id: uuid.UUID,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await batch_service.unlink_course(session, batch_id, course_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Per-student batch time extensions ────────────────────────────


@router.post("/{batch_id}/students/{student_id}/extend", response_model=ExtensionOut)
async def extend_student_access(
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    body: ExtendAccessRequest,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Extend a student's access to this batch beyond the batch end_date."""
    try:
        result = await batch_service.extend_student_access(
            session,
            institute_id=current_user.institute_id,
            student_id=student_id,
            batch_id=batch_id,
            end_date=body.end_date,
            duration_days=body.duration_days,
            reason=body.reason,
            extended_by=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if current_user.institute_id:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "batch.student_extended",
            {
                "batch_id": str(batch_id),
                "student_id": str(student_id),
                "new_end_date": str(result["new_end_date"]),
                "extended_by": str(current_user.id),
            },
        )
        await session.commit()

    return ExtensionOut(**result)


@router.post("/{batch_id}/students/{student_id}/access", response_model=ExtensionOut)
async def set_student_access_endpoint(
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    body: AccessAdjustRequest,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Adjust a single student's access end for this batch (extend or shorten)."""
    try:
        result = await batch_service.set_student_access(
            session,
            institute_id=current_user.institute_id,
            student_id=student_id,
            batch_id=batch_id,
            days=body.access_days,
            end_date=body.access_end_date,
            actor_id=current_user.id,
            reason=body.reason,
            context="adjust",
            skip_notification=body.skip_notifications,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await session.commit()
    return ExtensionOut(
        student_id=student_id,
        batch_id=batch_id,
        previous_end_date=result["previous_end_date"],
        new_end_date=result["new_end_date"],
        extension_type=result["extension_type"],
        duration_days=body.access_days,
        reason=body.reason,
    )


@router.get("/{batch_id}/students/{student_id}/extensions", response_model=list[ExtensionHistoryItem])
async def get_extension_history(
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get extension history for a student in this batch."""
    history = await batch_service.get_extension_history(
        session, batch_id, student_id,
        institute_id=current_user.institute_id,
    )
    return [ExtensionHistoryItem(**item) for item in history]


@router.post("/{batch_id}/students/bulk-set-access")
async def bulk_set_access(
    batch_id: uuid.UUID,
    body: BulkAccessAdjustRequest,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Adjust access end for multiple students at once (extend or shorten)."""
    try:
        return await batch_service.bulk_set_student_access(
            session,
            institute_id=current_user.institute_id,
            batch_id=batch_id,
            student_ids=body.student_ids,
            actor_id=current_user.id,
            days=body.access_days,
            end_date=body.access_end_date,
            reason=body.reason,
            skip_notifications=body.skip_notifications,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{batch_id}/students/bulk-enroll")
async def bulk_enroll(
    batch_id: uuid.UUID,
    body: BulkEnrollRequest,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Enroll multiple students in this batch with a shared access window."""
    return await batch_service.bulk_enroll_students(
        session,
        institute_id=current_user.institute_id,
        batch_id=batch_id,
        student_ids=body.student_ids,
        enrolled_by=current_user.id,
        access_days=body.access_days,
        access_end_date=body.access_end_date,
        reason=body.reason,
        skip_notifications=body.skip_notifications,
    )


@router.get("/{batch_id}/expiry-summary", response_model=ExpirySummary)
async def get_expiry_summary(
    batch_id: uuid.UUID,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get expiry summary for all students in this batch."""
    try:
        summary = await batch_service.get_expiry_summary(
            session, batch_id,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ExpirySummary(**summary)

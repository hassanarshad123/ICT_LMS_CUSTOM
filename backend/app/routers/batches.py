import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.batch import BatchCreate, BatchUpdate, BatchOut, BatchStudentEnroll, BatchCourseLink
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
async def create_batch(
    body: BatchCreate,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
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
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await verify_batch_access(session, current_user, batch_id)
    return await batch_service.list_batch_students(session, batch_id, institute_id=current_user.institute_id)


@router.post("/{batch_id}/students", status_code=status.HTTP_201_CREATED)
async def enroll_student(
    batch_id: uuid.UUID,
    body: BatchStudentEnroll,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        sb = await batch_service.enroll_student(
            session, batch_id, body.student_id, current_user.id,
            institute_id=current_user.institute_id,
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

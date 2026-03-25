import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.course import CourseCreate, CourseUpdate, CourseOut
from app.schemas.common import PaginatedResponse
from app.services import course_service
from app.middleware.auth import require_roles, get_current_user
from app.models.user import User

router = APIRouter()

CC = Annotated[User, Depends(require_roles("admin", "course_creator"))]
AdminOrCC = Annotated[User, Depends(require_roles("admin", "course_creator"))]
AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[CourseOut])
async def list_courses(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    batch_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
):
    items, total = await course_service.list_courses(
        session, current_user, page=page, per_page=per_page,
        status_filter=status, batch_id=batch_id, search=search,
        institute_id=current_user.institute_id,
    )
    return PaginatedResponse(
        data=[CourseOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def create_course(
    body: CourseCreate,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    course = await course_service.create_course(
        session, title=body.title, description=body.description,
        created_by=current_user.id, institute_id=current_user.institute_id,
    )
    data = await course_service.get_course(session, course.id, institute_id=current_user.institute_id)
    return CourseOut(**data)


@router.get("/{course_id}", response_model=CourseOut)
async def get_course(
    course_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await course_service.get_course(session, course_id, institute_id=current_user.institute_id)
    if not data:
        raise HTTPException(status_code=404, detail="Course not found")
    return CourseOut(**data)


@router.patch("/{course_id}", response_model=CourseOut)
async def update_course(
    course_id: uuid.UUID,
    body: CourseUpdate,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await course_service.update_course(session, course_id, institute_id=current_user.institute_id, **body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    data = await course_service.get_course(session, course_id, institute_id=current_user.institute_id)
    return CourseOut(**data)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: uuid.UUID,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await course_service.soft_delete_course(session, course_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{course_id}/clone", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def clone_course(
    course_id: uuid.UUID,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        course = await course_service.clone_course(
            session, course_id, current_user.id, institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    data = await course_service.get_course(session, course.id, institute_id=current_user.institute_id)
    return CourseOut(**data)

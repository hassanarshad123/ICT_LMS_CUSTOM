import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.schemas.course import CourseCreate, CourseUpdate, CourseOut
from app.schemas.common import PaginatedResponse
from app.services import course_service
from app.middleware.auth import get_current_user
from app.rbac.dependencies import require_permissions
from app.models.user import User
from app.models.course import Course
from app.utils.s3 import upload_object, delete_object, generate_view_url, _prefix
from app.utils.rate_limit import limiter

router = APIRouter()

CanViewCourses = Annotated[User, Depends(require_permissions("courses.view"))]
CanCreateCourses = Annotated[User, Depends(require_permissions("courses.create"))]
CanEditCourses = Annotated[User, Depends(require_permissions("courses.edit"))]
CanDeleteCourses = Annotated[User, Depends(require_permissions("courses.delete"))]
CanCloneCourses = Annotated[User, Depends(require_permissions("courses.clone"))]
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
@limiter.limit("30/minute")
async def create_course(
    request: Request,
    body: CourseCreate,
    current_user: CanCreateCourses,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.utils.plan_limits import check_creation_limit
    try:
        await check_creation_limit(session, current_user.institute_id, "courses")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

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
    current_user: CanEditCourses,
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
    current_user: CanDeleteCourses,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await course_service.soft_delete_course(session, course_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{course_id}/clone", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def clone_course(
    request: Request,
    course_id: uuid.UUID,
    current_user: CanCloneCourses,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.utils.plan_limits import check_creation_limit
    try:
        await check_creation_limit(session, current_user.institute_id, "courses")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        course = await course_service.clone_course(
            session, course_id, current_user.id, institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    data = await course_service.get_course(session, course.id, institute_id=current_user.institute_id)
    return CourseOut(**data)


_ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
_MAX_COVER_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/{course_id}/cover")
@limiter.limit("10/hour")
async def upload_course_cover(
    request: Request,
    course_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: CanEditCourses = None,
    session: AsyncSession = Depends(get_session),
):
    # Validate content type
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="File must be PNG, JPG, or WebP")

    content = await file.read()
    if len(content) > _MAX_COVER_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")

    # Fetch course
    result = await session.execute(
        select(Course).where(
            Course.id == course_id,
            Course.deleted_at.is_(None),
            Course.institute_id == current_user.institute_id,
        )
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Delete old cover if exists
    if course.cover_image_key:
        try:
            delete_object(course.cover_image_key)
        except Exception:
            pass  # Best-effort cleanup

    # Determine file extension from content type
    ext_map = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
    ext = ext_map.get(file.content_type, "jpg")

    # Upload to S3
    object_key = _prefix(
        current_user.institute_id,
        f"courses/{course_id}/cover_{uuid.uuid4()}.{ext}",
    )
    upload_object(content, object_key, file.content_type)

    # Save key in model
    course.cover_image_key = object_key
    session.add(course)
    await session.commit()

    return {"cover_image_url": generate_view_url(object_key)}


@router.delete("/{course_id}/cover", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course_cover(
    course_id: uuid.UUID,
    current_user: CanEditCourses = None,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Course).where(
            Course.id == course_id,
            Course.deleted_at.is_(None),
            Course.institute_id == current_user.institute_id,
        )
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.cover_image_key:
        try:
            delete_object(course.cover_image_key)
        except Exception:
            pass  # Best-effort cleanup
        course.cover_image_key = None
        session.add(course)
        await session.commit()

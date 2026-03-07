import uuid
import math
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.lecture import (
    LectureCreate, LectureUpdate, LectureOut,
    LectureReorderRequest, ProgressUpdate, ProgressOut,
)
from app.schemas.common import PaginatedResponse
from app.services import lecture_service
from app.middleware.auth import require_roles, get_current_user
from app.models.user import User
from app.utils.formatters import format_duration

router = APIRouter()

CC = Annotated[User, Depends(require_roles("course_creator"))]
Student = Annotated[User, Depends(require_roles("student"))]
AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[LectureOut])
async def list_lectures(
    batch_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    course_id: Optional[uuid.UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    items, total = await lecture_service.list_lectures(
        session, batch_id, course_id=course_id, page=page, per_page=per_page,
    )
    return PaginatedResponse(
        data=[LectureOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("", response_model=LectureOut, status_code=status.HTTP_201_CREATED)
async def create_lecture(
    body: LectureCreate,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    lecture = await lecture_service.create_lecture(
        session, title=body.title, batch_id=body.batch_id,
        video_type=body.video_type, created_by=current_user.id,
        description=body.description, video_url=body.video_url,
        duration=body.duration, course_id=body.course_id,
    )
    return LectureOut(
        id=lecture.id, title=lecture.title, description=lecture.description,
        video_type=lecture.video_type.value, video_url=lecture.video_url,
        bunny_video_id=lecture.bunny_video_id, duration=lecture.duration,
        duration_display=format_duration(lecture.duration),
        file_size=lecture.file_size, batch_id=lecture.batch_id,
        course_id=lecture.course_id, sequence_order=lecture.sequence_order,
        thumbnail_url=lecture.thumbnail_url, upload_date=lecture.created_at,
        created_at=lecture.created_at,
    )


@router.post("/upload", response_model=LectureOut, status_code=status.HTTP_201_CREATED)
async def upload_lecture(
    title: str = Form(...),
    batch_id: uuid.UUID = Form(...),
    video: UploadFile = File(...),
    current_user: User = Depends(require_roles("course_creator")),
    session: AsyncSession = Depends(get_session),
    description: Optional[str] = Form(None),
    course_id: Optional[uuid.UUID] = Form(None),
    duration: Optional[int] = Form(None),
):
    from app.utils.bunny import upload_video

    file_data = await video.read()
    result = await upload_video(title, file_data)

    lecture = await lecture_service.create_lecture(
        session, title=title, batch_id=batch_id,
        video_type="upload", created_by=current_user.id,
        description=description, course_id=course_id,
        duration=duration, bunny_video_id=result["video_id"],
        bunny_library_id=result["library_id"],
        file_size=len(file_data),
    )
    return LectureOut(
        id=lecture.id, title=lecture.title, description=lecture.description,
        video_type=lecture.video_type.value, video_url=lecture.video_url,
        bunny_video_id=lecture.bunny_video_id, duration=lecture.duration,
        duration_display=format_duration(lecture.duration),
        file_size=lecture.file_size, batch_id=lecture.batch_id,
        course_id=lecture.course_id, sequence_order=lecture.sequence_order,
        thumbnail_url=lecture.thumbnail_url, upload_date=lecture.created_at,
        created_at=lecture.created_at,
    )


@router.get("/{lecture_id}", response_model=LectureOut)
async def get_lecture(
    lecture_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    lecture = await lecture_service.get_lecture(session, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return LectureOut(
        id=lecture.id, title=lecture.title, description=lecture.description,
        video_type=lecture.video_type.value, video_url=lecture.video_url,
        bunny_video_id=lecture.bunny_video_id, duration=lecture.duration,
        duration_display=format_duration(lecture.duration),
        file_size=lecture.file_size, batch_id=lecture.batch_id,
        course_id=lecture.course_id, sequence_order=lecture.sequence_order,
        thumbnail_url=lecture.thumbnail_url, upload_date=lecture.created_at,
        created_at=lecture.created_at,
    )


@router.patch("/{lecture_id}", response_model=LectureOut)
async def update_lecture(
    lecture_id: uuid.UUID,
    body: LectureUpdate,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        lecture = await lecture_service.update_lecture(
            session, lecture_id, **body.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return LectureOut(
        id=lecture.id, title=lecture.title, description=lecture.description,
        video_type=lecture.video_type.value, video_url=lecture.video_url,
        bunny_video_id=lecture.bunny_video_id, duration=lecture.duration,
        duration_display=format_duration(lecture.duration),
        file_size=lecture.file_size, batch_id=lecture.batch_id,
        course_id=lecture.course_id, sequence_order=lecture.sequence_order,
        thumbnail_url=lecture.thumbnail_url, upload_date=lecture.created_at,
        created_at=lecture.created_at,
    )


@router.delete("/{lecture_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lecture(
    lecture_id: uuid.UUID,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await lecture_service.soft_delete_lecture(session, lecture_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{lecture_id}/reorder", response_model=LectureOut)
async def reorder_lecture(
    lecture_id: uuid.UUID,
    body: LectureReorderRequest,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        lecture = await lecture_service.reorder_lecture(session, lecture_id, body.sequence_order)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return LectureOut(
        id=lecture.id, title=lecture.title, description=lecture.description,
        video_type=lecture.video_type.value, video_url=lecture.video_url,
        bunny_video_id=lecture.bunny_video_id, duration=lecture.duration,
        duration_display=format_duration(lecture.duration),
        file_size=lecture.file_size, batch_id=lecture.batch_id,
        course_id=lecture.course_id, sequence_order=lecture.sequence_order,
        thumbnail_url=lecture.thumbnail_url, upload_date=lecture.created_at,
        created_at=lecture.created_at,
    )


@router.post("/{lecture_id}/signed-url")
async def get_signed_url(
    lecture_id: uuid.UUID,
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.utils.bunny import generate_signed_url

    lecture = await lecture_service.get_lecture(session, lecture_id)
    if not lecture or not lecture.bunny_video_id:
        raise HTTPException(status_code=404, detail="Lecture video not found")

    url, expires_at = generate_signed_url(lecture.bunny_video_id)
    return {
        "url": url,
        "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
    }


@router.post("/{lecture_id}/progress", response_model=ProgressOut)
async def update_progress(
    lecture_id: uuid.UUID,
    body: ProgressUpdate,
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    progress = await lecture_service.upsert_progress(
        session, student_id=current_user.id, lecture_id=lecture_id,
        watch_percentage=body.watch_percentage,
        resume_position_seconds=body.resume_position_seconds,
    )
    return ProgressOut(
        lecture_id=progress.lecture_id,
        watch_percentage=progress.watch_percentage,
        resume_position_seconds=progress.resume_position_seconds,
        status=progress.status.value,
    )


@router.get("/{lecture_id}/progress", response_model=ProgressOut)
async def get_progress(
    lecture_id: uuid.UUID,
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    progress = await lecture_service.get_progress(session, current_user.id, lecture_id)
    if not progress:
        return ProgressOut(
            lecture_id=lecture_id, watch_percentage=0,
            resume_position_seconds=0, status="unwatched",
        )
    return ProgressOut(
        lecture_id=progress.lecture_id,
        watch_percentage=progress.watch_percentage,
        resume_position_seconds=progress.resume_position_seconds,
        status=progress.status.value,
    )

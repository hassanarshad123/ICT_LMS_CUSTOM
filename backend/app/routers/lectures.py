import logging
import uuid
import math
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.schemas.lecture import (
    LectureCreate, LectureUpdate, LectureOut, UploadInitRequest,
    LectureReorderRequest, ProgressUpdate, ProgressOut,
)
from app.schemas.common import PaginatedResponse
from app.services import lecture_service
from app.middleware.auth import require_roles, get_current_user
from app.models.user import User
from app.models.batch import StudentBatch
from app.utils.formatters import format_duration
from app.utils.rate_limit import limiter
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()

CC = Annotated[User, Depends(require_roles("course_creator"))]
Student = Annotated[User, Depends(require_roles("student"))]
AllRoles = Annotated[User, Depends(get_current_user)]


def _lecture_out(lecture) -> LectureOut:
    return LectureOut(
        id=lecture.id, title=lecture.title, description=lecture.description,
        video_type=lecture.video_type.value, video_url=lecture.video_url,
        bunny_video_id=lecture.bunny_video_id, video_status=lecture.video_status,
        duration=lecture.duration, duration_display=format_duration(lecture.duration),
        file_size=lecture.file_size, batch_id=lecture.batch_id,
        course_id=lecture.course_id, sequence_order=lecture.sequence_order,
        thumbnail_url=lecture.thumbnail_url, upload_date=lecture.created_at,
        created_at=lecture.created_at,
    )


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
    return _lecture_out(lecture)


@router.post("/upload-init", status_code=status.HTTP_201_CREATED)
async def upload_init(
    body: UploadInitRequest,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create a Bunny video entry + lecture record, return TUS upload credentials."""
    from app.utils.bunny import create_video_entry, generate_tus_auth
    import httpx as _httpx

    # 1. Create Bunny video entry
    try:
        result = await create_video_entry(body.title)
    except (_httpx.HTTPStatusError, _httpx.ConnectError, _httpx.TimeoutException) as exc:
        logger.error("Bunny create_video_entry failed: %s", exc)
        raise HTTPException(status_code=503, detail="Video service unavailable. Please try again later.")
    video_id = result["video_id"]
    library_id = result["library_id"]

    # 2. Create lecture record
    lecture = await lecture_service.create_lecture(
        session, title=body.title, batch_id=body.batch_id,
        video_type="upload", created_by=current_user.id,
        description=body.description, course_id=body.course_id,
        duration=body.duration, bunny_video_id=video_id,
        bunny_library_id=library_id, video_status="pending",
    )

    # 3. Generate TUS auth
    tus = generate_tus_auth(video_id)

    return {
        "lecture": _lecture_out(lecture),
        "tus_endpoint": tus["tus_endpoint"],
        "auth_signature": tus["auth_signature"],
        "auth_expire": tus["auth_expire"],
        "video_id": tus["video_id"],
        "library_id": tus["library_id"],
    }


@router.post("/bunny-webhook")
async def bunny_webhook(request: Request):
    """Handle Bunny Stream encoding webhooks."""
    body = await request.json()
    video_guid = body.get("VideoGuid")
    if not video_guid:
        return {"status": "ignored"}

    # Validate that this VideoGuid belongs to a lecture we know about
    from app.database import async_session as _async_session
    async with _async_session() as _sess:
        from sqlmodel import select as _select
        from app.models.course import Lecture as _Lecture
        check = await _sess.execute(
            _select(_Lecture.id).where(
                _Lecture.bunny_video_id == video_guid,
                _Lecture.deleted_at.is_(None),
            )
        )
        if not check.scalar_one_or_none():
            return {"status": "ignored"}

    # Map Bunny status to our status
    bunny_status = body.get("Status", -1)
    if bunny_status in (3, 4):  # finished / resolution_finished
        new_status = "ready"
    elif bunny_status == 5:  # failed
        new_status = "failed"
    elif bunny_status in (0, 1, 2):  # queued / processing / encoding
        new_status = "processing"
    else:
        return {"status": "ignored"}

    from app.database import async_session

    async with async_session() as session:
        await lecture_service.update_lecture_status(session, video_guid, new_status)

    return {"status": "ok"}


@router.get("/{lecture_id}", response_model=LectureOut)
async def get_lecture(
    lecture_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    lecture = await lecture_service.get_lecture(session, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return _lecture_out(lecture)


@router.get("/{lecture_id}/status")
async def get_lecture_status(
    lecture_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get video processing status, polling Bunny if needed."""
    lecture = await lecture_service.get_lecture(session, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    current_status = lecture.video_status

    # Only poll Bunny if upload is still processing
    if (
        lecture.video_type.value == "upload"
        and lecture.bunny_video_id
        and current_status in ("pending", "processing")
    ):
        from app.utils.bunny import get_video_status
        try:
            new_status = await get_video_status(lecture.bunny_video_id)
            if new_status != current_status:
                lecture.video_status = new_status
                lecture.updated_at = datetime.now(timezone.utc)
                session.add(lecture)
                await session.commit()
                current_status = new_status
        except Exception as exc:
            logger.warning("Bunny status poll failed for video %s: %s", lecture.bunny_video_id, exc)

    return {"video_status": current_status, "lecture_id": str(lecture.id)}


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
    return _lecture_out(lecture)


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
    return _lecture_out(lecture)


@router.post("/{lecture_id}/signed-url")
@limiter.limit("30/minute")
async def get_signed_url(
    lecture_id: uuid.UUID,
    request: Request,
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Generate a signed embed URL. Checks enrollment for students."""
    lecture = await lecture_service.get_lecture(session, lecture_id)
    if not lecture or lecture.deleted_at:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Enrollment check — student must be in the lecture's batch
    enrolled = await session.execute(
        select(StudentBatch).where(
            StudentBatch.student_id == current_user.id,
            StudentBatch.batch_id == lecture.batch_id,
            StudentBatch.removed_at.is_(None),
        )
    )
    if not enrolled.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not enrolled in this batch")

    if lecture.video_type.value == "upload":
        if not lecture.bunny_video_id or lecture.video_status != "ready":
            raise HTTPException(status_code=409, detail="Video not ready for playback")
        from app.utils.bunny import generate_embed_token
        embed_url, expires_at = generate_embed_token(lecture.bunny_video_id)
        return {
            "url": embed_url,
            "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
            "type": "bunny_embed",
        }
    elif lecture.video_type.value == "external":
        return {
            "url": lecture.video_url,
            "expires_at": None,
            "type": "external",
        }
    else:
        raise HTTPException(status_code=400, detail="No video available for this lecture")


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

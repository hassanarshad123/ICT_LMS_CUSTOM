"""Feedback & error reporting endpoints."""
import logging
import math
import uuid
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackStatusUpdate,
    FeedbackResponseCreate,
    FeedbackUploadUrlRequest,
    FeedbackUploadUrlResponse,
    FeedbackOut,
    FeedbackListOut,
    FeedbackResponseOut,
    FeedbackAnalyticsResponse,
)
from app.schemas.common import PaginatedResponse
from app.services import feedback_service
from app.middleware.auth import get_current_user, require_roles
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

from app.utils.rate_limit import limiter

AllRoles = Annotated[User, Depends(get_current_user)]
SA = Annotated[User, Depends(require_roles("super_admin"))]


@router.post("/upload-url", response_model=FeedbackUploadUrlResponse)
@limiter.limit("20/minute")
async def get_upload_url(
    request: Request,
    body: FeedbackUploadUrlRequest,
    user: AllRoles,
):
    """Get a presigned S3 URL for uploading a feedback screenshot."""
    allowed = {"image/png", "image/jpeg", "image/webp"}
    if body.content_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only image types allowed: {', '.join(allowed)}",
        )
    if body.file_size and body.file_size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be under 5MB",
        )

    url, object_key = feedback_service.generate_feedback_upload_url(
        file_name=body.file_name,
        content_type=body.content_type,
        institute_id=user.institute_id,
    )
    return FeedbackUploadUrlResponse(upload_url=url, object_key=object_key)


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    body: FeedbackCreate,
    user: AllRoles,
    session: AsyncSession = Depends(get_session),
):
    """Submit new feedback (all roles)."""
    data = body.model_dump()
    try:
        result = await feedback_service.create_feedback(session, user, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.get("")
async def list_feedbacks(
    user: AllRoles,
    session: AsyncSession = Depends(get_session),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    feedback_type: Optional[str] = None,
    feedback_status: Optional[str] = Query(None, alias="status"),
    institute_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    rating: Optional[int] = Query(None, ge=1, le=5),
):
    """List feedbacks. SA: all with filters. Others: own only."""
    items, total = await feedback_service.list_feedbacks(
        session=session,
        current_user=user,
        page=page,
        per_page=per_page,
        feedback_type=feedback_type,
        status=feedback_status,
        institute_id=institute_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        rating=rating,
    )
    return {
        "data": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": math.ceil(total / per_page) if per_page else 0,
    }


@router.get("/analytics")
async def get_analytics(
    user: SA,
    session: AsyncSession = Depends(get_session),
    period: int = Query(30, ge=7, le=365),
):
    """SA-only: feedback analytics dashboard data."""
    return await feedback_service.get_feedback_analytics(session, period)


@router.get("/{feedback_id}")
async def get_feedback_detail(
    feedback_id: uuid.UUID,
    user: AllRoles,
    session: AsyncSession = Depends(get_session),
):
    """Get feedback detail. SA: full view. Others: own only."""
    result = await feedback_service.get_feedback(session, feedback_id, user)
    if not result:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result


@router.patch("/{feedback_id}/status")
async def update_status(
    feedback_id: uuid.UUID,
    body: FeedbackStatusUpdate,
    user: SA,
    session: AsyncSession = Depends(get_session),
):
    """SA-only: update feedback status."""
    try:
        result = await feedback_service.update_feedback_status(
            session, feedback_id, body.status,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result


@router.post("/{feedback_id}/responses", status_code=status.HTTP_201_CREATED)
async def add_response(
    feedback_id: uuid.UUID,
    body: FeedbackResponseCreate,
    user: SA,
    session: AsyncSession = Depends(get_session),
):
    """SA-only: add response or internal note to feedback."""
    result = await feedback_service.add_feedback_response(
        session=session,
        feedback_id=feedback_id,
        responder_id=user.id,
        message=body.message,
        is_internal=body.is_internal,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result


@router.delete("/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(
    feedback_id: uuid.UUID,
    user: SA,
    session: AsyncSession = Depends(get_session),
):
    """SA-only: soft-delete feedback."""
    deleted = await feedback_service.soft_delete_feedback(session, feedback_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Feedback not found")

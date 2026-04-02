import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Client context (auto-captured by frontend) ──

class ClientContext(BaseModel):
    page_url: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    screen_size: Optional[str] = None
    user_agent: Optional[str] = None
    recent_console_errors: Optional[list[str]] = None


# ── Feedback CRUD ──

class FeedbackCreate(BaseModel):
    feedback_type: str
    subject: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=5000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    is_anonymous: bool = False
    client_context: Optional[ClientContext] = None
    # Attachment refs (S3 keys from presigned upload)
    attachment_keys: Optional[list[str]] = None
    attachment_names: Optional[list[str]] = None
    attachment_content_types: Optional[list[str]] = None
    attachment_sizes: Optional[list[int]] = None


class FeedbackStatusUpdate(BaseModel):
    status: str


# ── Attachment output ──

class FeedbackAttachmentOut(BaseModel):
    id: uuid.UUID
    file_name: str
    content_type: str
    file_size: Optional[int] = None
    view_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Response CRUD ──

class FeedbackResponseCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    is_internal: bool = False


class FeedbackResponseOut(BaseModel):
    id: uuid.UUID
    feedback_id: uuid.UUID
    responder_id: uuid.UUID
    responder_name: Optional[str] = None
    message: str
    is_internal: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Feedback output (full detail) ──

class FeedbackOut(BaseModel):
    id: uuid.UUID
    feedback_type: str
    subject: str
    description: str
    rating: Optional[int] = None
    status: str
    is_anonymous: bool
    user_id: Optional[uuid.UUID] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    institute_id: Optional[uuid.UUID] = None
    institute_name: Optional[str] = None
    client_context: Optional[dict] = None
    attachments: list[FeedbackAttachmentOut] = []
    responses: list[FeedbackResponseOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Feedback list item (lightweight) ──

class FeedbackListOut(BaseModel):
    id: uuid.UUID
    feedback_type: str
    subject: str
    rating: Optional[int] = None
    status: str
    is_anonymous: bool
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    institute_id: Optional[uuid.UUID] = None
    institute_name: Optional[str] = None
    attachment_count: int = 0
    response_count: int = 0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Presigned upload ──

class FeedbackUploadUrlRequest(BaseModel):
    file_name: str
    content_type: str
    file_size: Optional[int] = None


class FeedbackUploadUrlResponse(BaseModel):
    upload_url: str
    object_key: str


# ── Analytics ──

class FeedbackAnalyticsResponse(BaseModel):
    total_count: int
    by_type: dict[str, int]
    by_status: dict[str, int]
    by_institute: list[dict]
    avg_rating: Optional[float] = None
    rating_distribution: dict[int, int]
    unresolved_count: int
    avg_response_time_hours: Optional[float] = None
    satisfaction_trend: list[dict]
    volume_trend: list[dict]
    top_feature_requests: list[dict]

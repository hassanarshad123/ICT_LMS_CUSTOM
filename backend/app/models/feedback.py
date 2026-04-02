import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, Boolean, Integer, ForeignKey, Index
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, JSONB, UUID as PG_UUID

from app.models.enums import FeedbackType, FeedbackStatus


class Feedback(SQLModel, table=True):
    __tablename__ = "feedbacks"
    __table_args__ = (
        Index("ix_feedbacks_institute_id_status", "institute_id", "status"),
        Index("ix_feedbacks_type_created", "feedback_type", "created_at"),
        Index("ix_feedbacks_user_id", "user_id"),
        Index("ix_feedbacks_status", "status"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    feedback_type: FeedbackType = Field(
        sa_column=Column(
            SAEnum(FeedbackType, name="feedback_type", create_type=False),
            nullable=False,
        )
    )
    subject: str = Field(nullable=False)
    description: str = Field(sa_column=Column(Text, nullable=False))
    rating: Optional[int] = Field(
        default=None, sa_column=Column(Integer, nullable=True),
    )

    status: FeedbackStatus = Field(
        sa_column=Column(
            SAEnum(FeedbackStatus, name="feedback_status", create_type=False),
            nullable=False,
            server_default="submitted",
        )
    )

    is_anonymous: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )

    # User context — always stored; anonymity enforced at API layer
    user_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False),
    )
    user_role: Optional[str] = Field(default=None)

    # Client context (JSONB) — page URL, browser, OS, screen size, linked errors
    client_context: Optional[dict] = Field(
        default=None, sa_column=Column(JSONB),
    )

    # Multi-tenant
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )

    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    deleted_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )


class FeedbackAttachment(SQLModel, table=True):
    __tablename__ = "feedback_attachments"
    __table_args__ = (
        Index("ix_feedback_attachments_feedback_id", "feedback_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    feedback_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("feedbacks.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    object_key: str = Field(nullable=False)
    file_name: str = Field(nullable=False)
    content_type: str = Field(nullable=False)
    file_size: Optional[int] = Field(
        default=None, sa_column=Column(Integer),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class FeedbackResponse(SQLModel, table=True):
    __tablename__ = "feedback_responses"
    __table_args__ = (
        Index("ix_feedback_responses_feedback_id", "feedback_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    feedback_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("feedbacks.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    responder_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False),
    )
    message: str = Field(sa_column=Column(Text, nullable=False))
    is_internal: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )

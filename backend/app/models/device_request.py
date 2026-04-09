"""Device limit approval request model.

Persists pending/approved/rejected requests from users who hit the hard
device limit. Lives alongside ``UserSession`` but is a separate table —
each row captures *who* is asking for access from *what* device, plus the
review outcome.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, ForeignKey, Index
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID

from app.models.enums import DeviceLimitRequestStatus


class DeviceLimitRequest(SQLModel, table=True):
    __tablename__ = "device_limit_requests"
    __table_args__ = (
        Index("ix_device_limit_requests_user_id", "user_id"),
        Index("ix_device_limit_requests_institute_id_status", "institute_id", "status"),
        Index("ix_device_limit_requests_status_created", "status", "created_at"),
        Index("ix_device_limit_requests_polling_token_hash", "polling_token_hash"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # Who is asking
    user_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
        ),
    )
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True,
        ),
    )

    # Captured request context (server-side, not trusted from client)
    requested_device_info: Optional[str] = Field(
        default=None, sa_column=Column(Text, nullable=True),
    )
    requested_ip: Optional[str] = Field(default=None)

    # State machine
    status: DeviceLimitRequestStatus = Field(
        sa_column=Column(
            SAEnum(DeviceLimitRequestStatus, name="device_limit_request_status", create_type=False),
            nullable=False,
            server_default="pending",
        )
    )

    # Polling secret — only sha256 is stored; raw token is returned once to the
    # waiting device and never persisted server-side in plaintext.
    polling_token_hash: str = Field(nullable=False)

    # Review metadata
    reviewed_by: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
        ),
    )
    reviewed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    rejection_reason: Optional[str] = Field(
        default=None, sa_column=Column(Text, nullable=True),
    )

    # Which existing session was terminated to make room (set on approval)
    terminated_session_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("user_sessions.id"),
            nullable=True,
        ),
    )

    # Marked when the waiting device has polled and received its tokens —
    # prevents the approved tokens from being redeemed twice.
    consumed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )

    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )

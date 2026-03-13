import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID


class UserSession(SQLModel, table=True):
    __tablename__ = "user_sessions"
    __table_args__ = (
        UniqueConstraint("session_token", name="uq_user_sessions_token"),
        Index("ix_user_sessions_user_id", "user_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    session_token: str = Field(nullable=False)
    device_info: Optional[str] = Field(default=None)
    ip_address: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    logged_in_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    last_active_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    expires_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )

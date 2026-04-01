import uuid
from datetime import datetime
from typing import Optional
import enum

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import BigInteger, UniqueConstraint, Index, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID


class InstituteStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    trial = "trial"


class PlanTier(str, enum.Enum):
    free = "free"
    basic = "basic"
    pro = "pro"
    enterprise = "enterprise"


class Institute(SQLModel, table=True):
    __tablename__ = "institutes"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_institutes_slug"),
        Index("ix_institutes_slug", "slug"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(nullable=False)
    slug: str = Field(nullable=False)
    status: InstituteStatus = Field(
        sa_column=Column(
            SAEnum(InstituteStatus, name="institute_status", create_type=True),
            nullable=False,
            server_default="trial",
        )
    )
    plan_tier: PlanTier = Field(
        sa_column=Column(
            SAEnum(PlanTier, name="plan_tier", create_type=True),
            nullable=False,
            server_default="free",
        )
    )
    max_users: int = Field(default=10, nullable=False)
    max_storage_gb: float = Field(default=1.0, nullable=False)
    max_video_gb: float = Field(default=5.0, nullable=False)
    contact_email: str = Field(nullable=False)
    expires_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
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
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
    )


class InstituteUsage(SQLModel, table=True):
    __tablename__ = "institute_usage"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False, unique=True)
    )
    current_users: int = Field(default=0, nullable=False)
    current_storage_bytes: int = Field(
        default=0,
        sa_column=Column(BigInteger, nullable=False, server_default="0"),
    )
    current_video_bytes: int = Field(
        default=0,
        sa_column=Column(BigInteger, nullable=False, server_default="0"),
    )
    last_calculated_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
    )

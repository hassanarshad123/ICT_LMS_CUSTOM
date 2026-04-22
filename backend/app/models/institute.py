import uuid
from datetime import datetime
from typing import Optional
import enum

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import BigInteger, UniqueConstraint, Index, Enum as SAEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID


class InstituteStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    trial = "trial"
    archived = "archived"


class PlanTier(str, enum.Enum):
    # v2 canonical tiers (used by all new signups from pricing-v2 launch onward).
    # See docs/pricing-model-v2.md for the full spec.
    professional = "professional"  # Free forever — 10 students + 10 GB docs + 50 GB video included; Rs 80/mo per extra student
    custom = "custom"              # Quoted per deal — volume discount + dedicated infra + white-label

    # Internal SA-only tier: truly unlimited, fully comped. Excluded from the
    # v2 billing engine (no invoices, no late-payment enforcement). Assigned
    # by Super Admin only for partner / founding / internal institutes.
    unlimited = "unlimited"

    # Grandfathered tiers — preserved so existing paying institutes keep their
    # current plan and are never touched by the v2 billing engine.
    # The v2 billing cron explicitly filters to plan_tier IN ('professional', 'custom').
    free = "free"          # 14-day trial — retired for new signups in v2
    starter = "starter"    # Rs 2,500/mo — 50 students
    basic = "basic"        # Rs 5,000/mo — 250 students
    pro = "pro"            # Rs 15,000/mo — 1,000 students
    enterprise = "enterprise"  # From Rs 50,000/mo — unlimited


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
    max_users: int = Field(default=10, nullable=False)  # total users (students + staff) — SA visibility only, not a gate
    max_students: int = Field(default=15, nullable=False)  # student-only cap; gated in check_and_increment_student_quota
    max_storage_gb: float = Field(default=1.0, nullable=False)
    max_video_gb: float = Field(default=5.0, nullable=False)
    contact_email: str = Field(nullable=False)
    # v2 pricing (pricing-model-v2): set by the late-payment scheduler when an
    # invoice is overdue. Values: None (normal), "add_blocked" (day 15+ overdue,
    # POST /users + uploads refused), "read_only" (day 30+, all writes refused).
    # Only applied to v2 billing tiers (professional, custom) — grandfathered
    # tiers are never touched by the v2 late-payment enforcement.
    billing_restriction: Optional[str] = Field(
        default=None,
        sa_column=Column(String(16), nullable=True),
    )
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

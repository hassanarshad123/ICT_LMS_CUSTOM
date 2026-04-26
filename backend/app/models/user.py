import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlmodel import SQLModel, Field, Column, Relationship
import sqlalchemy as sa
from sqlalchemy import Boolean, Enum as SAEnum, UniqueConstraint, Index, ForeignKey
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID

from app.models.enums import UserRole, UserStatus

if TYPE_CHECKING:
    from app.models.institute import Institute


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "uq_user_email_institute",
            "email", "institute_id",
            unique=True,
            postgresql_where=Column("deleted_at").is_(None),
        ),
        Index(
            "uq_user_employee_id_institute",
            "institute_id", "employee_id",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL AND employee_id IS NOT NULL"),
        ),
        Index(
            "ix_users_suspension_reason",
            "suspension_reason",
            unique=False,
            postgresql_where=sa.text("suspension_reason IS NOT NULL"),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(nullable=False)  # uniqueness enforced by composite index above
    name: str = Field(nullable=False)
    phone: Optional[str] = Field(default=None)
    cnic_no: Optional[str] = Field(default=None)
    father_name: Optional[str] = Field(default=None)
    hashed_password: str = Field(nullable=False)
    role: UserRole = Field(
        sa_column=Column(SAEnum(UserRole, name="user_role", create_type=False), nullable=False)
    )
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )
    specialization: Optional[str] = Field(default=None)
    avatar_url: Optional[str] = Field(default=None)
    status: UserStatus = Field(
        sa_column=Column(
            SAEnum(UserStatus, name="user_status", create_type=False),
            nullable=False,
            server_default="active",
        )
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
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    email_verified: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    token_version: int = Field(default=0, nullable=False)
    failed_login_attempts: int = Field(default=0, nullable=False)
    locked_until: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    employee_id: Optional[str] = Field(
        default=None,
        sa_column=Column(sa.String(64), nullable=True),
    )
    suspension_reason: Optional[str] = Field(
        default=None,
        sa_column=Column(sa.String(64), nullable=True),
    )

    institute: Optional["Institute"] = Relationship(
        sa_relationship_kwargs={"lazy": "noload", "foreign_keys": "[User.institute_id]"},
    )

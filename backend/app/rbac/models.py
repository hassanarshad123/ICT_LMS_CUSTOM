import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa
from sqlalchemy import ForeignKey, Index, UniqueConstraint, Enum as SAEnum, String, Boolean
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID

from app.models.enums import ViewType


class Permission(SQLModel, table=True):
    __tablename__ = "permissions"
    __table_args__ = (
        Index("ix_permissions_module", "module"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    code: str = Field(
        sa_column=Column(String(100), unique=True, nullable=False),
    )
    module: str = Field(sa_column=Column(String(50), nullable=False))
    action: str = Field(sa_column=Column(String(50), nullable=False))
    description: Optional[str] = Field(
        default=None, sa_column=Column(String(255), nullable=True),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class CustomRole(SQLModel, table=True):
    __tablename__ = "custom_roles"
    __table_args__ = (
        Index(
            "uq_custom_roles_slug_institute",
            "institute_id", "slug",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        Index("ix_custom_roles_institute", "institute_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False),
    )
    name: str = Field(sa_column=Column(String(100), nullable=False))
    slug: str = Field(sa_column=Column(String(100), nullable=False))
    description: Optional[str] = Field(
        default=None, sa_column=Column(String(500), nullable=True),
    )
    view_type: ViewType = Field(
        sa_column=Column(
            SAEnum(ViewType, name="view_type", create_type=True),
            nullable=False,
        )
    )
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="true"),
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


class CustomRolePermission(SQLModel, table=True):
    __tablename__ = "custom_role_permissions"
    __table_args__ = (
        UniqueConstraint("custom_role_id", "permission_id", name="uq_custom_role_permission"),
        Index("ix_crp_custom_role_id", "custom_role_id"),
        Index("ix_crp_permission_id", "permission_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    custom_role_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("custom_roles.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    permission_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("permissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )

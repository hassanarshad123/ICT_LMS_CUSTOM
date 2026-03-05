import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP

from app.models.enums import UserRole, UserStatus


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(nullable=False, unique=True)
    name: str = Field(nullable=False)
    phone: Optional[str] = Field(default=None)
    hashed_password: str = Field(nullable=False)
    role: UserRole = Field(
        sa_column=Column(SAEnum(UserRole, name="user_role", create_type=False), nullable=False)
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

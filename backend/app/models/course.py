import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, Integer, BigInteger, ARRAY, Index
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP

from app.models.enums import CourseStatus, VideoType, MaterialFileType


class Course(SQLModel, table=True):
    __tablename__ = "courses"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    status: CourseStatus = Field(
        sa_column=Column(
            SAEnum(CourseStatus, name="course_status", create_type=False),
            nullable=False,
            server_default="upcoming",
        )
    )
    cloned_from_id: Optional[uuid.UUID] = Field(default=None, foreign_key="courses.id")
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
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


class BatchCourse(SQLModel, table=True):
    __tablename__ = "batch_courses"
    __table_args__ = (
        Index("ix_batch_courses_batch_id", "batch_id"),
        Index("ix_batch_courses_course_id", "course_id"),
        Index(
            "uq_batch_course_active",
            "batch_id", "course_id",
            unique=True,
            postgresql_where=Column("deleted_at").is_(None),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    batch_id: uuid.UUID = Field(nullable=False, foreign_key="batches.id")
    course_id: uuid.UUID = Field(nullable=False, foreign_key="courses.id")
    assigned_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    assigned_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    deleted_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )


class Lecture(SQLModel, table=True):
    __tablename__ = "lectures"
    __table_args__ = (
        Index("ix_lectures_batch_id", "batch_id"),
        Index("ix_lectures_course_id", "course_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    batch_id: uuid.UUID = Field(nullable=False, foreign_key="batches.id")
    course_id: Optional[uuid.UUID] = Field(default=None, foreign_key="courses.id")
    title: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    duration: Optional[int] = Field(default=None)
    file_size: Optional[int] = Field(default=None, sa_column=Column(BigInteger))
    video_type: VideoType = Field(
        sa_column=Column(SAEnum(VideoType, name="video_type", create_type=False), nullable=False)
    )
    video_url: Optional[str] = Field(default=None)
    bunny_video_id: Optional[str] = Field(default=None)
    bunny_library_id: Optional[str] = Field(default=None)
    video_status: Optional[str] = Field(default="pending", nullable=True)
    thumbnail_url: Optional[str] = Field(default=None)
    sequence_order: int = Field(nullable=False)
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
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


class CurriculumModule(SQLModel, table=True):
    __tablename__ = "curriculum_modules"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    course_id: uuid.UUID = Field(nullable=False, foreign_key="courses.id")
    title: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    sequence_order: int = Field(nullable=False)
    topics: Optional[list[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
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


class BatchMaterial(SQLModel, table=True):
    __tablename__ = "batch_materials"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    batch_id: uuid.UUID = Field(nullable=False, foreign_key="batches.id")
    course_id: Optional[uuid.UUID] = Field(default=None, foreign_key="courses.id")
    title: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    file_name: str = Field(nullable=False)
    file_path: str = Field(nullable=False)
    file_type: MaterialFileType = Field(
        sa_column=Column(
            SAEnum(MaterialFileType, name="material_file_type", create_type=False),
            nullable=False,
        )
    )
    file_size: Optional[int] = Field(default=None, sa_column=Column(BigInteger))
    mime_type: Optional[str] = Field(default=None)
    uploaded_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
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

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, Integer, Boolean, UniqueConstraint, Index, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID, JSONB

from app.models.enums import QuestionType, QuizAttemptStatus


class Quiz(SQLModel, table=True):
    __tablename__ = "quizzes"
    __table_args__ = (
        Index("ix_quizzes_course_id", "course_id"),
        Index("ix_quizzes_module_id", "module_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    course_id: uuid.UUID = Field(nullable=False, foreign_key="courses.id")
    module_id: Optional[uuid.UUID] = Field(default=None, foreign_key="curriculum_modules.id")
    title: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    time_limit_minutes: Optional[int] = Field(default=None)
    pass_percentage: int = Field(default=50)
    max_attempts: int = Field(default=1)
    is_published: bool = Field(default=False)
    sequence_order: int = Field(nullable=False)
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
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


class QuizQuestion(SQLModel, table=True):
    __tablename__ = "quiz_questions"
    __table_args__ = (
        Index("ix_quiz_questions_quiz_id", "quiz_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    quiz_id: uuid.UUID = Field(nullable=False, foreign_key="quizzes.id")
    question_type: QuestionType = Field(
        sa_column=Column(
            SAEnum(QuestionType, name="question_type", create_type=False),
            nullable=False,
        )
    )
    question_text: str = Field(sa_column=Column(Text, nullable=False))
    options: Optional[Any] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    correct_answer: str = Field(nullable=False)
    points: int = Field(default=1)
    sequence_order: int = Field(nullable=False)
    explanation: Optional[str] = Field(default=None)
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


class QuizAttempt(SQLModel, table=True):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        Index("ix_quiz_attempts_quiz_student", "quiz_id", "student_id"),
        Index("ix_quiz_attempts_student_id", "student_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    quiz_id: uuid.UUID = Field(nullable=False, foreign_key="quizzes.id")
    student_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    status: QuizAttemptStatus = Field(
        sa_column=Column(
            SAEnum(QuizAttemptStatus, name="quiz_attempt_status", create_type=False),
            nullable=False,
            server_default="in_progress",
        )
    )
    score: Optional[int] = Field(default=None)
    max_score: Optional[int] = Field(default=None)
    percentage: Optional[int] = Field(default=None)
    passed: Optional[bool] = Field(default=None)
    started_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    submitted_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    graded_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    graded_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )


class QuizAnswer(SQLModel, table=True):
    __tablename__ = "quiz_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_quiz_answer_attempt_question"),
        Index("ix_quiz_answers_attempt_id", "attempt_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    attempt_id: uuid.UUID = Field(nullable=False, foreign_key="quiz_attempts.id")
    question_id: uuid.UUID = Field(nullable=False, foreign_key="quiz_questions.id")
    answer_text: Optional[str] = Field(default=None)
    is_correct: Optional[bool] = Field(default=None)
    points_awarded: Optional[int] = Field(default=None)
    feedback: Optional[str] = Field(default=None)
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )

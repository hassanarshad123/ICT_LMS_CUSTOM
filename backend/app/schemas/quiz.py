import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Quiz ────────────────────────────────────────────────────────

class QuizCreate(BaseModel):
    course_id: uuid.UUID
    module_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    pass_percentage: Optional[int] = 50
    max_attempts: Optional[int] = 1


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    pass_percentage: Optional[int] = None
    max_attempts: Optional[int] = None
    is_published: Optional[bool] = None


class QuizOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    module_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    pass_percentage: int
    max_attempts: int
    is_published: bool
    sequence_order: int
    question_count: int = 0
    created_by: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Question ────────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    quiz_id: uuid.UUID
    question_type: str
    question_text: str
    options: Optional[dict] = None
    correct_answer: str
    points: Optional[int] = 1
    explanation: Optional[str] = None


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    options: Optional[dict] = None
    correct_answer: Optional[str] = None
    points: Optional[int] = None
    explanation: Optional[str] = None


class QuestionOut(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    question_type: str
    question_text: str
    options: Optional[dict] = None
    correct_answer: str
    points: int
    sequence_order: int
    explanation: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class QuestionOutStudent(BaseModel):
    """Question view for students — excludes correct_answer and explanation."""
    id: uuid.UUID
    quiz_id: uuid.UUID
    question_type: str
    question_text: str
    options: Optional[dict] = None
    points: int
    sequence_order: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Attempt ─────────────────────────────────────────────────────

class AnswerSubmit(BaseModel):
    question_id: uuid.UUID
    answer_text: str


class AttemptSubmit(BaseModel):
    answers: list[AnswerSubmit]


class AnswerOut(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    answer_text: Optional[str] = None
    is_correct: Optional[bool] = None
    points_awarded: Optional[int] = None
    feedback: Optional[str] = None

    model_config = {"from_attributes": True}


class AttemptOut(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    score: Optional[int] = None
    max_score: Optional[int] = None
    percentage: Optional[int] = None
    passed: Optional[bool] = None
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    graded_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AttemptDetailOut(AttemptOut):
    answers: list[AnswerOut] = []


# ── Grading ─────────────────────────────────────────────────────

class GradeAnswer(BaseModel):
    is_correct: bool
    points_awarded: int
    feedback: Optional[str] = None

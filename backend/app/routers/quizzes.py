import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.quiz import (
    QuizCreate, QuizUpdate, QuizOut,
    QuestionCreate, QuestionUpdate, QuestionOut, QuestionOutStudent,
    AttemptSubmit, AttemptOut, AttemptDetailOut,
    GradeAnswer, AnswerOut,
)
from app.schemas.common import PaginatedResponse
from app.services import quiz_service
from app.middleware.auth import require_roles, get_current_user
from app.models.user import User
from app.models.enums import UserRole

router = APIRouter()

CC = Annotated[User, Depends(require_roles("admin", "course_creator"))]
CCTeacher = Annotated[User, Depends(require_roles("admin", "course_creator", "teacher"))]
Student = Annotated[User, Depends(require_roles("student"))]
AllRoles = Annotated[User, Depends(get_current_user)]


# ── Quiz list & create (no path params) ─────────────────────────

@router.get("", response_model=list[QuizOut])
async def list_quizzes(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    course_id: uuid.UUID = Query(...),
    module_id: Optional[uuid.UUID] = None,
):
    items = await quiz_service.list_quizzes(
        session, course_id=course_id, module_id=module_id,
        institute_id=current_user.institute_id,
    )
    # Students see only published quizzes
    if current_user.role == UserRole.student:
        items = [i for i in items if i["is_published"]]
    return [QuizOut(**item) for item in items]


@router.post("", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    body: QuizCreate,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        quiz = await quiz_service.create_quiz(
            session, data=body.model_dump(), user_id=current_user.id,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    data = await quiz_service.get_quiz_with_count(
        session, quiz.id, institute_id=current_user.institute_id,
    )
    return QuizOut(**data)


# ── Literal-prefix routes (must come before /{quiz_id}) ─────────

@router.get("/my-attempts", response_model=list[AttemptOut])
async def my_attempts(
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
    course_id: Optional[uuid.UUID] = None,
):
    attempts = await quiz_service.list_my_attempts(
        session, student_id=current_user.id, course_id=course_id,
        institute_id=current_user.institute_id,
    )
    return [AttemptOut.model_validate(a) for a in attempts]


@router.get("/pending-grading", response_model=PaginatedResponse[AttemptOut])
async def pending_grading(
    current_user: CCTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=100),
):
    attempts, total = await quiz_service.list_pending_grading(
        session, institute_id=current_user.institute_id,
        page=page, per_page=per_page,
    )
    return PaginatedResponse(
        data=[AttemptOut.model_validate(a) for a in attempts],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.patch("/questions/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: uuid.UUID,
    body: QuestionUpdate,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        question = await quiz_service.update_question(
            session, question_id, data=body.model_dump(exclude_unset=True),
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return QuestionOut.model_validate(question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: uuid.UUID,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await quiz_service.delete_question(
            session, question_id, institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptOut)
async def submit_attempt(
    attempt_id: uuid.UUID,
    body: AttemptSubmit,
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Check batch expiry before allowing quiz submission
    attempt_obj = await quiz_service.get_attempt(session, attempt_id, institute_id=current_user.institute_id)
    if attempt_obj:
        quiz = await quiz_service.get_quiz(session, attempt_obj.quiz_id, institute_id=current_user.institute_id)
        if quiz:
            from app.middleware.access_control import check_student_batch_expiry
            await check_student_batch_expiry(session, current_user.id, quiz.course_id)

    try:
        attempt = await quiz_service.submit_attempt(
            session,
            attempt_id=attempt_id,
            answers=[a.model_dump() for a in body.answers],
            student_id=current_user.id,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AttemptOut.model_validate(attempt)


@router.get("/attempts/{attempt_id}", response_model=AttemptDetailOut)
async def get_attempt(
    attempt_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await quiz_service.get_attempt(
        session, attempt_id, institute_id=current_user.institute_id,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Students can only see their own attempts
    if current_user.role == UserRole.student and data["student_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return AttemptDetailOut(**data)


@router.patch("/answers/{answer_id}/grade", response_model=AnswerOut)
async def grade_answer(
    answer_id: uuid.UUID,
    body: GradeAnswer,
    current_user: CCTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        answer = await quiz_service.grade_answer(
            session,
            answer_id=answer_id,
            is_correct=body.is_correct,
            points_awarded=body.points_awarded,
            feedback=body.feedback,
            grader_id=current_user.id,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return AnswerOut.model_validate(answer)


# ── Quiz by ID (catch-all path param) ───────────────────────────

@router.get("/{quiz_id}", response_model=QuizOut)
async def get_quiz(
    quiz_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        data = await quiz_service.get_quiz_with_count(
            session, quiz_id, institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return QuizOut(**data)


@router.patch("/{quiz_id}", response_model=QuizOut)
async def update_quiz(
    quiz_id: uuid.UUID,
    body: QuizUpdate,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await quiz_service.update_quiz(
            session, quiz_id, data=body.model_dump(exclude_unset=True),
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    data = await quiz_service.get_quiz_with_count(
        session, quiz_id, institute_id=current_user.institute_id,
    )
    return QuizOut(**data)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    quiz_id: uuid.UUID,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await quiz_service.soft_delete_quiz(
            session, quiz_id, institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Sub-resource routes under /{quiz_id}/ ────────────────────────

@router.get("/{quiz_id}/questions", response_model=list[QuestionOut] | list[QuestionOutStudent])
async def list_questions(
    quiz_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    questions = await quiz_service.get_questions(
        session, quiz_id, institute_id=current_user.institute_id,
    )
    if current_user.role == UserRole.student:
        return [QuestionOutStudent.model_validate(q) for q in questions]
    return [QuestionOut.model_validate(q) for q in questions]


@router.post("/{quiz_id}/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    quiz_id: uuid.UUID,
    body: QuestionCreate,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Override quiz_id from path parameter
    data = body.model_dump()
    data["quiz_id"] = quiz_id
    try:
        question = await quiz_service.create_question(
            session, data=data, institute_id=current_user.institute_id,
        )
    except ValueError as e:
        detail = str(e)
        code = 400 if "Invalid question type" in detail else 404
        raise HTTPException(status_code=code, detail=detail)
    return QuestionOut.model_validate(question)


@router.post("/{quiz_id}/attempts", response_model=AttemptOut, status_code=status.HTTP_201_CREATED)
async def start_attempt(
    quiz_id: uuid.UUID,
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Check batch expiry before allowing quiz start
    quiz = await quiz_service.get_quiz(session, quiz_id, institute_id=current_user.institute_id)
    if quiz:
        from app.middleware.access_control import check_student_batch_expiry
        await check_student_batch_expiry(session, current_user.id, quiz.course_id)

    try:
        attempt = await quiz_service.start_attempt(
            session, quiz_id=quiz_id, student_id=current_user.id,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AttemptOut.model_validate(attempt)


@router.get("/{quiz_id}/attempts", response_model=PaginatedResponse[AttemptOut])
async def list_attempts(
    quiz_id: uuid.UUID,
    current_user: CCTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=100),
):
    attempts, total = await quiz_service.list_attempts(
        session, quiz_id=quiz_id, institute_id=current_user.institute_id,
        page=page, per_page=per_page,
    )
    return PaginatedResponse(
        data=[AttemptOut.model_validate(a) for a in attempts],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.quiz import Quiz, QuizQuestion, QuizAttempt, QuizAnswer
from app.models.course import Course, BatchCourse
from app.models.batch import StudentBatch
from app.models.enums import QuestionType, QuizAttemptStatus


# ── Quiz CRUD ───────────────────────────────────────────────────

async def list_quizzes(
    session: AsyncSession,
    course_id: uuid.UUID,
    module_id: Optional[uuid.UUID] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    query = (
        select(Quiz)
        .where(Quiz.course_id == course_id, Quiz.deleted_at.is_(None))
    )
    if module_id is not None:
        query = query.where(Quiz.module_id == module_id)
    if institute_id is not None:
        query = query.where(Quiz.institute_id == institute_id)

    query = query.order_by(Quiz.sequence_order)
    result = await session.execute(query)
    quizzes = result.scalars().all()

    if not quizzes:
        return []

    # Batch-load question counts
    quiz_ids = [q.id for q in quizzes]
    count_q = (
        select(QuizQuestion.quiz_id, func.count())
        .where(QuizQuestion.quiz_id.in_(quiz_ids), QuizQuestion.deleted_at.is_(None))
        .group_by(QuizQuestion.quiz_id)
    )
    count_result = await session.execute(count_q)
    count_map = dict(count_result.all())

    items = []
    for q in quizzes:
        items.append({
            "id": q.id,
            "course_id": q.course_id,
            "module_id": q.module_id,
            "title": q.title,
            "description": q.description,
            "time_limit_minutes": q.time_limit_minutes,
            "pass_percentage": q.pass_percentage,
            "max_attempts": q.max_attempts,
            "is_published": q.is_published,
            "sequence_order": q.sequence_order,
            "question_count": count_map.get(q.id, 0),
            "created_by": q.created_by,
            "created_at": q.created_at,
            "updated_at": q.updated_at,
        })

    return items


async def get_quiz(
    session: AsyncSession,
    quiz_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> Quiz:
    query = select(Quiz).where(Quiz.id == quiz_id, Quiz.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Quiz.institute_id == institute_id)
    result = await session.execute(query)
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise ValueError("Quiz not found")
    return quiz


async def get_quiz_with_count(
    session: AsyncSession,
    quiz_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> dict:
    quiz = await get_quiz(session, quiz_id, institute_id)
    count_result = await session.execute(
        select(func.count())
        .select_from(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz.id, QuizQuestion.deleted_at.is_(None))
    )
    question_count = count_result.scalar() or 0
    return {
        "id": quiz.id,
        "course_id": quiz.course_id,
        "module_id": quiz.module_id,
        "title": quiz.title,
        "description": quiz.description,
        "time_limit_minutes": quiz.time_limit_minutes,
        "pass_percentage": quiz.pass_percentage,
        "max_attempts": quiz.max_attempts,
        "is_published": quiz.is_published,
        "sequence_order": quiz.sequence_order,
        "question_count": question_count,
        "created_by": quiz.created_by,
        "created_at": quiz.created_at,
        "updated_at": quiz.updated_at,
    }


async def create_quiz(
    session: AsyncSession,
    data: dict,
    user_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> Quiz:
    # Validate course exists
    course_query = select(Course).where(
        Course.id == data["course_id"], Course.deleted_at.is_(None)
    )
    if institute_id is not None:
        course_query = course_query.where(Course.institute_id == institute_id)
    course_result = await session.execute(course_query)
    if not course_result.scalar_one_or_none():
        raise ValueError("Course not found")

    # Auto-assign sequence_order
    max_q = await session.execute(
        select(func.max(Quiz.sequence_order)).where(
            Quiz.course_id == data["course_id"], Quiz.deleted_at.is_(None)
        )
    )
    max_order = max_q.scalar() or 0

    quiz = Quiz(
        course_id=data["course_id"],
        module_id=data.get("module_id"),
        title=data["title"],
        description=data.get("description"),
        time_limit_minutes=data.get("time_limit_minutes"),
        pass_percentage=data.get("pass_percentage", 50),
        max_attempts=data.get("max_attempts", 1),
        sequence_order=max_order + 1,
        created_by=user_id,
        institute_id=institute_id,
    )
    session.add(quiz)
    await session.commit()
    await session.refresh(quiz)
    return quiz


async def update_quiz(
    session: AsyncSession,
    quiz_id: uuid.UUID,
    data: dict,
    institute_id: Optional[uuid.UUID] = None,
) -> Quiz:
    quiz = await get_quiz(session, quiz_id, institute_id)

    for key, value in data.items():
        if value is not None and hasattr(quiz, key):
            setattr(quiz, key, value)

    quiz.updated_at = datetime.now(timezone.utc)
    session.add(quiz)
    await session.commit()
    await session.refresh(quiz)
    return quiz


async def soft_delete_quiz(
    session: AsyncSession,
    quiz_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    quiz = await get_quiz(session, quiz_id, institute_id)
    quiz.deleted_at = datetime.now(timezone.utc)
    session.add(quiz)
    await session.commit()


# ── Question CRUD ───────────────────────────────────────────────

async def get_questions(
    session: AsyncSession,
    quiz_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> list[QuizQuestion]:
    query = (
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz_id, QuizQuestion.deleted_at.is_(None))
        .order_by(QuizQuestion.sequence_order)
    )
    if institute_id is not None:
        query = query.where(QuizQuestion.institute_id == institute_id)
    result = await session.execute(query)
    return list(result.scalars().all())


async def create_question(
    session: AsyncSession,
    data: dict,
    institute_id: Optional[uuid.UUID] = None,
) -> QuizQuestion:
    # Validate quiz exists
    await get_quiz(session, data["quiz_id"], institute_id)

    # Normalize question_type to lowercase for enum matching
    raw_type = data["question_type"].lower()
    try:
        question_type = QuestionType(raw_type)
    except ValueError:
        raise ValueError(f"Invalid question type: {data['question_type']}. Must be one of: mcq, true_false, short_answer")

    # Auto-assign sequence_order
    max_q = await session.execute(
        select(func.max(QuizQuestion.sequence_order)).where(
            QuizQuestion.quiz_id == data["quiz_id"], QuizQuestion.deleted_at.is_(None)
        )
    )
    max_order = max_q.scalar() or 0

    question = QuizQuestion(
        quiz_id=data["quiz_id"],
        question_type=question_type,
        question_text=data["question_text"],
        options=data.get("options"),
        correct_answer=data["correct_answer"],
        points=data.get("points", 1),
        sequence_order=max_order + 1,
        explanation=data.get("explanation"),
        institute_id=institute_id,
    )
    session.add(question)
    await session.commit()
    await session.refresh(question)
    return question


async def update_question(
    session: AsyncSession,
    question_id: uuid.UUID,
    data: dict,
    institute_id: Optional[uuid.UUID] = None,
) -> QuizQuestion:
    query = select(QuizQuestion).where(
        QuizQuestion.id == question_id, QuizQuestion.deleted_at.is_(None)
    )
    if institute_id is not None:
        query = query.where(QuizQuestion.institute_id == institute_id)
    result = await session.execute(query)
    question = result.scalar_one_or_none()
    if not question:
        raise ValueError("Question not found")

    for key, value in data.items():
        if value is not None and hasattr(question, key):
            setattr(question, key, value)

    question.updated_at = datetime.now(timezone.utc)
    session.add(question)
    await session.commit()
    await session.refresh(question)
    return question


async def delete_question(
    session: AsyncSession,
    question_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    query = select(QuizQuestion).where(
        QuizQuestion.id == question_id, QuizQuestion.deleted_at.is_(None)
    )
    if institute_id is not None:
        query = query.where(QuizQuestion.institute_id == institute_id)
    result = await session.execute(query)
    question = result.scalar_one_or_none()
    if not question:
        raise ValueError("Question not found")

    await session.delete(question)
    await session.commit()


# ── Attempt Management ──────────────────────────────────────────

async def start_attempt(
    session: AsyncSession,
    quiz_id: uuid.UUID,
    student_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> QuizAttempt:
    # Validate quiz exists and is published
    quiz = await get_quiz(session, quiz_id, institute_id)
    if not quiz.is_published:
        raise ValueError("Quiz is not published")

    # Return existing in-progress attempt instead of creating a new one
    existing_result = await session.execute(
        select(QuizAttempt).where(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.student_id == student_id,
            QuizAttempt.status == QuizAttemptStatus.in_progress,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return existing

    # Count ALL attempts (including in_progress) toward max_attempts
    count_result = await session.execute(
        select(func.count())
        .select_from(QuizAttempt)
        .where(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.student_id == student_id,
        )
    )
    total_count = count_result.scalar() or 0
    if total_count >= quiz.max_attempts:
        raise ValueError(f"Maximum attempts ({quiz.max_attempts}) exceeded")

    # Check student is enrolled in a batch that has this course
    enrolled_q = (
        select(func.count())
        .select_from(BatchCourse)
        .join(StudentBatch, StudentBatch.batch_id == BatchCourse.batch_id)
        .where(
            BatchCourse.course_id == quiz.course_id,
            BatchCourse.deleted_at.is_(None),
            StudentBatch.student_id == student_id,
            StudentBatch.removed_at.is_(None),
            StudentBatch.is_active.is_(True),
        )
    )
    enrolled_result = await session.execute(enrolled_q)
    if (enrolled_result.scalar() or 0) == 0:
        raise ValueError("Student is not enrolled in the course for this quiz")

    # Check batch expiry — prevents expired students from starting new attempts
    from app.middleware.access_control import check_student_batch_expiry
    await check_student_batch_expiry(session, student_id, quiz.course_id)

    attempt = QuizAttempt(
        quiz_id=quiz_id,
        student_id=student_id,
        status=QuizAttemptStatus.in_progress,
        institute_id=institute_id,
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    return attempt


async def submit_attempt(
    session: AsyncSession,
    attempt_id: uuid.UUID,
    answers: list[dict],
    student_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> QuizAttempt:
    # Load attempt (tenant-scoped)
    query = select(QuizAttempt).where(QuizAttempt.id == attempt_id)
    if institute_id is not None:
        query = query.where(QuizAttempt.institute_id == institute_id)
    result = await session.execute(query)
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise ValueError("Attempt not found")
    if attempt.student_id != student_id:
        raise ValueError("Attempt does not belong to this student")
    if attempt.status != QuizAttemptStatus.in_progress:
        raise ValueError("Attempt is not in progress")

    # Load quiz for pass_percentage and time_limit (tenant-scoped)
    quiz_query = select(Quiz).where(Quiz.id == attempt.quiz_id)
    if institute_id is not None:
        quiz_query = quiz_query.where(Quiz.institute_id == institute_id)
    quiz_result = await session.execute(quiz_query)
    quiz = quiz_result.scalar_one_or_none()

    # Server-side time limit enforcement (60-second grace period)
    if quiz and quiz.time_limit_minutes:
        elapsed_seconds = (datetime.now(timezone.utc) - attempt.created_at).total_seconds()
        allowed_seconds = (quiz.time_limit_minutes * 60) + 60  # 60s grace
        if elapsed_seconds > allowed_seconds:
            raise ValueError(
                f"Quiz time limit exceeded. Allowed {quiz.time_limit_minutes} minutes "
                f"(+60s grace), but {int(elapsed_seconds // 60)} minutes elapsed."
            )

    # Load all questions for this quiz
    questions_result = await session.execute(
        select(QuizQuestion).where(
            QuizQuestion.quiz_id == attempt.quiz_id,
            QuizQuestion.deleted_at.is_(None),
        )
    )
    questions = {q.id: q for q in questions_result.scalars().all()}

    has_short_answers = False
    total_score = 0
    max_score = sum(q.points for q in questions.values())

    # Process each answer
    for ans in answers:
        question_id = ans["question_id"]
        answer_text = ans["answer_text"]

        question = questions.get(question_id)
        if not question:
            continue  # skip answers for unknown questions

        is_correct = None
        points_awarded = None

        if question.question_type in (QuestionType.mcq, QuestionType.true_false):
            # Auto-grade: case-insensitive comparison
            is_correct = answer_text.strip().lower() == question.correct_answer.strip().lower()
            points_awarded = question.points if is_correct else 0
            total_score += points_awarded
        else:
            # Short answer — pending manual grading
            has_short_answers = True

        quiz_answer = QuizAnswer(
            attempt_id=attempt_id,
            question_id=question_id,
            answer_text=answer_text,
            is_correct=is_correct,
            points_awarded=points_awarded,
            institute_id=attempt.institute_id,
        )
        session.add(quiz_answer)

    now = datetime.now(timezone.utc)
    attempt.submitted_at = now
    attempt.max_score = max_score

    if has_short_answers:
        attempt.status = QuizAttemptStatus.submitted
        attempt.score = total_score  # partial score from auto-graded questions
    else:
        attempt.status = QuizAttemptStatus.graded
        attempt.score = total_score
        attempt.percentage = round((total_score / max_score) * 100) if max_score > 0 else 0
        attempt.passed = attempt.percentage >= quiz.pass_percentage
        attempt.graded_at = now

    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)

    # Send quiz graded email for auto-graded quizzes (no short answers)
    if not has_short_answers:
        try:
            from app.utils.email_sender import send_templated_email, build_login_url, get_institute_branding
            from app.models.user import User

            student = await session.get(User, attempt.student_id)
            if student and student.email and attempt.institute_id:
                branding = await get_institute_branding(session, attempt.institute_id)
                await send_templated_email(
                    session=session, institute_id=attempt.institute_id, user_id=attempt.student_id,
                    email_type="email_quiz_graded", template_key="quiz_graded", to=student.email,
                    variables={
                        "student_name": student.name,
                        "quiz_title": quiz.title if quiz else "Quiz",
                        "score": str(attempt.score or 0),
                        "max_score": str(attempt.max_score or 0),
                        "percentage": f"{float(attempt.percentage or 0):.0f}",
                        "passed": "Passed" if attempt.passed else "Not Passed",
                        "login_url": build_login_url(branding["slug"]),
                    },
                )
        except Exception:
            pass

    return attempt


async def get_attempt(
    session: AsyncSession,
    attempt_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> dict | None:
    query = select(QuizAttempt).where(QuizAttempt.id == attempt_id)
    if institute_id is not None:
        query = query.where(QuizAttempt.institute_id == institute_id)
    result = await session.execute(query)
    attempt = result.scalar_one_or_none()
    if not attempt:
        return None

    # Load answers
    answers_result = await session.execute(
        select(QuizAnswer).where(QuizAnswer.attempt_id == attempt_id)
    )
    answers = answers_result.scalars().all()

    return {
        "id": attempt.id,
        "quiz_id": attempt.quiz_id,
        "student_id": attempt.student_id,
        "status": attempt.status.value,
        "score": attempt.score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "passed": attempt.passed,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "graded_at": attempt.graded_at,
        "answers": [
            {
                "id": a.id,
                "question_id": a.question_id,
                "answer_text": a.answer_text,
                "is_correct": a.is_correct,
                "points_awarded": a.points_awarded,
                "feedback": a.feedback,
            }
            for a in answers
        ],
    }


async def list_attempts(
    session: AsyncSession,
    quiz_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 15,
) -> tuple[list[QuizAttempt], int]:
    from app.models.user import User as UserModel

    base_filters = [QuizAttempt.quiz_id == quiz_id]
    if institute_id is not None:
        base_filters.append(QuizAttempt.institute_id == institute_id)

    query = select(QuizAttempt).where(*base_filters)
    count_query = select(func.count()).select_from(QuizAttempt).where(*base_filters)

    if search:
        term = f"%{search}%"
        student_ids = select(UserModel.id).where(UserModel.name.ilike(term) | UserModel.email.ilike(term))
        query = query.where(QuizAttempt.student_id.in_(student_ids))
        count_query = count_query.where(QuizAttempt.student_id.in_(student_ids))

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(QuizAttempt.started_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    attempts = list(result.scalars().all())

    return attempts, total


async def list_my_attempts(
    session: AsyncSession,
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> list[QuizAttempt]:
    query = select(QuizAttempt).where(QuizAttempt.student_id == student_id)
    if institute_id is not None:
        query = query.where(QuizAttempt.institute_id == institute_id)

    if course_id is not None:
        # Join to Quiz to filter by course
        quiz_ids_q = select(Quiz.id).where(
            Quiz.course_id == course_id, Quiz.deleted_at.is_(None)
        )
        query = query.where(QuizAttempt.quiz_id.in_(quiz_ids_q))

    query = query.order_by(QuizAttempt.started_at.desc())
    result = await session.execute(query)
    return list(result.scalars().all())


# ── Grading ─────────────────────────────────────────────────────

async def grade_answer(
    session: AsyncSession,
    answer_id: uuid.UUID,
    is_correct: bool,
    points_awarded: int,
    feedback: Optional[str],
    grader_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> QuizAnswer:
    query = select(QuizAnswer).where(QuizAnswer.id == answer_id)
    if institute_id is not None:
        query = query.where(QuizAnswer.institute_id == institute_id)
    result = await session.execute(query)
    answer = result.scalar_one_or_none()
    if not answer:
        raise ValueError("Answer not found")

    answer.is_correct = is_correct
    answer.points_awarded = points_awarded
    answer.feedback = feedback
    session.add(answer)

    # Recalculate attempt score (tenant-scoped)
    attempt_query = select(QuizAttempt).where(QuizAttempt.id == answer.attempt_id)
    if institute_id is not None:
        attempt_query = attempt_query.where(QuizAttempt.institute_id == institute_id)
    attempt_result = await session.execute(attempt_query)
    attempt = attempt_result.scalar_one_or_none()

    # Reload all answers for this attempt
    all_answers_result = await session.execute(
        select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)
    )
    all_answers = all_answers_result.scalars().all()

    # Check if all answers are now graded
    all_graded = all(a.is_correct is not None for a in all_answers)
    total_score = sum(a.points_awarded or 0 for a in all_answers)

    attempt.score = total_score
    if attempt.max_score and attempt.max_score > 0:
        attempt.percentage = round((total_score / attempt.max_score) * 100)
    else:
        attempt.percentage = 0

    # Load quiz for pass_percentage
    quiz_result = await session.execute(
        select(Quiz).where(Quiz.id == attempt.quiz_id)
    )
    quiz = quiz_result.scalar_one_or_none()

    attempt.passed = attempt.percentage >= quiz.pass_percentage if quiz else False

    if all_graded:
        now = datetime.now(timezone.utc)
        attempt.status = QuizAttemptStatus.graded
        attempt.graded_at = now
        attempt.graded_by = grader_id

    session.add(attempt)
    await session.commit()
    await session.refresh(answer)

    # Send quiz graded email when all answers are graded
    if all_graded:
        try:
            from app.utils.email_sender import send_templated_email, build_login_url, get_institute_branding
            from app.models.user import User

            student = await session.get(User, attempt.student_id)
            if student and student.email and attempt.institute_id:
                branding = await get_institute_branding(session, attempt.institute_id)
                await send_templated_email(
                    session=session, institute_id=attempt.institute_id, user_id=attempt.student_id,
                    email_type="email_quiz_graded", template_key="quiz_graded", to=student.email,
                    variables={
                        "student_name": student.name,
                        "quiz_title": quiz.title if quiz else "Quiz",
                        "score": str(attempt.score or 0),
                        "max_score": str(attempt.max_score or 0),
                        "percentage": f"{float(attempt.percentage or 0):.0f}",
                        "passed": "Passed" if attempt.passed else "Not Passed",
                        "login_url": build_login_url(branding["slug"]),
                    },
                )
        except Exception:
            pass  # Best-effort

    return answer


async def list_pending_grading(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID] = None,
    page: int = 1,
    per_page: int = 15,
) -> tuple[list[QuizAttempt], int]:
    query = select(QuizAttempt).where(
        QuizAttempt.status == QuizAttemptStatus.submitted
    )
    count_query = (
        select(func.count())
        .select_from(QuizAttempt)
        .where(QuizAttempt.status == QuizAttemptStatus.submitted)
    )
    if institute_id is not None:
        query = query.where(QuizAttempt.institute_id == institute_id)
        count_query = count_query.where(QuizAttempt.institute_id == institute_id)

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(QuizAttempt.submitted_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    attempts = list(result.scalars().all())

    return attempts, total

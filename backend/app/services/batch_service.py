import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.batch import Batch, StudentBatch, StudentBatchHistory
from app.models.course import BatchCourse, Course
from app.models.user import User
from app.models.enums import UserRole, BatchHistoryAction


def _compute_status(start_date: date, end_date: date) -> str:
    today = date.today()
    if today < start_date:
        return "upcoming"
    elif today > end_date:
        return "completed"
    return "active"


async def list_batches(
    session: AsyncSession,
    current_user: User,
    page: int = 1,
    per_page: int = 20,
    status_filter: Optional[str] = None,
    teacher_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
) -> tuple[list[dict], int]:
    query = select(Batch).where(Batch.deleted_at.is_(None))
    count_query = select(func.count()).select_from(Batch).where(Batch.deleted_at.is_(None))

    # Role scoping
    if current_user.role == UserRole.teacher:
        query = query.where(Batch.teacher_id == current_user.id)
        count_query = count_query.where(Batch.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        sub = select(StudentBatch.batch_id).where(
            StudentBatch.student_id == current_user.id,
            StudentBatch.removed_at.is_(None),
        )
        query = query.where(Batch.id.in_(sub))
        count_query = count_query.where(Batch.id.in_(sub))

    if teacher_id:
        query = query.where(Batch.teacher_id == teacher_id)
        count_query = count_query.where(Batch.teacher_id == teacher_id)

    if search:
        pattern = f"%{search}%"
        query = query.where(col(Batch.name).ilike(pattern))
        count_query = count_query.where(col(Batch.name).ilike(pattern))

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(Batch.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    batches = result.scalars().all()

    items = []
    for b in batches:
        computed_status = _compute_status(b.start_date, b.end_date)
        if status_filter and computed_status != status_filter:
            total -= 1
            continue

        # Get teacher name
        teacher_name = None
        if b.teacher_id:
            r = await session.execute(select(User.name).where(User.id == b.teacher_id))
            teacher_name = r.scalar_one_or_none()

        # Get counts
        sc = await session.execute(
            select(func.count()).select_from(StudentBatch).where(
                StudentBatch.batch_id == b.id, StudentBatch.removed_at.is_(None)
            )
        )
        student_count = sc.scalar() or 0

        cc = await session.execute(
            select(func.count()).select_from(BatchCourse).where(
                BatchCourse.batch_id == b.id, BatchCourse.deleted_at.is_(None)
            )
        )
        course_count = cc.scalar() or 0

        items.append({
            "id": b.id,
            "name": b.name,
            "start_date": b.start_date,
            "end_date": b.end_date,
            "teacher_id": b.teacher_id,
            "teacher_name": teacher_name,
            "student_count": student_count,
            "course_count": course_count,
            "status": computed_status,
            "created_by": b.created_by,
            "created_at": b.created_at,
        })

    return items, total


async def get_batch(session: AsyncSession, batch_id: uuid.UUID) -> dict | None:
    result = await session.execute(
        select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None))
    )
    b = result.scalar_one_or_none()
    if not b:
        return None

    teacher_name = None
    if b.teacher_id:
        r = await session.execute(select(User.name).where(User.id == b.teacher_id))
        teacher_name = r.scalar_one_or_none()

    sc = await session.execute(
        select(func.count()).select_from(StudentBatch).where(
            StudentBatch.batch_id == b.id, StudentBatch.removed_at.is_(None)
        )
    )
    cc = await session.execute(
        select(func.count()).select_from(BatchCourse).where(
            BatchCourse.batch_id == b.id, BatchCourse.deleted_at.is_(None)
        )
    )

    return {
        "id": b.id,
        "name": b.name,
        "start_date": b.start_date,
        "end_date": b.end_date,
        "teacher_id": b.teacher_id,
        "teacher_name": teacher_name,
        "student_count": sc.scalar() or 0,
        "course_count": cc.scalar() or 0,
        "status": _compute_status(b.start_date, b.end_date),
        "created_by": b.created_by,
        "created_at": b.created_at,
    }


async def create_batch(
    session: AsyncSession,
    name: str,
    start_date: date,
    end_date: date,
    teacher_id: Optional[uuid.UUID],
    created_by: uuid.UUID,
) -> Batch:
    batch = Batch(
        name=name,
        start_date=start_date,
        end_date=end_date,
        teacher_id=teacher_id,
        created_by=created_by,
    )
    session.add(batch)
    await session.commit()
    await session.refresh(batch)
    return batch


async def update_batch(session: AsyncSession, batch_id: uuid.UUID, **fields) -> Batch:
    result = await session.execute(
        select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None))
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise ValueError("Batch not found")

    for key, value in fields.items():
        if value is not None and hasattr(batch, key):
            setattr(batch, key, value)

    batch.updated_at = datetime.now(timezone.utc)
    session.add(batch)
    await session.commit()
    await session.refresh(batch)
    return batch


async def soft_delete_batch(session: AsyncSession, batch_id: uuid.UUID) -> None:
    result = await session.execute(
        select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None))
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise ValueError("Batch not found")

    batch.deleted_at = datetime.now(timezone.utc)
    session.add(batch)
    await session.commit()


async def list_batch_students(session: AsyncSession, batch_id: uuid.UUID) -> list[dict]:
    result = await session.execute(
        select(StudentBatch, User)
        .join(User, StudentBatch.student_id == User.id)
        .where(
            StudentBatch.batch_id == batch_id,
            StudentBatch.removed_at.is_(None),
            User.deleted_at.is_(None),
        )
    )
    rows = result.all()
    return [
        {
            "id": sb.id,
            "student_id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "status": u.status.value,
            "enrolled_at": sb.enrolled_at,
        }
        for sb, u in rows
    ]


async def enroll_student(
    session: AsyncSession,
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    enrolled_by: uuid.UUID,
) -> StudentBatch:
    # Check student exists and is a student
    r = await session.execute(select(User).where(User.id == student_id, User.deleted_at.is_(None)))
    student = r.scalar_one_or_none()
    if not student or student.role != UserRole.student:
        raise ValueError("Student not found")

    # Check not already enrolled
    r = await session.execute(
        select(StudentBatch).where(
            StudentBatch.batch_id == batch_id,
            StudentBatch.student_id == student_id,
            StudentBatch.removed_at.is_(None),
        )
    )
    if r.scalar_one_or_none():
        raise ValueError("Student already enrolled in this batch")

    sb = StudentBatch(
        batch_id=batch_id,
        student_id=student_id,
        enrolled_by=enrolled_by,
    )
    session.add(sb)

    history = StudentBatchHistory(
        student_id=student_id,
        batch_id=batch_id,
        action=BatchHistoryAction.assigned,
        changed_by=enrolled_by,
    )
    session.add(history)

    await session.commit()
    await session.refresh(sb)
    return sb


async def remove_student(
    session: AsyncSession,
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    removed_by: uuid.UUID,
) -> None:
    r = await session.execute(
        select(StudentBatch).where(
            StudentBatch.batch_id == batch_id,
            StudentBatch.student_id == student_id,
            StudentBatch.removed_at.is_(None),
        )
    )
    sb = r.scalar_one_or_none()
    if not sb:
        raise ValueError("Enrollment not found")

    sb.removed_at = datetime.now(timezone.utc)
    sb.removed_by = removed_by
    session.add(sb)

    history = StudentBatchHistory(
        student_id=student_id,
        batch_id=batch_id,
        action=BatchHistoryAction.removed,
        changed_by=removed_by,
    )
    session.add(history)

    await session.commit()


async def list_batch_courses(session: AsyncSession, batch_id: uuid.UUID) -> list[dict]:
    result = await session.execute(
        select(BatchCourse, Course)
        .join(Course, BatchCourse.course_id == Course.id)
        .where(
            BatchCourse.batch_id == batch_id,
            BatchCourse.deleted_at.is_(None),
            Course.deleted_at.is_(None),
        )
    )
    rows = result.all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "status": c.status.value,
            "assigned_at": bc.assigned_at,
        }
        for bc, c in rows
    ]


async def link_course(
    session: AsyncSession,
    batch_id: uuid.UUID,
    course_id: uuid.UUID,
    assigned_by: uuid.UUID,
) -> BatchCourse:
    # Check not already linked
    r = await session.execute(
        select(BatchCourse).where(
            BatchCourse.batch_id == batch_id,
            BatchCourse.course_id == course_id,
            BatchCourse.deleted_at.is_(None),
        )
    )
    if r.scalar_one_or_none():
        raise ValueError("Course already linked to this batch")

    bc = BatchCourse(
        batch_id=batch_id,
        course_id=course_id,
        assigned_by=assigned_by,
    )
    session.add(bc)
    await session.commit()
    await session.refresh(bc)
    return bc


async def unlink_course(
    session: AsyncSession,
    batch_id: uuid.UUID,
    course_id: uuid.UUID,
) -> None:
    r = await session.execute(
        select(BatchCourse).where(
            BatchCourse.batch_id == batch_id,
            BatchCourse.course_id == course_id,
            BatchCourse.deleted_at.is_(None),
        )
    )
    bc = r.scalar_one_or_none()
    if not bc:
        raise ValueError("Course link not found")

    bc.deleted_at = datetime.now(timezone.utc)
    session.add(bc)
    await session.commit()

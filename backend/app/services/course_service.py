import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.course import Course, BatchCourse, CurriculumModule
from app.models.batch import Batch, StudentBatch
from app.models.user import User
from app.models.enums import CourseStatus, UserRole
from app.utils.transformers import to_db


async def list_courses(
    session: AsyncSession,
    current_user: User,
    page: int = 1,
    per_page: int = 20,
    status_filter: Optional[str] = None,
    batch_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
) -> tuple[list[dict], int]:
    query = select(Course).where(Course.deleted_at.is_(None))
    count_query = select(func.count()).select_from(Course).where(Course.deleted_at.is_(None))

    # Role scoping
    if current_user.role == UserRole.teacher:
        batch_ids_q = select(Batch.id).where(
            Batch.teacher_id == current_user.id, Batch.deleted_at.is_(None)
        )
        course_ids_q = select(BatchCourse.course_id).where(
            BatchCourse.batch_id.in_(batch_ids_q), BatchCourse.deleted_at.is_(None)
        )
        query = query.where(Course.id.in_(course_ids_q))
        count_query = count_query.where(Course.id.in_(course_ids_q))
    elif current_user.role == UserRole.student:
        batch_ids_q = select(StudentBatch.batch_id).where(
            StudentBatch.student_id == current_user.id, StudentBatch.removed_at.is_(None)
        )
        course_ids_q = select(BatchCourse.course_id).where(
            BatchCourse.batch_id.in_(batch_ids_q), BatchCourse.deleted_at.is_(None)
        )
        query = query.where(Course.id.in_(course_ids_q))
        count_query = count_query.where(Course.id.in_(course_ids_q))

    if status_filter:
        db_status = to_db(status_filter)
        query = query.where(Course.status == CourseStatus(db_status))
        count_query = count_query.where(Course.status == CourseStatus(db_status))

    if batch_id:
        course_ids_for_batch = select(BatchCourse.course_id).where(
            BatchCourse.batch_id == batch_id, BatchCourse.deleted_at.is_(None)
        )
        query = query.where(Course.id.in_(course_ids_for_batch))
        count_query = count_query.where(Course.id.in_(course_ids_for_batch))

    if search:
        pattern = f"%{search}%"
        query = query.where(col(Course.title).ilike(pattern))
        count_query = count_query.where(col(Course.title).ilike(pattern))

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(Course.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    courses = result.scalars().all()

    items = []
    for c in courses:
        # Get batch_ids
        r = await session.execute(
            select(BatchCourse.batch_id).where(
                BatchCourse.course_id == c.id, BatchCourse.deleted_at.is_(None)
            )
        )
        batch_ids = [row[0] for row in r.all()]

        items.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "status": c.status.value,
            "batch_ids": batch_ids,
            "cloned_from_id": c.cloned_from_id,
            "created_by": c.created_by,
            "created_at": c.created_at,
        })

    return items, total


async def get_course(session: AsyncSession, course_id: uuid.UUID) -> dict | None:
    result = await session.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    c = result.scalar_one_or_none()
    if not c:
        return None

    r = await session.execute(
        select(BatchCourse.batch_id).where(
            BatchCourse.course_id == c.id, BatchCourse.deleted_at.is_(None)
        )
    )
    batch_ids = [row[0] for row in r.all()]

    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "status": c.status.value,
        "batch_ids": batch_ids,
        "cloned_from_id": c.cloned_from_id,
        "created_by": c.created_by,
        "created_at": c.created_at,
    }


async def create_course(
    session: AsyncSession, title: str, description: Optional[str], created_by: uuid.UUID
) -> Course:
    course = Course(title=title, description=description, created_by=created_by)
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def update_course(session: AsyncSession, course_id: uuid.UUID, **fields) -> Course:
    result = await session.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    course = result.scalar_one_or_none()
    if not course:
        raise ValueError("Course not found")

    for key, value in fields.items():
        if value is not None and hasattr(course, key):
            if key == "status":
                value = CourseStatus(to_db(value))
            setattr(course, key, value)

    course.updated_at = datetime.now(timezone.utc)
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def soft_delete_course(session: AsyncSession, course_id: uuid.UUID) -> None:
    result = await session.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    course = result.scalar_one_or_none()
    if not course:
        raise ValueError("Course not found")

    course.deleted_at = datetime.now(timezone.utc)
    session.add(course)
    await session.commit()


async def clone_course(session: AsyncSession, course_id: uuid.UUID, created_by: uuid.UUID) -> Course:
    result = await session.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    original = result.scalar_one_or_none()
    if not original:
        raise ValueError("Course not found")

    new_course = Course(
        title=f"{original.title} (Copy)",
        description=original.description,
        status=CourseStatus.upcoming,
        cloned_from_id=original.id,
        created_by=created_by,
    )
    session.add(new_course)
    await session.flush()

    # Clone curriculum modules
    r = await session.execute(
        select(CurriculumModule).where(
            CurriculumModule.course_id == course_id,
            CurriculumModule.deleted_at.is_(None),
        ).order_by(CurriculumModule.sequence_order)
    )
    for mod in r.scalars().all():
        new_mod = CurriculumModule(
            course_id=new_course.id,
            title=mod.title,
            description=mod.description,
            sequence_order=mod.sequence_order,
            topics=mod.topics,
            created_by=created_by,
        )
        session.add(new_mod)

    await session.commit()
    await session.refresh(new_course)
    return new_course

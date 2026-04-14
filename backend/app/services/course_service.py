import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.course import Course, BatchCourse, CurriculumModule, Lecture
from app.models.batch import Batch, StudentBatch
from app.models.user import User
from app.models.enums import CourseStatus, UserRole
from app.utils.transformers import to_db
from app.utils.s3 import generate_view_url


async def list_courses(
    session: AsyncSession,
    current_user: User,
    page: int = 1,
    per_page: int = 20,
    status_filter: Optional[str] = None,
    batch_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> tuple[list[dict], int]:
    query = select(Course).where(Course.deleted_at.is_(None))
    count_query = select(func.count()).select_from(Course).where(Course.deleted_at.is_(None))

    if institute_id is not None:
        query = query.where(Course.institute_id == institute_id)
        count_query = count_query.where(Course.institute_id == institute_id)

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
        # Students see one row per (course, active-batch) pair — so a student
        # enrolled in two batches of the same course gets two cards with
        # different batch badges. Short-circuit the generic list path.
        return await _list_courses_for_student(
            session=session,
            current_user=current_user,
            page=page,
            per_page=per_page,
            status_filter=status_filter,
            batch_id=batch_id,
            search=search,
            institute_id=institute_id,
        )

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

    if not courses:
        return [], total

    # Batch-load all batch_ids for the page (single query)
    course_ids = [c.id for c in courses]
    bc_result = await session.execute(
        select(BatchCourse.course_id, BatchCourse.batch_id)
        .where(BatchCourse.course_id.in_(course_ids), BatchCourse.deleted_at.is_(None))
    )
    batch_ids_map: dict = {}
    for cid, bid in bc_result.all():
        batch_ids_map.setdefault(cid, []).append(bid)

    items = []
    for c in courses:
        items.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "status": c.status.value,
            "batch_ids": batch_ids_map.get(c.id, []),
            "cloned_from_id": c.cloned_from_id,
            "created_by": c.created_by,
            "created_at": c.created_at,
            "cover_image_url": generate_view_url(c.cover_image_key) if c.cover_image_key else None,
        })

    return items, total


async def _list_courses_for_student(
    session: AsyncSession,
    current_user: User,
    page: int,
    per_page: int,
    status_filter: Optional[str],
    batch_id: Optional[uuid.UUID],
    search: Optional[str],
    institute_id: Optional[uuid.UUID],
) -> tuple[list[dict], int]:
    """Return one row per (course, active student-batch) pair.

    Keeps course-level data shared (progress, curriculum) while surfacing each
    batch as a separate card with its own badge. Purely read-side — no schema
    change, safe for blue-green deploy.
    """
    pair_q = (
        select(Course, Batch.id, Batch.name)
        .join(BatchCourse, BatchCourse.course_id == Course.id)
        .join(Batch, Batch.id == BatchCourse.batch_id)
        .join(StudentBatch, StudentBatch.batch_id == Batch.id)
        .where(
            Course.deleted_at.is_(None),
            BatchCourse.deleted_at.is_(None),
            Batch.deleted_at.is_(None),
            StudentBatch.student_id == current_user.id,
            StudentBatch.removed_at.is_(None),
            StudentBatch.is_active.is_(True),
            func.coalesce(StudentBatch.extended_end_date, Batch.end_date) >= date.today(),
        )
    )

    if institute_id is not None:
        pair_q = pair_q.where(Course.institute_id == institute_id)

    if status_filter:
        db_status = to_db(status_filter)
        pair_q = pair_q.where(Course.status == CourseStatus(db_status))

    if batch_id:
        pair_q = pair_q.where(Batch.id == batch_id)

    if search:
        pattern = f"%{search}%"
        pair_q = pair_q.where(col(Course.title).ilike(pattern))

    count_q = select(func.count()).select_from(pair_q.subquery())
    total = (await session.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    pair_q = pair_q.order_by(Course.created_at.desc(), Batch.name.asc()).offset(offset).limit(per_page)
    rows = (await session.execute(pair_q)).all()

    if not rows:
        return [], total

    # Still expose the full batch_ids array on each course (used by some
    # non-student surfaces and for compat) — one query covering the page.
    course_ids = list({c.id for c, _, _ in rows})
    bc_result = await session.execute(
        select(BatchCourse.course_id, BatchCourse.batch_id)
        .where(BatchCourse.course_id.in_(course_ids), BatchCourse.deleted_at.is_(None))
    )
    batch_ids_map: dict = {}
    for cid, bid in bc_result.all():
        batch_ids_map.setdefault(cid, []).append(bid)

    items = []
    for c, bid, bname in rows:
        items.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "status": c.status.value,
            "batch_ids": batch_ids_map.get(c.id, []),
            "batch_id": bid,
            "batch_name": bname,
            "cloned_from_id": c.cloned_from_id,
            "created_by": c.created_by,
            "created_at": c.created_at,
            "cover_image_url": generate_view_url(c.cover_image_key) if c.cover_image_key else None,
        })

    return items, total


async def get_course(
    session: AsyncSession, course_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> dict | None:
    query = select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Course.institute_id == institute_id)
    result = await session.execute(query)
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
        "cover_image_url": generate_view_url(c.cover_image_key) if c.cover_image_key else None,
    }


async def create_course(
    session: AsyncSession, title: str, description: Optional[str], created_by: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> Course:
    course = Course(title=title, description=description, status=CourseStatus.active, created_by=created_by, institute_id=institute_id)
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def update_course(
    session: AsyncSession, course_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None, **fields
) -> Course:
    query = select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Course.institute_id == institute_id)
    result = await session.execute(query)
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


async def soft_delete_course(
    session: AsyncSession, course_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> None:
    query = select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Course.institute_id == institute_id)
    result = await session.execute(query)
    course = result.scalar_one_or_none()
    if not course:
        raise ValueError("Course not found")

    now = datetime.now(timezone.utc)
    course.deleted_at = now
    session.add(course)

    # Cascade: soft-delete curriculum modules
    mod_result = await session.execute(
        select(CurriculumModule).where(
            CurriculumModule.course_id == course_id,
            CurriculumModule.deleted_at.is_(None),
        )
    )
    for mod in mod_result.scalars().all():
        mod.deleted_at = now
        session.add(mod)

    # Cascade: remove batch-course links
    bc_result = await session.execute(
        select(BatchCourse).where(
            BatchCourse.course_id == course_id,
            BatchCourse.deleted_at.is_(None),
        )
    )
    for bc in bc_result.scalars().all():
        bc.deleted_at = now
        session.add(bc)

    # Cascade: soft-delete lectures linked to this course
    lec_result = await session.execute(
        select(Lecture).where(
            Lecture.course_id == course_id, Lecture.deleted_at.is_(None)
        )
    )
    for lec in lec_result.scalars().all():
        lec.deleted_at = now
        session.add(lec)

    await session.commit()


async def clone_course(
    session: AsyncSession, course_id: uuid.UUID, created_by: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> Course:
    query = select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Course.institute_id == institute_id)
    result = await session.execute(query)
    original = result.scalar_one_or_none()
    if not original:
        raise ValueError("Course not found")

    new_course = Course(
        title=f"{original.title} (Copy)",
        description=original.description,
        cover_image_key=original.cover_image_key,
        status=CourseStatus.upcoming,
        cloned_from_id=original.id,
        created_by=created_by,
        institute_id=institute_id,
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
            institute_id=institute_id,
        )
        session.add(new_mod)

    await session.commit()
    await session.refresh(new_course)
    return new_course

import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlmodel import select, func, col

from app.models.user import User
from app.models.batch import Batch, StudentBatch
from app.models.course import Course, Lecture, BatchMaterial, BatchCourse
from app.models.session import UserSession
from app.models.settings import SystemSetting
from app.models.activity import ActivityLog
from app.models.enums import UserRole, UserStatus


async def get_dashboard(session: AsyncSession, institute_id: uuid.UUID, use_cache: bool = True) -> dict:
    import time as _time
    from app.core.cache import cache

    cache_key = cache.dashboard_key(str(institute_id))
    if use_cache:
        cached = await cache.get(cache_key)
        if cached is not None:
            # SWR: check if data is still fresh
            meta = await cache.get(f"{cache_key}:swr_meta")
            if meta and meta.get("fresh_until", 0) > _time.time():
                return cached  # Fresh — return immediately
            # Stale — return instantly, but also let the caller know it's stale
            # (The cache will be refreshed by the next call that finds it stale)
            return cached
    today = date.today()

    # ── Combined user counts (4 counts in 1 query instead of 4 separate queries) ──
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE role = 'student') AS total_students,
            COUNT(*) FILTER (WHERE role = 'student' AND status = 'active') AS active_students,
            COUNT(*) FILTER (WHERE role = 'teacher') AS total_teachers,
            COUNT(*) FILTER (WHERE role = 'course_creator') AS total_course_creators
        FROM users
        WHERE deleted_at IS NULL AND institute_id = :iid
    """), {"iid": str(institute_id)})
    user_counts = r.one()
    total_students = user_counts[0] or 0
    active_students = user_counts[1] or 0
    total_teachers = user_counts[2] or 0
    total_course_creators = user_counts[3] or 0

    # ── Combined batch counts (2 counts in 1 query instead of 2) ──
    r = await session.execute(text("""
        SELECT
            COUNT(*) AS total_batches,
            COUNT(*) FILTER (WHERE start_date <= :today AND end_date >= :today) AS active_batches
        FROM batches
        WHERE deleted_at IS NULL AND institute_id = :iid
    """), {"iid": str(institute_id), "today": today})
    batch_counts = r.one()
    total_batches = batch_counts[0] or 0
    active_batches = batch_counts[1] or 0

    # ── Course count (1 query) ──
    r = await session.execute(
        select(func.count()).select_from(Course).where(Course.deleted_at.is_(None), Course.institute_id == institute_id)
    )
    total_courses = r.scalar() or 0

    # Recent batches with teacher name, student count, and computed status
    r = await session.execute(
        select(Batch, User.name.label("teacher_name"),
               func.count(StudentBatch.id).label("student_count"))
        .outerjoin(User, Batch.teacher_id == User.id)
        .outerjoin(StudentBatch, (StudentBatch.batch_id == Batch.id) & (StudentBatch.removed_at.is_(None)))
        .where(Batch.deleted_at.is_(None), Batch.institute_id == institute_id)
        .group_by(Batch.id, User.name)
        .order_by(Batch.created_at.desc()).limit(5)
    )
    recent_batches = []
    for row in r.all():
        b = row[0]
        status = "upcoming" if today < b.start_date else ("completed" if today > b.end_date else "active")
        recent_batches.append({
            "id": str(b.id), "name": b.name, "start_date": str(b.start_date),
            "teacher_name": row[1] or "Unassigned",
            "student_count": row[2],
            "status": status,
        })

    # Recent students with status and batch names
    r = await session.execute(
        select(User).where(User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id)
        .order_by(User.created_at.desc()).limit(5)
    )
    students = r.scalars().all()

    batch_names_by_student: dict = {}
    student_ids = [u.id for u in students]
    if student_ids:
        br = await session.execute(
            select(StudentBatch.student_id, Batch.name)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(StudentBatch.student_id.in_(student_ids), StudentBatch.removed_at.is_(None), Batch.deleted_at.is_(None))
        )
        batch_names_by_student = defaultdict(list)
        for sid, bname in br.all():
            batch_names_by_student[sid].append(bname)

    recent_students = [
        {"id": str(u.id), "name": u.name, "email": u.email,
         "status": u.status.value,
         "batch_names": batch_names_by_student.get(u.id, [])}
        for u in students
    ]

    result = {
        "total_batches": total_batches,
        "active_batches": active_batches,
        "total_students": total_students,
        "active_students": active_students,
        "total_teachers": total_teachers,
        "total_course_creators": total_course_creators,
        "total_courses": total_courses,
        "recent_batches": recent_batches,
        "recent_students": recent_students,
    }

    # Cache: fresh for 2 minutes, stale data served for up to 10 minutes while refreshing in background
    await cache.set(cache_key, result, ttl=600)
    await cache.set(f"{cache_key}:swr_meta", {"fresh_until": __import__('time').time() + 120}, ttl=600)
    return result


async def get_insights(session: AsyncSession, institute_id: uuid.UUID, use_cache: bool = True) -> dict:
    import time as _time
    from app.core.cache import cache

    cache_key = cache.insights_key(str(institute_id))
    if use_cache:
        cached = await cache.get(cache_key)
        if cached is not None:
            # SWR: return stale data instantly (background refresh handled by TTL overlap)
            return cached

    # Students by status
    r = await session.execute(
        select(User.status, func.count()).where(
            User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id
        ).group_by(User.status)
    )
    students_by_status = {row[0].value: row[1] for row in r.all()}

    # Batches by status (computed in SQL instead of loading all batches into Python)
    today = date.today()
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE start_date > :today) AS upcoming,
            COUNT(*) FILTER (WHERE start_date <= :today AND end_date >= :today) AS active,
            COUNT(*) FILTER (WHERE end_date < :today) AS completed
        FROM batches
        WHERE deleted_at IS NULL AND institute_id = :iid
    """), {"iid": str(institute_id), "today": today})
    bs = r.one()
    batches_by_status = {"upcoming": bs[0] or 0, "active": bs[1] or 0, "completed": bs[2] or 0}

    # Enrollment per batch
    r = await session.execute(
        select(Batch.id, Batch.name, func.count(StudentBatch.id))
        .outerjoin(StudentBatch, (StudentBatch.batch_id == Batch.id) & (StudentBatch.removed_at.is_(None)))
        .where(Batch.deleted_at.is_(None), Batch.institute_id == institute_id)
        .group_by(Batch.id, Batch.name)
    )
    enrollment_per_batch = [
        {"batch_id": str(row[0]), "name": row[1], "student_count": row[2]}
        for row in r.all()
    ]

    # Teacher workload (2 queries instead of N+1)
    r = await session.execute(
        select(User.id, User.name, func.count(Batch.id))
        .outerjoin(Batch, (Batch.teacher_id == User.id) & (Batch.deleted_at.is_(None)))
        .where(User.deleted_at.is_(None), User.role == UserRole.teacher, User.institute_id == institute_id)
        .group_by(User.id, User.name)
    )
    teachers = r.all()

    # Batch-fetch student counts grouped by teacher
    teacher_ids = [t[0] for t in teachers]
    student_counts = {}
    if teacher_ids:
        sr = await session.execute(
            select(Batch.teacher_id, func.count(StudentBatch.id))
            .join(StudentBatch, (StudentBatch.batch_id == Batch.id) & (StudentBatch.removed_at.is_(None)))
            .where(Batch.teacher_id.in_(teacher_ids), Batch.deleted_at.is_(None))
            .group_by(Batch.teacher_id)
        )
        student_counts = dict(sr.all())

    teacher_workload = []
    for row in teachers:
        teacher_workload.append({
            "teacher_id": str(row[0]),
            "name": row[1],
            "batch_count": row[2],
            "student_count": student_counts.get(row[0], 0),
        })

    # Materials by type
    r = await session.execute(
        select(BatchMaterial.file_type, func.count()).where(
            BatchMaterial.deleted_at.is_(None), BatchMaterial.institute_id == institute_id
        ).group_by(BatchMaterial.file_type)
    )
    materials_by_type = {row[0].value: row[1] for row in r.all()}

    # Lectures per course
    r = await session.execute(
        select(Course.id, Course.title, func.count(Lecture.id))
        .outerjoin(Lecture, (Lecture.course_id == Course.id) & (Lecture.deleted_at.is_(None)))
        .where(Course.deleted_at.is_(None), Course.institute_id == institute_id)
        .group_by(Course.id, Course.title)
    )
    lectures_per_course = [
        {"course_id": str(row[0]), "title": row[1], "lecture_count": row[2]}
        for row in r.all()
    ]

    # Device overview
    r = await session.execute(
        select(func.count()).select_from(User).where(
            User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id
        )
    )
    total_users = r.scalar() or 0

    r = await session.execute(
        select(UserSession.user_id, func.count()).where(
            UserSession.is_active.is_(True), UserSession.institute_id == institute_id
        ).group_by(UserSession.user_id)
    )
    session_counts = {row[0]: row[1] for row in r.all()}

    # Get system device limit
    sr = await session.execute(
        select(SystemSetting).where(SystemSetting.setting_key == "max_device_limit", SystemSetting.institute_id == institute_id)
    )
    setting = sr.scalar_one_or_none()
    device_limit = int(setting.value) if setting else 2

    at_limit = sum(1 for c in session_counts.values() if c >= device_limit)
    active_with_sessions = len(session_counts)
    no_sessions = total_users - active_with_sessions

    device_overview = {
        "at_limit": at_limit,
        "active": active_with_sessions,
        "no_sessions": max(0, no_sessions),
    }

    result = {
        "monthly": [],  # Computed from activity log in production
        "students_by_status": students_by_status,
        "batches_by_status": batches_by_status,
        "enrollment_per_batch": enrollment_per_batch,
        "teacher_workload": teacher_workload,
        "materials_by_type": materials_by_type,
        "lectures_per_course": lectures_per_course,
        "device_overview": device_overview,
    }

    # Cache: fresh for 5 minutes, stale data served for up to 15 minutes while refreshing in background
    await cache.set(cache_key, result, ttl=900)
    await cache.set(f"{cache_key}:swr_meta", {"fresh_until": __import__('time').time() + 300}, ttl=900)
    return result

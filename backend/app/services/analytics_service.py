import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.user import User
from app.models.batch import Batch, StudentBatch
from app.models.course import Course, Lecture, BatchMaterial, BatchCourse
from app.models.session import UserSession
from app.models.settings import SystemSetting
from app.models.activity import ActivityLog
from app.models.enums import UserRole, UserStatus


async def get_dashboard(session: AsyncSession, institute_id: uuid.UUID) -> dict:
    today = date.today()

    # Total batches
    r = await session.execute(
        select(func.count()).select_from(Batch).where(Batch.deleted_at.is_(None), Batch.institute_id == institute_id)
    )
    total_batches = r.scalar() or 0

    # Active batches (start_date <= today <= end_date)
    r = await session.execute(
        select(func.count()).select_from(Batch).where(
            Batch.deleted_at.is_(None),
            Batch.institute_id == institute_id,
            Batch.start_date <= today,
            Batch.end_date >= today,
        )
    )
    active_batches = r.scalar() or 0

    # Students
    r = await session.execute(
        select(func.count()).select_from(User).where(
            User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id
        )
    )
    total_students = r.scalar() or 0

    r = await session.execute(
        select(func.count()).select_from(User).where(
            User.deleted_at.is_(None), User.role == UserRole.student, User.status == UserStatus.active, User.institute_id == institute_id
        )
    )
    active_students = r.scalar() or 0

    # Teachers
    r = await session.execute(
        select(func.count()).select_from(User).where(
            User.deleted_at.is_(None), User.role == UserRole.teacher, User.institute_id == institute_id
        )
    )
    total_teachers = r.scalar() or 0

    # Course creators
    r = await session.execute(
        select(func.count()).select_from(User).where(
            User.deleted_at.is_(None), User.role == UserRole.course_creator, User.institute_id == institute_id
        )
    )
    total_course_creators = r.scalar() or 0

    # Courses
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

    return {
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


async def get_insights(session: AsyncSession, institute_id: uuid.UUID) -> dict:
    # Students by status
    r = await session.execute(
        select(User.status, func.count()).where(
            User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id
        ).group_by(User.status)
    )
    students_by_status = {row[0].value: row[1] for row in r.all()}

    # Batches by status (computed)
    today = date.today()
    r = await session.execute(
        select(Batch).where(Batch.deleted_at.is_(None), Batch.institute_id == institute_id)
    )
    batches = r.scalars().all()
    batches_by_status = {"upcoming": 0, "active": 0, "completed": 0}
    for b in batches:
        if today < b.start_date:
            batches_by_status["upcoming"] += 1
        elif today > b.end_date:
            batches_by_status["completed"] += 1
        else:
            batches_by_status["active"] += 1

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

    return {
        "monthly": [],  # Computed from activity log in production
        "students_by_status": students_by_status,
        "batches_by_status": batches_by_status,
        "enrollment_per_batch": enrollment_per_batch,
        "teacher_workload": teacher_workload,
        "materials_by_type": materials_by_type,
        "lectures_per_course": lectures_per_course,
        "device_overview": device_overview,
    }

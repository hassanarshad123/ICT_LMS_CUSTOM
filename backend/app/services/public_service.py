"""Business logic for public API endpoints.

Pure data-access and transformation functions — no HTTP concerns.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.user import User
from app.models.batch import Batch, StudentBatch
from app.models.course import Course, CurriculumModule, BatchCourse
from app.models.certificate import Certificate
from app.models.zoom import ZoomClass, ZoomAttendance
from app.models.announcement import Announcement
from app.models.job import Job
from app.models.enums import UserRole, CertificateStatus, ZoomClassStatus


# ── Helpers ──────────────────────────────────────────────────

def _compute_batch_status(start_date, end_date) -> str:
    """Derive batch status from its date range."""
    now = datetime.now(timezone.utc).date()
    if end_date and end_date < now:
        return "completed"
    if start_date and start_date <= now:
        return "active"
    return "upcoming"


# ── Students ─────────────────────────────────────────────────

async def get_student(
    session: AsyncSession,
    student_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> Optional[User]:
    """Return a single student or None."""
    result = await session.execute(
        select(User).where(
            User.id == student_id,
            User.institute_id == institute_id,
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


# ── Batches ──────────────────────────────────────────────────

async def list_batches(
    session: AsyncSession,
    institute_id: uuid.UUID,
    page: int,
    per_page: int,
) -> tuple[list[dict], int]:
    """Return (batch_dicts_with_counts, total).

    Each dict in the list contains: batch, teacher_name, student_count,
    course_count, status.
    """
    base_where = [Batch.institute_id == institute_id, Batch.deleted_at.is_(None)]

    count_q = select(func.count()).select_from(Batch).where(*base_where)
    total = (await session.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    query = (
        select(Batch)
        .where(*base_where)
        .order_by(Batch.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    batches = (await session.execute(query)).scalars().all()

    batch_ids = [b.id for b in batches]
    teacher_ids = [b.teacher_id for b in batches if b.teacher_id]

    # Batch-fetch teacher names
    teacher_map: dict[uuid.UUID, str] = {}
    if teacher_ids:
        r = await session.execute(
            select(User.id, User.name).where(User.id.in_(teacher_ids))
        )
        teacher_map = {row[0]: row[1] for row in r.all()}

    # Batch-fetch student and course counts
    student_counts: dict[uuid.UUID, int] = {}
    course_counts: dict[uuid.UUID, int] = {}
    if batch_ids:
        r = await session.execute(
            select(StudentBatch.batch_id, func.count())
            .where(
                StudentBatch.batch_id.in_(batch_ids),
                StudentBatch.removed_at.is_(None),
            )
            .group_by(StudentBatch.batch_id)
        )
        student_counts = {row[0]: row[1] for row in r.all()}

        r = await session.execute(
            select(BatchCourse.batch_id, func.count())
            .where(
                BatchCourse.batch_id.in_(batch_ids),
                BatchCourse.deleted_at.is_(None),
            )
            .group_by(BatchCourse.batch_id)
        )
        course_counts = {row[0]: row[1] for row in r.all()}

    items = [
        {
            "batch": b,
            "teacher_name": teacher_map.get(b.teacher_id),
            "student_count": student_counts.get(b.id, 0),
            "course_count": course_counts.get(b.id, 0),
            "status": _compute_batch_status(b.start_date, b.end_date),
        }
        for b in batches
    ]
    return items, total


async def get_batch(
    session: AsyncSession,
    batch_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> Optional[dict]:
    """Return a batch detail dict with counts, or None."""
    result = await session.execute(
        select(Batch).where(
            Batch.id == batch_id,
            Batch.institute_id == institute_id,
            Batch.deleted_at.is_(None),
        )
    )
    b = result.scalar_one_or_none()
    if not b:
        return None

    teacher_name = None
    if b.teacher_id:
        r = await session.execute(select(User.name).where(User.id == b.teacher_id))
        teacher_name = r.scalar_one_or_none()

    sc = (await session.execute(
        select(func.count()).select_from(StudentBatch).where(
            StudentBatch.batch_id == b.id,
            StudentBatch.removed_at.is_(None),
        )
    )).scalar() or 0

    cc = (await session.execute(
        select(func.count()).select_from(BatchCourse).where(
            BatchCourse.batch_id == b.id,
            BatchCourse.deleted_at.is_(None),
        )
    )).scalar() or 0

    return {
        "batch": b,
        "teacher_name": teacher_name,
        "student_count": sc,
        "course_count": cc,
        "status": _compute_batch_status(b.start_date, b.end_date),
    }


# ── Courses ──────────────────────────────────────────────────

async def list_courses(
    session: AsyncSession,
    institute_id: uuid.UUID,
    page: int,
    per_page: int,
) -> tuple[list, int]:
    """Return (courses, total)."""
    base_where = [Course.institute_id == institute_id, Course.deleted_at.is_(None)]

    total = (await session.execute(
        select(func.count()).select_from(Course).where(*base_where)
    )).scalar() or 0

    offset = (page - 1) * per_page
    courses = (await session.execute(
        select(Course)
        .where(*base_where)
        .order_by(Course.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )).scalars().all()

    return courses, total


async def get_course_with_modules(
    session: AsyncSession,
    course_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> Optional[dict]:
    """Return {'course': Course, 'modules': [...]} or None."""
    result = await session.execute(
        select(Course).where(
            Course.id == course_id,
            Course.institute_id == institute_id,
            Course.deleted_at.is_(None),
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        return None

    modules_r = await session.execute(
        select(CurriculumModule).where(
            CurriculumModule.course_id == c.id,
            CurriculumModule.deleted_at.is_(None),
        ).order_by(CurriculumModule.sequence_order)
    )
    modules = modules_r.scalars().all()

    return {"course": c, "modules": modules}


# ── Enrollments ──────────────────────────────────────────────

async def list_enrollments(
    session: AsyncSession,
    institute_id: uuid.UUID,
    batch_id: Optional[uuid.UUID],
    student_id: Optional[uuid.UUID],
    page: int,
    per_page: int,
) -> tuple[list[dict], int]:
    """Return (enriched_enrollment_dicts, total).

    Each dict: enrollment, student_name, student_email, batch_name.
    """
    base_where = [
        StudentBatch.institute_id == institute_id,
        StudentBatch.removed_at.is_(None),
    ]

    query = select(StudentBatch).where(*base_where)
    count_q = select(func.count()).select_from(StudentBatch).where(*base_where)

    if batch_id:
        query = query.where(StudentBatch.batch_id == batch_id)
        count_q = count_q.where(StudentBatch.batch_id == batch_id)
    if student_id:
        query = query.where(StudentBatch.student_id == student_id)
        count_q = count_q.where(StudentBatch.student_id == student_id)

    total = (await session.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    enrollments = (await session.execute(
        query.order_by(StudentBatch.enrolled_at.desc()).offset(offset).limit(per_page)
    )).scalars().all()

    # Batch-fetch student and batch names
    s_ids = list({e.student_id for e in enrollments})
    b_ids = list({e.batch_id for e in enrollments})

    student_map: dict[uuid.UUID, tuple[str, str]] = {}
    if s_ids:
        r = await session.execute(
            select(User.id, User.name, User.email).where(User.id.in_(s_ids))
        )
        student_map = {row[0]: (row[1], row[2]) for row in r.all()}

    batch_map: dict[uuid.UUID, str] = {}
    if b_ids:
        r = await session.execute(
            select(Batch.id, Batch.name).where(Batch.id.in_(b_ids))
        )
        batch_map = {row[0]: row[1] for row in r.all()}

    items = []
    for e in enrollments:
        s_name, s_email = student_map.get(e.student_id, ("Unknown", ""))
        items.append({
            "enrollment": e,
            "student_name": s_name,
            "student_email": s_email,
            "batch_name": batch_map.get(e.batch_id, "Unknown"),
        })

    return items, total


async def get_enrollment_names(
    session: AsyncSession,
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
) -> tuple[str, str, str]:
    """Return (student_name, student_email, batch_name) for response construction."""
    r = await session.execute(
        select(User.name, User.email).where(User.id == student_id)
    )
    row = r.first()
    s_name, s_email = (row[0], row[1]) if row else ("Unknown", "")

    r = await session.execute(select(Batch.name).where(Batch.id == batch_id))
    b_name = r.scalar_one_or_none() or "Unknown"

    return s_name, s_email, b_name


# ── Certificates ─────────────────────────────────────────────

async def list_certificates(
    session: AsyncSession,
    institute_id: uuid.UUID,
    batch_id: Optional[uuid.UUID],
    course_id: Optional[uuid.UUID],
    status_filter: Optional[str],
    page: int,
    per_page: int,
) -> tuple[list[dict], int]:
    """Return (enriched_cert_dicts, total).

    Each dict: cert, student_name.
    """
    base_where = [
        Certificate.institute_id == institute_id,
        Certificate.deleted_at.is_(None),
    ]

    query = select(Certificate).where(*base_where)
    count_q = select(func.count()).select_from(Certificate).where(*base_where)

    if batch_id:
        query = query.where(Certificate.batch_id == batch_id)
        count_q = count_q.where(Certificate.batch_id == batch_id)
    if course_id:
        query = query.where(Certificate.course_id == course_id)
        count_q = count_q.where(Certificate.course_id == course_id)
    if status_filter:
        query = query.where(Certificate.status == CertificateStatus(status_filter))
        count_q = count_q.where(Certificate.status == CertificateStatus(status_filter))

    total = (await session.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    certs = (await session.execute(
        query.order_by(Certificate.created_at.desc()).offset(offset).limit(per_page)
    )).scalars().all()

    # Batch-fetch student names
    s_ids = list({c.student_id for c in certs})
    student_map: dict[uuid.UUID, str] = {}
    if s_ids:
        r = await session.execute(
            select(User.id, User.name).where(User.id.in_(s_ids))
        )
        student_map = {row[0]: row[1] for row in r.all()}

    items = [
        {"cert": c, "student_name": student_map.get(c.student_id)}
        for c in certs
    ]
    return items, total


async def revoke_certificate(
    session: AsyncSession,
    cert_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> Optional[tuple]:
    """Revoke a certificate. Returns (cert, student_name) or None.

    Raises ValueError if certificate cannot be revoked.
    """
    result = await session.execute(
        select(Certificate).where(
            Certificate.id == cert_id,
            Certificate.institute_id == institute_id,
            Certificate.deleted_at.is_(None),
        )
    )
    cert = result.scalar_one_or_none()
    if not cert:
        return None

    if cert.status != CertificateStatus.approved:
        raise ValueError("Only approved certificates can be revoked")

    cert.status = CertificateStatus.revoked
    cert.revoked_at = datetime.now(timezone.utc)
    session.add(cert)

    r = await session.execute(select(User.name).where(User.id == cert.student_id))
    student_name = r.scalar_one_or_none()

    return cert, student_name


async def get_student_name(
    session: AsyncSession,
    student_id: uuid.UUID,
) -> Optional[str]:
    """Return student name for certificate response construction."""
    r = await session.execute(select(User.name).where(User.id == student_id))
    return r.scalar_one_or_none()


# ── Classes ──────────────────────────────────────────────────

async def list_classes(
    session: AsyncSession,
    institute_id: uuid.UUID,
    batch_id: Optional[uuid.UUID],
    status_filter: Optional[str],
    page: int,
    per_page: int,
) -> tuple[list, int]:
    """Return (classes, total)."""
    base_where = [
        ZoomClass.institute_id == institute_id,
        ZoomClass.deleted_at.is_(None),
    ]

    query = select(ZoomClass).where(*base_where)
    count_q = select(func.count()).select_from(ZoomClass).where(*base_where)

    if batch_id:
        query = query.where(ZoomClass.batch_id == batch_id)
        count_q = count_q.where(ZoomClass.batch_id == batch_id)
    if status_filter:
        query = query.where(ZoomClass.status == ZoomClassStatus(status_filter))
        count_q = count_q.where(ZoomClass.status == ZoomClassStatus(status_filter))

    total = (await session.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    classes = (await session.execute(
        query.order_by(ZoomClass.scheduled_date.desc()).offset(offset).limit(per_page)
    )).scalars().all()

    return classes, total


async def get_class_attendance(
    session: AsyncSession,
    class_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> Optional[list[dict]]:
    """Return attendance records with student names, or None if class not found.

    Each dict: student_id, student_name, attended, duration_minutes.
    """
    # Verify class belongs to institute
    result = await session.execute(
        select(ZoomClass).where(
            ZoomClass.id == class_id,
            ZoomClass.institute_id == institute_id,
            ZoomClass.deleted_at.is_(None),
        )
    )
    if not result.scalar_one_or_none():
        return None

    r = await session.execute(
        select(ZoomAttendance).where(ZoomAttendance.zoom_class_id == class_id)
    )
    records = r.scalars().all()

    # Fetch student names
    s_ids = [a.student_id for a in records]
    student_map: dict[uuid.UUID, str] = {}
    if s_ids:
        r2 = await session.execute(
            select(User.id, User.name).where(User.id.in_(s_ids))
        )
        student_map = {row[0]: row[1] for row in r2.all()}

    return [
        {
            "student_id": a.student_id,
            "student_name": student_map.get(a.student_id, "Unknown"),
            "attended": a.attended,
            "duration_minutes": a.duration_minutes,
        }
        for a in records
    ]


# ── Announcements ────────────────────────────────────────────

async def list_announcements(
    session: AsyncSession,
    institute_id: uuid.UUID,
    page: int,
    per_page: int,
) -> tuple[list, int]:
    """Return (announcements, total)."""
    base_where = [
        Announcement.institute_id == institute_id,
        Announcement.deleted_at.is_(None),
    ]

    total = (await session.execute(
        select(func.count()).select_from(Announcement).where(*base_where)
    )).scalar() or 0

    offset = (page - 1) * per_page
    announcements = (await session.execute(
        select(Announcement)
        .where(*base_where)
        .order_by(Announcement.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )).scalars().all()

    return announcements, total


# ── Jobs ─────────────────────────────────────────────────────

async def list_jobs(
    session: AsyncSession,
    institute_id: uuid.UUID,
    page: int,
    per_page: int,
) -> tuple[list, int]:
    """Return (jobs, total)."""
    base_where = [
        Job.institute_id == institute_id,
        Job.deleted_at.is_(None),
    ]

    total = (await session.execute(
        select(func.count()).select_from(Job).where(*base_where)
    )).scalar() or 0

    offset = (page - 1) * per_page
    jobs = (await session.execute(
        select(Job)
        .where(*base_where)
        .order_by(Job.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )).scalars().all()

    return jobs, total

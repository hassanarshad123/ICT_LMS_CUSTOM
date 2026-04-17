import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.batch import Batch, StudentBatch, StudentBatchHistory, BatchExtensionLog
from app.models.course import BatchCourse, Course, Lecture, BatchMaterial, CurriculumModule
from app.models.zoom import ZoomClass
from app.models.announcement import Announcement
from app.models.user import User
from app.models.enums import UserRole, BatchHistoryAction
from app.services.webhook_event_service import queue_webhook_event


def _compute_status(start_date: date, end_date: date, effective_end_date: date | None = None) -> str:
    today = date.today()
    check_end = effective_end_date or end_date
    if today < start_date:
        return "upcoming"
    elif today > check_end:
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
    institute_id: Optional[uuid.UUID] = None,
) -> tuple[list[dict], int]:
    today = date.today()

    query = select(Batch).where(Batch.deleted_at.is_(None))
    count_query = select(func.count()).select_from(Batch).where(Batch.deleted_at.is_(None))

    if institute_id is not None:
        query = query.where(Batch.institute_id == institute_id)
        count_query = count_query.where(Batch.institute_id == institute_id)

    # Role scoping
    if current_user.role == UserRole.teacher:
        query = query.where(Batch.teacher_id == current_user.id)
        count_query = count_query.where(Batch.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        today = date.today()
        sub = (
            select(StudentBatch.batch_id)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(
                StudentBatch.student_id == current_user.id,
                StudentBatch.removed_at.is_(None),
                StudentBatch.is_active.is_(True),
                func.coalesce(StudentBatch.extended_end_date, Batch.end_date) >= today,
            )
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

    # Status filter in SQL — avoids loading all rows into Python
    if status_filter == "upcoming":
        query = query.where(Batch.start_date > today)
        count_query = count_query.where(Batch.start_date > today)
    elif status_filter == "active":
        query = query.where(Batch.start_date <= today)
        count_query = count_query.where(Batch.start_date <= today)
        # For students the subquery above already filters by effective end
        # (coalesce of extended_end_date, batch.end_date). Adding a raw
        # Batch.end_date >= today here would re-exclude extended batches.
        if current_user.role != UserRole.student:
            query = query.where(Batch.end_date >= today)
            count_query = count_query.where(Batch.end_date >= today)
    elif status_filter == "completed":
        query = query.where(Batch.end_date < today)
        count_query = count_query.where(Batch.end_date < today)

    # Total count (one query)
    result = await session.execute(count_query)
    total = result.scalar() or 0

    # Paginated page (one query)
    offset = (page - 1) * per_page
    query = query.order_by(Batch.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    batches = result.scalars().all()

    if not batches:
        return [], total

    batch_ids = [b.id for b in batches]

    # Batch-load teacher names — one query for the whole page
    teacher_ids = list({b.teacher_id for b in batches if b.teacher_id})
    teacher_names: dict = {}
    if teacher_ids:
        r = await session.execute(
            select(User.id, User.name).where(User.id.in_(teacher_ids))
        )
        teacher_names = {row[0]: row[1] for row in r.all()}

    # Batch-load student counts — one query for the whole page
    sc_result = await session.execute(
        select(StudentBatch.batch_id, func.count().label("cnt"))
        .where(StudentBatch.batch_id.in_(batch_ids), StudentBatch.removed_at.is_(None))
        .group_by(StudentBatch.batch_id)
    )
    student_counts = {row[0]: row[1] for row in sc_result.all()}

    # Batch-load course counts — one query for the whole page
    cc_result = await session.execute(
        select(BatchCourse.batch_id, func.count().label("cnt"))
        .where(BatchCourse.batch_id.in_(batch_ids), BatchCourse.deleted_at.is_(None))
        .group_by(BatchCourse.batch_id)
    )
    course_counts = {row[0]: row[1] for row in cc_result.all()}

    # For students, look up effective end dates (extension-aware)
    effective_end_dates = {}
    if current_user.role == UserRole.student:
        eff_result = await session.execute(
            select(StudentBatch.batch_id, StudentBatch.extended_end_date)
            .where(
                StudentBatch.student_id == current_user.id,
                StudentBatch.removed_at.is_(None),
                StudentBatch.is_active.is_(True),
            )
        )
        for row in eff_result.all():
            effective_end_dates[row[0]] = row[1]

    items = []
    for b in batches:
        items.append({
            "id": b.id,
            "name": b.name,
            "start_date": b.start_date,
            "end_date": b.end_date,
            "teacher_id": b.teacher_id,
            "teacher_name": teacher_names.get(b.teacher_id),
            "student_count": student_counts.get(b.id, 0),
            "course_count": course_counts.get(b.id, 0),
            "status": _compute_status(b.start_date, b.end_date, effective_end_dates.get(b.id)),
            "created_by": b.created_by,
            "created_at": b.created_at,
            "enable_lecture_gating": b.enable_lecture_gating,
            "lecture_gating_threshold": b.lecture_gating_threshold,
        })

    return items, total


async def get_batch(
    session: AsyncSession, batch_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> dict | None:
    query = select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Batch.institute_id == institute_id)
    result = await session.execute(query)
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
        "enable_lecture_gating": b.enable_lecture_gating,
        "lecture_gating_threshold": b.lecture_gating_threshold,
    }


async def create_batch(
    session: AsyncSession,
    name: str,
    start_date: date,
    end_date: date,
    teacher_id: Optional[uuid.UUID],
    created_by: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> Batch:
    batch = Batch(
        name=name,
        start_date=start_date,
        end_date=end_date,
        teacher_id=teacher_id,
        created_by=created_by,
        institute_id=institute_id,
    )
    session.add(batch)
    await session.commit()
    await session.refresh(batch)
    return batch


async def update_batch(
    session: AsyncSession, batch_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None, **fields
) -> Batch:
    query = select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Batch.institute_id == institute_id)
    result = await session.execute(query)
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


async def soft_delete_batch(
    session: AsyncSession, batch_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> None:
    query = select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Batch.institute_id == institute_id)
    result = await session.execute(query)
    batch = result.scalar_one_or_none()
    if not batch:
        raise ValueError("Batch not found")

    now = datetime.now(timezone.utc)
    batch.deleted_at = now
    session.add(batch)

    # Cascade: remove student enrollments
    sb_result = await session.execute(
        select(StudentBatch).where(
            StudentBatch.batch_id == batch_id, StudentBatch.removed_at.is_(None)
        )
    )
    for sb in sb_result.scalars().all():
        sb.removed_at = now
        session.add(sb)

    # Cascade: remove batch-course links
    bc_result = await session.execute(
        select(BatchCourse).where(
            BatchCourse.batch_id == batch_id, BatchCourse.deleted_at.is_(None)
        )
    )
    for bc in bc_result.scalars().all():
        bc.deleted_at = now
        session.add(bc)

    # Cascade: soft-delete lectures
    lec_result = await session.execute(
        select(Lecture).where(
            Lecture.batch_id == batch_id, Lecture.deleted_at.is_(None)
        )
    )
    for lec in lec_result.scalars().all():
        lec.deleted_at = now
        session.add(lec)

    # Cascade: soft-delete batch materials
    mat_result = await session.execute(
        select(BatchMaterial).where(
            BatchMaterial.batch_id == batch_id, BatchMaterial.deleted_at.is_(None)
        )
    )
    for mat in mat_result.scalars().all():
        mat.deleted_at = now
        session.add(mat)

    # Cascade: soft-delete zoom classes
    zc_result = await session.execute(
        select(ZoomClass).where(
            ZoomClass.batch_id == batch_id, ZoomClass.deleted_at.is_(None)
        )
    )
    for zc in zc_result.scalars().all():
        zc.deleted_at = now
        session.add(zc)

    # Cascade: soft-delete announcements
    ann_result = await session.execute(
        select(Announcement).where(
            Announcement.batch_id == batch_id, Announcement.deleted_at.is_(None)
        )
    )
    for ann in ann_result.scalars().all():
        ann.deleted_at = now
        session.add(ann)

    await session.commit()


async def list_batch_students(
    session: AsyncSession,
    batch_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    base_filters = [
        StudentBatch.batch_id == batch_id,
        StudentBatch.removed_at.is_(None),
        User.deleted_at.is_(None),
    ]
    if institute_id is not None:
        base_filters.append(StudentBatch.institute_id == institute_id)

    query = (
        select(StudentBatch, User)
        .join(User, StudentBatch.student_id == User.id)
        .where(*base_filters)
    )
    count_q = (
        select(func.count())
        .select_from(StudentBatch)
        .join(User, StudentBatch.student_id == User.id)
        .where(*base_filters)
    )

    if search:
        term = f"%{search}%"
        search_filter = User.name.ilike(term) | User.email.ilike(term)
        query = query.where(search_filter)
        count_q = count_q.where(search_filter)

    total = (await session.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    result = await session.execute(query.order_by(User.name).offset(offset).limit(per_page))
    rows = result.all()
    items = [
        {
            "id": sb.id,
            "student_id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "status": u.status.value,
            "enrolled_at": sb.enrolled_at,
            "is_active": sb.is_active,
            "extended_end_date": sb.extended_end_date.isoformat() if sb.extended_end_date else None,
        }
        for sb, u in rows
    ]
    return items, total


async def enroll_student(
    session: AsyncSession,
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    enrolled_by: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
    access_days: Optional[int] = None,
    access_end_date: Optional[date] = None,
    reason: Optional[str] = None,
) -> StudentBatch:
    # Validate custom access window args up front
    if access_days is not None and access_end_date is not None:
        raise ValueError("Provide either access_days or access_end_date, not both.")
    extended_target: Optional[date] = None
    if access_days is not None:
        extended_target = date.today() + timedelta(days=access_days)
    elif access_end_date is not None:
        extended_target = access_end_date
    if extended_target is not None and extended_target <= date.today():
        raise ValueError("Access end date must be in the future.")

    # Check student exists, is a student, and belongs to the same institute
    r = await session.execute(select(User).where(User.id == student_id, User.deleted_at.is_(None)))
    student = r.scalar_one_or_none()
    if not student or student.role != UserRole.student:
        raise ValueError("Student not found")
    if institute_id is not None and student.institute_id != institute_id:
        raise ValueError("Student not found")

    # Check batch belongs to same institute
    if institute_id is not None:
        br = await session.execute(
            select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None), Batch.institute_id == institute_id)
        )
        if not br.scalar_one_or_none():
            raise ValueError("Batch not found")

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
        institute_id=institute_id,
        extended_end_date=extended_target,
    )
    session.add(sb)

    history = StudentBatchHistory(
        student_id=student_id,
        batch_id=batch_id,
        action=BatchHistoryAction.assigned,
        changed_by=enrolled_by,
        institute_id=institute_id,
    )
    session.add(history)

    await session.flush()

    # Audit log when a custom access window is set at enrollment time
    if extended_target is not None:
        session.add(BatchExtensionLog(
            student_batch_id=sb.id,
            student_id=student_id,
            batch_id=batch_id,
            institute_id=institute_id,
            previous_end_date=None,
            new_end_date=extended_target,
            extension_type="initial",
            duration_days=access_days,
            reason=reason,
            extended_by=enrolled_by,
        ))

    await session.commit()
    await session.refresh(sb)

    # Send enrollment confirmation email
    try:
        from app.utils.email_sender import send_email_background, get_institute_branding, build_login_url, should_send_email
        from app.utils.email_templates import enrollment_email
        if not await should_send_email(session, institute_id, student_id, "email_enrollment"):
            return sb

        batch = await session.get(Batch, batch_id)
        branding = await get_institute_branding(session, institute_id) if institute_id else {"name": "", "slug": "", "logo_url": None, "accent_color": "#C5D86D"}

        teacher_name = None
        if batch and batch.teacher_id:
            teacher = await session.get(User, batch.teacher_id)
            if teacher:
                teacher_name = teacher.name

        effective_end = extended_target if extended_target is not None else (batch.end_date if batch else None)
        subject, html = enrollment_email(
            student_name=student.name,
            batch_name=batch.name if batch else "Unknown",
            start_date=batch.start_date.isoformat() if batch and batch.start_date else "",
            effective_end_date=effective_end.isoformat() if effective_end else "",
            teacher_name=teacher_name,
            login_url=build_login_url(branding["slug"]) if branding["slug"] else "",
            institute_name=branding["name"],
            logo_url=branding.get("logo_url"),
            accent_color=branding.get("accent_color", "#C5D86D"),
        )
        send_email_background(student.email, subject, html, from_name=branding["name"])
    except Exception:
        pass  # Best-effort

    return sb


async def bulk_enroll_students(
    db: AsyncSession,
    *,
    institute_id: uuid.UUID,
    batch_id: uuid.UUID,
    student_ids: list[uuid.UUID],
    enrolled_by: uuid.UUID,
    access_days: Optional[int] = None,
    access_end_date: Optional[date] = None,
    reason: Optional[str] = None,
    skip_notifications: bool = False,
) -> dict:
    """Bulk-enroll students with a shared access window.

    Each row commits individually (enroll_student owns its own transaction).
    On any failure, returns partial success with the successful rows and the error.
    """
    enrolled: list[dict] = []
    errors: list[dict] = []
    for sid in student_ids:
        try:
            await enroll_student(
                db,
                institute_id=institute_id,
                batch_id=batch_id,
                student_id=sid,
                enrolled_by=enrolled_by,
                access_days=access_days,
                access_end_date=access_end_date,
                reason=reason,
            )
            enrolled.append({"student_id": str(sid), "status": "enrolled"})
        except (ValueError, LookupError) as e:
            errors.append({"student_id": str(sid), "error": str(e)})
    return {"enrolled": enrolled, "errors": errors, "count": len(enrolled)}


async def remove_student(
    session: AsyncSession,
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    removed_by: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    query = select(StudentBatch).where(
        StudentBatch.batch_id == batch_id,
        StudentBatch.student_id == student_id,
        StudentBatch.removed_at.is_(None),
    )
    if institute_id is not None:
        query = query.where(StudentBatch.institute_id == institute_id)
    r = await session.execute(query)
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
        institute_id=institute_id,
    )
    session.add(history)

    await session.commit()


async def toggle_enrollment_active(
    session: AsyncSession,
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    is_active: bool,
    changed_by: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> StudentBatch:
    """Toggle the is_active flag on an enrollment."""
    query = select(StudentBatch).where(
        StudentBatch.batch_id == batch_id,
        StudentBatch.student_id == student_id,
        StudentBatch.removed_at.is_(None),
    )
    if institute_id is not None:
        query = query.where(StudentBatch.institute_id == institute_id)
    r = await session.execute(query)
    sb = r.scalar_one_or_none()
    if not sb:
        raise ValueError("Enrollment not found")

    sb.is_active = is_active
    sb.updated_at = datetime.now(timezone.utc)
    session.add(sb)

    history = StudentBatchHistory(
        student_id=student_id,
        batch_id=batch_id,
        action=BatchHistoryAction.activated if is_active else BatchHistoryAction.deactivated,
        changed_by=changed_by,
        institute_id=institute_id,
    )
    session.add(history)

    await session.commit()
    await session.refresh(sb)
    return sb


async def list_batch_courses(
    session: AsyncSession, batch_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> list[dict]:
    query = (
        select(BatchCourse, Course)
        .join(Course, BatchCourse.course_id == Course.id)
        .where(
            BatchCourse.batch_id == batch_id,
            BatchCourse.deleted_at.is_(None),
            Course.deleted_at.is_(None),
        )
    )
    if institute_id is not None:
        query = query.where(BatchCourse.institute_id == institute_id)
    result = await session.execute(query)
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
    institute_id: Optional[uuid.UUID] = None,
) -> BatchCourse:
    # Verify batch and course belong to same institute
    if institute_id is not None:
        br = await session.execute(
            select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None), Batch.institute_id == institute_id)
        )
        if not br.scalar_one_or_none():
            raise ValueError("Batch not found")
        cr = await session.execute(
            select(Course).where(Course.id == course_id, Course.deleted_at.is_(None), Course.institute_id == institute_id)
        )
        if not cr.scalar_one_or_none():
            raise ValueError("Course not found")

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
        institute_id=institute_id,
    )
    session.add(bc)
    await session.commit()
    await session.refresh(bc)
    return bc


async def unlink_course(
    session: AsyncSession,
    batch_id: uuid.UUID,
    course_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    query = select(BatchCourse).where(
        BatchCourse.batch_id == batch_id,
        BatchCourse.course_id == course_id,
        BatchCourse.deleted_at.is_(None),
    )
    if institute_id is not None:
        query = query.where(BatchCourse.institute_id == institute_id)
    r = await session.execute(query)
    bc = r.scalar_one_or_none()
    if not bc:
        raise ValueError("Course link not found")

    bc.deleted_at = datetime.now(timezone.utc)
    session.add(bc)
    await session.commit()


# ── Per-student batch time extensions ────────────────────────────


async def extend_student_access(
    db: AsyncSession,
    *,
    institute_id: uuid.UUID,
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
    duration_days: Optional[int] = None,
    end_date: Optional[date] = None,
    reason: Optional[str] = None,
    extended_by: uuid.UUID,
) -> dict:
    """Legacy wrapper — delegates to set_student_access with context='adjust'.

    Kept for backwards compatibility with the /extend router and other callers.
    The helper auto-detects whether the new date is an extension or a shortening;
    unlike the pre-refactor version, dates earlier than batch.end_date are allowed.

    Commits the transaction so callers that do not own the transaction boundary
    (including the /extend router when institute_id is None) keep working.
    Translates LookupError (enrollment missing) to ValueError so existing
    `except ValueError` handlers map it to 400.
    """
    try:
        result = await set_student_access(
            db,
            institute_id=institute_id,
            student_id=student_id,
            batch_id=batch_id,
            days=duration_days,
            end_date=end_date,
            actor_id=extended_by,
            reason=reason,
            context="adjust",
        )
    except LookupError as exc:
        raise ValueError(str(exc)) from exc
    await db.commit()
    return {
        "student_id": student_id,
        "batch_id": batch_id,
        "duration_days": duration_days,
        "reason": reason,
        **result,
    }


async def get_extension_history(
    session: AsyncSession,
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """Get the extension history for a student in a batch."""
    filters = [
        BatchExtensionLog.batch_id == batch_id,
        BatchExtensionLog.student_id == student_id,
    ]
    if institute_id is not None:
        filters.append(BatchExtensionLog.institute_id == institute_id)

    result = await session.execute(
        select(BatchExtensionLog, User.name).join(
            User, User.id == BatchExtensionLog.extended_by
        ).where(*filters).order_by(BatchExtensionLog.created_at.desc())
    )

    return [
        {
            "id": log.id,
            "previous_end_date": log.previous_end_date,
            "new_end_date": log.new_end_date,
            "extension_type": log.extension_type,
            "duration_days": log.duration_days,
            "reason": log.reason,
            "extended_by": log.extended_by,
            "extended_by_name": name,
            "created_at": log.created_at,
        }
        for log, name in result.all()
    ]


async def get_expiry_summary(
    session: AsyncSession,
    batch_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> dict:
    """Get expiry summary for all students in a batch.

    Returns: { expiring_soon: [...], expired: [...], extended: [...] }
    """
    # Load batch
    batch_filters = [Batch.id == batch_id, Batch.deleted_at.is_(None)]
    if institute_id is not None:
        batch_filters.append(Batch.institute_id == institute_id)
    batch = (await session.execute(
        select(Batch).where(*batch_filters)
    )).scalar_one_or_none()
    if not batch:
        raise ValueError("Batch not found")

    # Load all active enrollments with student names
    enroll_filters = [
        StudentBatch.batch_id == batch_id,
        StudentBatch.removed_at.is_(None),
        StudentBatch.is_active.is_(True),
    ]
    if institute_id is not None:
        enroll_filters.append(StudentBatch.institute_id == institute_id)
    result = await session.execute(
        select(StudentBatch, User.name, User.email).join(
            User, User.id == StudentBatch.student_id
        ).where(*enroll_filters)
    )
    rows = result.all()

    today = date.today()
    from datetime import timedelta
    soon_threshold = today + timedelta(days=7)

    expiring_soon = []
    expired = []
    adjusted = []

    for sb, name, email in rows:
        effective_end = sb.extended_end_date or batch.end_date
        info = {
            "student_id": sb.student_id,
            "student_name": name,
            "student_email": email,
            "batch_end_date": batch.end_date,
            "extended_end_date": sb.extended_end_date,
            "effective_end_date": effective_end,
        }

        if sb.extended_end_date is not None:
            adjusted.append(info)

        if today > effective_end:
            expired.append(info)
        elif today <= effective_end <= soon_threshold:
            expiring_soon.append(info)

    return {
        "expiring_soon": expiring_soon,
        "expired": expired,
        "adjusted": adjusted,
    }


async def bulk_set_student_access(
    db: AsyncSession,
    *,
    institute_id: uuid.UUID,
    batch_id: uuid.UUID,
    student_ids: list[uuid.UUID],
    actor_id: uuid.UUID,
    days: Optional[int] = None,
    end_date: Optional[date] = None,
    reason: Optional[str] = None,
    skip_notifications: bool = False,
) -> dict:
    """Adjust access end for multiple students in one transaction.

    set_student_access flushes but does not commit, so we wrap N calls in a
    single transaction boundary here: all-or-nothing.
    """
    results: list[dict] = []
    try:
        for sid in student_ids:
            r = await set_student_access(
                db,
                institute_id=institute_id,
                student_id=sid,
                batch_id=batch_id,
                days=days,
                end_date=end_date,
                actor_id=actor_id,
                reason=reason,
                context="adjust",
                skip_notification=skip_notifications,
            )
            results.append({
                "student_id": str(sid),
                "previous_end_date": r["previous_end_date"].isoformat() if r["previous_end_date"] else None,
                "new_end_date": r["new_end_date"].isoformat(),
                "extension_type": r["extension_type"],
            })
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {"results": results, "count": len(results)}


# ── Unified student access helper ────────────────────────────────────────────


async def set_student_access(
    db: AsyncSession,
    *,
    institute_id: uuid.UUID,
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
    days: Optional[int] = None,
    end_date: Optional[date] = None,
    actor_id: uuid.UUID,
    reason: Optional[str] = None,
    context: str,  # "initial" | "extend" | "shorten" | "adjust"
    skip_notification: bool = False,
) -> dict:
    """Unified helper to set StudentBatch.extended_end_date.

    Validates days/end_date are mutually exclusive and resolved date > today.
    Auto-detects direction when context == 'adjust'.
    Writes a BatchExtensionLog row and queues a webhook event for extend/shorten
    (not for initial — enrollment.created already carries effective_end_date).

    Transaction: flushes but does NOT commit. The caller owns the transaction
    boundary (router or outer service wrapping a bulk operation).
    """
    if days is not None and end_date is not None:
        raise ValueError("Provide either days or end_date, not both.")
    if days is None and end_date is None:
        raise ValueError("Provide either days or end_date.")

    target = end_date if end_date is not None else date.today() + timedelta(days=days)
    if target <= date.today():
        raise ValueError("New end date must be in the future.")

    stmt = (
        select(StudentBatch, Batch)
        .join(Batch, Batch.id == StudentBatch.batch_id)
        .where(
            StudentBatch.student_id == student_id,
            StudentBatch.batch_id == batch_id,
            StudentBatch.institute_id == institute_id,
            StudentBatch.removed_at.is_(None),
            Batch.deleted_at.is_(None),
        )
    )
    # Multi-entity SELECT returns a Row object — use .one_or_none() not .scalar_one_or_none()
    # (scalar_one_or_none would silently return only StudentBatch, not the tuple).
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        raise LookupError("Enrollment not found")
    enrollment, batch = row

    previous_end = enrollment.extended_end_date or batch.end_date

    effective_type = context
    if context == "adjust":
        effective_type = "extend" if target > previous_end else "shorten"

    enrollment.extended_end_date = target

    # Granting or extending access should also ensure the enrollment is active.
    # A deactivated enrollment would otherwise still be hidden from the student's
    # course list even though access has been granted. Shortening leaves is_active
    # alone so manual deactivations are respected.
    if effective_type in ("initial", "extend"):
        enrollment.is_active = True

    log = BatchExtensionLog(
        student_batch_id=enrollment.id,
        student_id=student_id,
        batch_id=batch_id,
        institute_id=institute_id,
        previous_end_date=previous_end,
        new_end_date=target,
        extension_type=effective_type,
        duration_days=days,
        reason=reason,
        extended_by=actor_id,
    )
    db.add(log)
    await db.flush()

    if effective_type in ("extend", "shorten"):
        await queue_webhook_event(
            session=db,
            institute_id=institute_id,
            event_type="enrollment.access_changed",
            data={
                "student_id": str(student_id),
                "batch_id": str(batch_id),
                "previous_end_date": previous_end.isoformat() if previous_end else None,
                "new_end_date": target.isoformat(),
                "extension_type": effective_type,
                "reason": reason,
            },
        )

    if not skip_notification:
        from app.services import notification_service
        try:
            await notification_service.create_notification(
                db,
                user_id=student_id,
                type="batch_extension",
                title="Access Window Updated",
                message=f"Your access window has been updated. New end date: {target.strftime('%b %d, %Y')}.",
                link=f"/courses?batch={batch_id}",
                institute_id=institute_id,
            )
        except Exception:
            pass  # Don't fail the operation if notification fails

    return {
        "previous_end_date": previous_end,
        "new_end_date": target,
        "extension_type": effective_type,
    }

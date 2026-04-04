"""Business logic for the certification system."""
import logging
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.certificate import Certificate, CertificateCounter
from app.models.course import Lecture, BatchCourse, Course
from app.models.batch import Batch, StudentBatch
from app.models.progress import LectureProgress
from app.models.settings import SystemSetting
from app.models.user import User
from app.models.enums import CertificateStatus
from app.utils.certificate_pdf import generate_certificate_pdf, CertDesign
from app.utils.s3 import _get_client as get_s3_client, generate_certificate_key
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Certificate Design Loader ─────────────────────────────────────────

async def _load_cert_design(session: AsyncSession, institute_id: uuid.UUID = None) -> CertDesign:
    """Load cert design settings from SystemSetting table."""
    query = select(SystemSetting).where(SystemSetting.setting_key.like("cert_%"))
    if institute_id is not None:
        query = query.where(SystemSetting.institute_id == institute_id)
    else:
        query = query.where(SystemSetting.institute_id.is_(None))
    result = await session.execute(query)
    raw = {s.setting_key: s.value for s in result.scalars().all()}
    return CertDesign(
        primary_color=raw.get("cert_primary_color", "#1A1A1A"),
        accent_color=raw.get("cert_accent_color", "#C5D86D"),
        institute_name=raw.get("cert_institute_name", "ICT INSTITUTE"),
        website_url=raw.get("cert_website_url", "https://ict.net.pk"),
        logo_data_url=raw.get("cert_logo_url"),
        title=raw.get("cert_title", "CERTIFICATE OF COMPLETION"),
        body_line1=raw.get("cert_body_line1", "This is to certify that"),
        body_line2=raw.get("cert_body_line2", "has successfully completed the course"),
        sig1_label=raw.get("cert_sig1_label", "Director"),
        sig1_name=raw.get("cert_sig1_name", ""),
        sig1_image_data_url=raw.get("cert_sig1_image"),
        sig2_label=raw.get("cert_sig2_label", "Course Instructor"),
        sig2_name=raw.get("cert_sig2_name", ""),
        sig2_image_data_url=raw.get("cert_sig2_image"),
        border_style=raw.get("cert_border_style", "classic"),
    )


# ── Eligibility ──────────────────────────────────────────────────────

async def calculate_completion_percentage(
    session: AsyncSession, student_id: uuid.UUID, batch_id: uuid.UUID, course_id: uuid.UUID,
    institute_id: uuid.UUID = None,
) -> int:
    """Average watch_percentage across all lectures in a batch-course for a student."""
    # Count total lectures (tenant-scoped)
    total_q = (
        select(func.count(Lecture.id))
        .where(
            Lecture.batch_id == batch_id,
            Lecture.course_id == course_id,
            Lecture.deleted_at.is_(None),
        )
    )
    if institute_id is not None:
        total_q = total_q.where(Lecture.institute_id == institute_id)
    total_result = await session.execute(total_q)
    total_lectures = total_result.scalar() or 0

    if total_lectures == 0:
        return 0

    # Sum of watch percentages (LEFT JOIN treats missing as 0, tenant-scoped)
    sum_q = (
        select(func.coalesce(func.sum(LectureProgress.watch_percentage), 0))
        .select_from(Lecture)
        .outerjoin(
            LectureProgress,
            and_(
                LectureProgress.lecture_id == Lecture.id,
                LectureProgress.student_id == student_id,
            ),
        )
        .where(
            Lecture.batch_id == batch_id,
            Lecture.course_id == course_id,
            Lecture.deleted_at.is_(None),
        )
    )
    if institute_id is not None:
        sum_q = sum_q.where(Lecture.institute_id == institute_id)
    sum_result = await session.execute(sum_q)
    total_watched = sum_result.scalar() or 0

    return int(total_watched / total_lectures)


async def get_completion_threshold(session: AsyncSession, institute_id: uuid.UUID = None) -> int:
    """Read threshold from system_settings, default 70."""
    query = select(SystemSetting).where(SystemSetting.setting_key == "certificate_completion_threshold")
    if institute_id is not None:
        query = query.where(SystemSetting.institute_id == institute_id)
    else:
        query = query.where(SystemSetting.institute_id.is_(None))
    result = await session.execute(query)
    setting = result.scalar_one_or_none()
    if setting:
        try:
            return int(setting.value)
        except ValueError:
            pass
    return 70


async def check_eligibility(
    session: AsyncSession, student_id: uuid.UUID, batch_id: uuid.UUID, course_id: uuid.UUID,
    institute_id: uuid.UUID = None,
) -> tuple[bool, int]:
    """Returns (is_eligible, completion_percentage)."""
    pct = await calculate_completion_percentage(session, student_id, batch_id, course_id, institute_id=institute_id)
    threshold = await get_completion_threshold(session, institute_id=institute_id)
    return pct >= threshold, pct


# ── Certificate ID Generation ────────────────────────────────────────

async def generate_certificate_id(session: AsyncSession, institute_id: uuid.UUID) -> str:
    """Generate sequential human-readable ID like ICT-2026-00001, with year rollover per institute."""
    current_year = datetime.now(timezone.utc).year

    # Load custom prefix from settings
    prefix_row = await session.execute(
        select(SystemSetting).where(
            SystemSetting.setting_key == "cert_id_prefix",
            SystemSetting.institute_id == institute_id,
        )
    )
    prefix_setting = prefix_row.scalar_one_or_none()
    prefix = prefix_setting.value if prefix_setting else "ICT"

    # Lock the counter row for update (per institute + year)
    result = await session.execute(
        select(CertificateCounter).where(
            CertificateCounter.institute_id == institute_id,
            CertificateCounter.current_year == current_year,
        ).with_for_update()
    )
    counter = result.scalar_one_or_none()

    if counter is None:
        counter = CertificateCounter(institute_id=institute_id, current_year=current_year, last_sequence=0)
        session.add(counter)

    counter.last_sequence += 1
    seq = counter.last_sequence

    return f"{prefix}-{current_year}-{seq:05d}"


async def generate_verification_code() -> str:
    """12-char alphanumeric code."""
    return secrets.token_urlsafe(9)[:12].upper()


# ── Student Dashboard ────────────────────────────────────────────────

async def get_student_dashboard(
    session: AsyncSession, student_id: uuid.UUID, institute_id: uuid.UUID = None,
) -> list[dict]:
    """Get all enrolled courses with progress and certificate status for a student.

    Optimized: 4 queries total instead of N+1 nested loops.
    """
    threshold = await get_completion_threshold(session, institute_id=institute_id)

    # Query 1: All active enrollments with batch info (1 query)
    enroll_filters = [
        StudentBatch.student_id == student_id,
        StudentBatch.removed_at.is_(None),
        Batch.deleted_at.is_(None),
    ]
    if institute_id is not None:
        enroll_filters.append(Batch.institute_id == institute_id)
    enrolled_q = (
        select(StudentBatch.batch_id, Batch.name.label("batch_name"))
        .join(Batch, StudentBatch.batch_id == Batch.id)
        .where(*enroll_filters)
    )
    enrolled_result = await session.execute(enrolled_q)
    enrollments = enrolled_result.all()

    if not enrollments:
        return []

    batch_ids = [e[0] for e in enrollments]
    batch_names = {e[0]: e[1] for e in enrollments}

    # Query 2: All batch-courses with course info for enrolled batches (1 query)
    bc_q = (
        select(BatchCourse.batch_id, BatchCourse.course_id, Course.title)
        .join(Course, BatchCourse.course_id == Course.id)
        .where(
            BatchCourse.batch_id.in_(batch_ids),
            BatchCourse.deleted_at.is_(None),
            Course.deleted_at.is_(None),
        )
    )
    bc_result = await session.execute(bc_q)
    batch_courses = bc_result.all()

    if not batch_courses:
        return []

    # Query 3: Bulk completion calculation for all batch-course combos (1 query)
    completion_q = (
        select(
            Lecture.batch_id,
            Lecture.course_id,
            func.count(Lecture.id).label("total_lectures"),
            func.coalesce(func.sum(LectureProgress.watch_percentage), 0).label("total_watched"),
        )
        .outerjoin(
            LectureProgress,
            and_(
                LectureProgress.lecture_id == Lecture.id,
                LectureProgress.student_id == student_id,
            ),
        )
        .where(
            Lecture.batch_id.in_(batch_ids),
            Lecture.deleted_at.is_(None),
        )
        .group_by(Lecture.batch_id, Lecture.course_id)
    )
    completion_result = await session.execute(completion_q)
    completion_map = {}
    for batch_id_r, course_id_r, total, watched in completion_result.all():
        pct = int(watched / total) if total > 0 else 0
        completion_map[(batch_id_r, course_id_r)] = pct

    # Query 4: All certificates for this student (1 query)
    cert_q = (
        select(Certificate)
        .where(Certificate.student_id == student_id, Certificate.deleted_at.is_(None))
    )
    cert_result = await session.execute(cert_q)
    cert_map = {(c.batch_id, c.course_id): c for c in cert_result.scalars().all()}

    # Build dashboard (no more queries)
    dashboard = []
    for batch_id, course_id, course_title in batch_courses:
        pct = completion_map.get((batch_id, course_id), 0)
        cert = cert_map.get((batch_id, course_id))

        if cert:
            if cert.status == CertificateStatus.approved:
                status = "approved"
            elif cert.status == CertificateStatus.revoked:
                status = "revoked"
            else:
                status = "pending"
        else:
            if pct == 0:
                status = "not_started"
            elif pct < threshold:
                status = "in_progress"
            else:
                status = "eligible"

        dashboard.append({
            "batch_id": batch_id,
            "batch_name": batch_names[batch_id],
            "course_id": course_id,
            "course_title": course_title,
            "completion_percentage": pct,
            "threshold": threshold,
            "status": status,
            "certificate_id": cert.id if cert else None,
            "certificate_name": cert.certificate_name if cert else None,
            "issued_at": cert.issued_at if cert else None,
        })

    return dashboard


# ── Certificate Request (Student) ────────────────────────────────────

async def request_certificate(
    session: AsyncSession,
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
    course_id: uuid.UUID,
    certificate_name: str,
    institute_id: uuid.UUID = None,
) -> Certificate:
    """Student requests a certificate with their chosen name."""
    # Verify enrollment
    enrollment = (await session.execute(
        select(StudentBatch).where(
            StudentBatch.student_id == student_id,
            StudentBatch.batch_id == batch_id,
            StudentBatch.removed_at.is_(None),
        )
    )).scalar_one_or_none()
    if not enrollment:
        raise ValueError("Student is not enrolled in this batch")

    # Check eligibility (tenant-scoped)
    is_eligible, pct = await check_eligibility(session, student_id, batch_id, course_id, institute_id=institute_id)
    if not is_eligible:
        raise ValueError(f"Completion percentage ({pct}%) does not meet the threshold")

    # Check no existing cert record
    existing = (await session.execute(
        select(Certificate).where(
            Certificate.student_id == student_id,
            Certificate.batch_id == batch_id,
            Certificate.course_id == course_id,
            Certificate.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if existing:
        raise ValueError("A certificate request already exists for this course")

    now = datetime.now(timezone.utc)
    cert = Certificate(
        student_id=student_id,
        batch_id=batch_id,
        course_id=course_id,
        certificate_name=certificate_name.strip(),
        status=CertificateStatus.eligible,
        completion_percentage=pct,
        requested_at=now,
        institute_id=institute_id,
    )
    session.add(cert)
    await session.flush()
    return cert


# ── Approve Existing Request (CC) ────────────────────────────────────

async def approve_existing_certificate(
    session: AsyncSession, cert_uuid: uuid.UUID, approved_by: uuid.UUID,
    institute_id: uuid.UUID = None,
) -> Certificate:
    """Approve a pending certificate request — generate cert_id, verification_code, PDF."""
    query = select(Certificate).where(Certificate.id == cert_uuid, Certificate.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Certificate.institute_id == institute_id)
    result = await session.execute(query)
    cert = result.scalar_one_or_none()
    if not cert:
        raise ValueError("Certificate request not found")
    if cert.status != CertificateStatus.eligible:
        raise ValueError(f"Certificate is not in pending state (current: {cert.status.value})")

    # Get student, batch, course
    student = (await session.execute(select(User).where(User.id == cert.student_id))).scalar_one()
    batch = (await session.execute(select(Batch).where(Batch.id == cert.batch_id))).scalar_one()
    course = (await session.execute(select(Course).where(Course.id == cert.course_id))).scalar_one()

    cert_id = await generate_certificate_id(session, institute_id=cert.institute_id)
    verification_code = await generate_verification_code()

    now = datetime.now(timezone.utc)
    cert.certificate_id = cert_id
    cert.verification_code = verification_code
    cert.status = CertificateStatus.approved
    cert.approved_by = approved_by
    cert.approved_at = now
    cert.issued_at = now
    cert.updated_at = now

    # Use certificate_name if set, otherwise fall back to student account name
    student_name = cert.certificate_name or student.name
    issue_date_str = now.strftime("%B %d, %Y")
    verification_url = f"{settings.FRONTEND_URL}/verify?code={verification_code}"

    # Generate PDF
    try:
        design = await _load_cert_design(session, institute_id=cert.institute_id)
        pdf_bytes = generate_certificate_pdf(
            student_name=student_name,
            course_title=course.title,
            batch_name=batch.name,
            certificate_id=cert_id,
            verification_code=verification_code,
            issue_date=issue_date_str,
            verification_url=verification_url,
            design=design,
        )

        s3 = get_s3_client()
        object_key = generate_certificate_key(cert_id, institute_id=cert.institute_id)
        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=object_key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )
        cert.pdf_path = object_key
    except Exception as e:
        logger.error("Failed to generate/upload certificate PDF: %s", e)

    await session.flush()

    # Send certificate issued email
    try:
        from app.utils.email_sender import send_email_background, get_institute_branding, build_portal_url, should_send_email
        from app.utils.email_templates import certificate_issued_email
        if not await should_send_email(session, cert.institute_id, cert.student_id, "email_certificate"):
            return cert

        student = await session.get(User, cert.student_id)
        course = None
        if cert.course_id:
            from app.models.course import Course
            course = await session.get(Course, cert.course_id)

        if student and student.email and cert.institute_id:
            branding = await get_institute_branding(session, cert.institute_id)
            portal_url = build_portal_url(branding["slug"], str(student.id), "certificates")

            subj, html = certificate_issued_email(
                student_name=student.name,
                course_name=course.title if course else cert.certificate_name or "Course",
                cert_id=cert.certificate_id or "",
                verification_code=cert.verification_code or "",
                portal_url=portal_url,
                institute_name=branding["name"],
                logo_url=branding.get("logo_url"),
                accent_color=branding.get("accent_color", "#C5D86D"),
            )
            send_email_background(student.email, subj, html, from_name=branding["name"])
    except Exception:
        pass  # Best-effort

    return cert


# ── List Certificate Requests (CC) ───────────────────────────────────

async def list_certificate_requests(
    session: AsyncSession,
    current_user: "User",
    batch_id: uuid.UUID | None = None,
    course_id: uuid.UUID | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List pending certificate requests (status=eligible with requested_at set)."""
    base = (
        select(Certificate, User.name, User.email, Batch.name, Course.title)
        .join(User, Certificate.student_id == User.id)
        .join(Batch, Certificate.batch_id == Batch.id)
        .join(Course, Certificate.course_id == Course.id)
        .where(
            Certificate.deleted_at.is_(None),
            Certificate.status == CertificateStatus.eligible,
            Certificate.requested_at.isnot(None),
            Certificate.institute_id == current_user.institute_id,
        )
    )

    # CC scoping — only see requests for courses they created
    if current_user.role.value == "course_creator":
        base = base.where(Course.created_by == current_user.id)

    if batch_id:
        base = base.where(Certificate.batch_id == batch_id)
    if course_id:
        base = base.where(Certificate.course_id == course_id)
    if search:
        term = f"%{search}%"
        base = base.where(User.name.ilike(term) | User.email.ilike(term))

    # Count
    from sqlalchemy import func as sa_func
    count_q = select(sa_func.count()).select_from(base.subquery())
    total = (await session.execute(count_q)).scalar() or 0

    # Paginate
    query = base.order_by(Certificate.requested_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await session.execute(query)

    requests = []
    for cert, student_name, student_email, batch_name, course_title in result.all():
        requests.append({
            "student_id": cert.student_id,
            "student_name": student_name,
            "student_email": student_email,
            "completion_percentage": cert.completion_percentage,
            "certificate_name": cert.certificate_name,
            "requested_at": cert.requested_at,
            "has_requested": True,
            "cert_uuid": cert.id,
        })

    return requests, total


# ── Core Operations ──────────────────────────────────────────────────

async def create_and_approve_certificate(
    session: AsyncSession,
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
    course_id: uuid.UUID,
    completion_percentage: int,
    approved_by: uuid.UUID,
    certificate_name: str | None = None,
    institute_id: uuid.UUID = None,
) -> Certificate:
    """Create a certificate with status=approved, generate PDF, upload to S3."""
    # Check for existing certificate
    existing = await session.execute(
        select(Certificate).where(
            Certificate.student_id == student_id,
            Certificate.batch_id == batch_id,
            Certificate.course_id == course_id,
            Certificate.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Certificate already exists for this student, batch, and course")

    # Get student, batch, course names
    student = (await session.execute(select(User).where(User.id == student_id))).scalar_one()
    batch = (await session.execute(select(Batch).where(Batch.id == batch_id))).scalar_one()
    course = (await session.execute(select(Course).where(Course.id == course_id))).scalar_one()

    cert_id = await generate_certificate_id(session, institute_id=institute_id)
    verification_code = await generate_verification_code()

    now = datetime.now(timezone.utc)
    student_name = certificate_name or student.name
    issue_date_str = now.strftime("%B %d, %Y")
    verification_url = f"{settings.FRONTEND_URL}/verify?code={verification_code}"

    cert = Certificate(
        student_id=student_id,
        batch_id=batch_id,
        course_id=course_id,
        certificate_id=cert_id,
        verification_code=verification_code,
        certificate_name=certificate_name,
        status=CertificateStatus.approved,
        completion_percentage=completion_percentage,
        approved_by=approved_by,
        approved_at=now,
        issued_at=now,
        institute_id=institute_id,
    )

    # Generate PDF
    try:
        design = await _load_cert_design(session, institute_id=institute_id)
        pdf_bytes = generate_certificate_pdf(
            student_name=student_name,
            course_title=course.title,
            batch_name=batch.name,
            certificate_id=cert_id,
            verification_code=verification_code,
            issue_date=issue_date_str,
            verification_url=verification_url,
            design=design,
        )

        # Upload to S3
        s3 = get_s3_client()
        object_key = generate_certificate_key(cert_id, institute_id=institute_id)
        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=object_key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )
        cert.pdf_path = object_key
    except Exception as e:
        logger.error("Failed to generate/upload certificate PDF: %s", e)
        # Still create the cert record, PDF can be regenerated later

    session.add(cert)
    await session.flush()
    return cert


async def revoke_certificate(
    session: AsyncSession, cert_uuid: uuid.UUID, revoked_by: uuid.UUID, reason: str,
    institute_id: uuid.UUID = None,
) -> Certificate:
    """Revoke an issued certificate."""
    query = select(Certificate).where(Certificate.id == cert_uuid, Certificate.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Certificate.institute_id == institute_id)
    result = await session.execute(query)
    cert = result.scalar_one_or_none()
    if not cert:
        raise ValueError("Certificate not found")
    if cert.status == CertificateStatus.revoked:
        raise ValueError("Certificate is already revoked")

    cert.status = CertificateStatus.revoked
    cert.revoked_by = revoked_by
    cert.revoked_at = datetime.now(timezone.utc)
    cert.revocation_reason = reason
    cert.updated_at = datetime.now(timezone.utc)
    await session.flush()
    return cert


async def get_certificate(session: AsyncSession, cert_uuid: uuid.UUID, institute_id: uuid.UUID = None) -> dict | None:
    """Get certificate with joined names."""
    query = (
        select(Certificate, User.name, User.email, Batch.name, Course.title)
        .join(User, Certificate.student_id == User.id)
        .join(Batch, Certificate.batch_id == Batch.id)
        .join(Course, Certificate.course_id == Course.id)
        .where(Certificate.id == cert_uuid, Certificate.deleted_at.is_(None))
    )
    if institute_id is not None:
        query = query.where(Certificate.institute_id == institute_id)
    result = await session.execute(query)
    row = result.one_or_none()
    if not row:
        return None

    cert, student_name, student_email, batch_name, course_title = row
    return {
        "id": cert.id,
        "student_id": cert.student_id,
        "student_name": student_name,
        "student_email": student_email,
        "batch_id": cert.batch_id,
        "batch_name": batch_name,
        "course_id": cert.course_id,
        "course_title": course_title,
        "certificate_id": cert.certificate_id,
        "verification_code": cert.verification_code,
        "certificate_name": cert.certificate_name,
        "requested_at": cert.requested_at,
        "status": cert.status.value,
        "completion_percentage": cert.completion_percentage,
        "approved_by": cert.approved_by,
        "approved_at": cert.approved_at,
        "issued_at": cert.issued_at,
        "revoked_at": cert.revoked_at,
        "revocation_reason": cert.revocation_reason,
        "created_at": cert.created_at,
    }


async def get_certificate_by_verification_code(session: AsyncSession, code: str, institute_id: uuid.UUID = None) -> dict | None:
    """Public lookup by verification code."""
    query = (
        select(Certificate, User.name, Batch.name, Course.title)
        .join(User, Certificate.student_id == User.id)
        .join(Batch, Certificate.batch_id == Batch.id)
        .join(Course, Certificate.course_id == Course.id)
        .where(Certificate.verification_code == code, Certificate.deleted_at.is_(None))
    )
    if institute_id is not None:
        query = query.where(Certificate.institute_id == institute_id)
    result = await session.execute(query)
    row = result.one_or_none()
    if not row:
        return None

    cert, student_name, batch_name, course_title = row
    return {
        "valid": cert.status == CertificateStatus.approved,
        "certificate_id": cert.certificate_id,
        "student_name": student_name,
        "certificate_name": cert.certificate_name,
        "course_title": course_title,
        "batch_name": batch_name,
        "issued_at": cert.issued_at,
        "status": cert.status.value,
    }


async def list_eligible_students(
    session: AsyncSession, batch_id: uuid.UUID, course_id: uuid.UUID, page: int, per_page: int,
    institute_id: uuid.UUID = None,
) -> tuple[list[dict], int]:
    """Students enrolled in batch who meet threshold and don't have a cert yet.

    Optimized: 4 queries total instead of 2+ per student.
    """
    threshold = await get_completion_threshold(session, institute_id=institute_id)

    # Query 1: Get enrolled students with user info (1 JOIN query)
    enrolled_q = (
        select(User.id, User.name, User.email)
        .join(StudentBatch, StudentBatch.student_id == User.id)
        .where(
            StudentBatch.batch_id == batch_id,
            StudentBatch.removed_at.is_(None),
            User.deleted_at.is_(None),
        )
    )
    enrolled_result = await session.execute(enrolled_q)
    enrolled_students = enrolled_result.all()

    if not enrolled_students:
        return [], 0

    enrolled_ids = [s[0] for s in enrolled_students]
    student_info = {s[0]: {"name": s[1], "email": s[2]} for s in enrolled_students}

    # Query 2: Exclude students who already have a certificate
    existing_q = (
        select(Certificate.student_id)
        .where(
            Certificate.batch_id == batch_id,
            Certificate.course_id == course_id,
            Certificate.deleted_at.is_(None),
        )
    )
    existing_result = await session.execute(existing_q)
    existing_ids = {row[0] for row in existing_result.all()}

    candidate_ids = [sid for sid in enrolled_ids if sid not in existing_ids]
    if not candidate_ids:
        return [], 0

    # Query 3: Total lectures for this batch-course
    total_q = (
        select(func.count(Lecture.id))
        .where(
            Lecture.batch_id == batch_id,
            Lecture.course_id == course_id,
            Lecture.deleted_at.is_(None),
        )
    )
    total_lectures = (await session.execute(total_q)).scalar() or 0

    if total_lectures == 0:
        return [], 0

    # Query 4: Bulk completion for all candidates at once
    completion_q = (
        select(
            LectureProgress.student_id,
            func.coalesce(func.sum(LectureProgress.watch_percentage), 0).label("total_watched"),
        )
        .join(Lecture, LectureProgress.lecture_id == Lecture.id)
        .where(
            LectureProgress.student_id.in_(candidate_ids),
            Lecture.batch_id == batch_id,
            Lecture.course_id == course_id,
            Lecture.deleted_at.is_(None),
        )
        .group_by(LectureProgress.student_id)
    )
    completion_result = await session.execute(completion_q)
    watched_map = dict(completion_result.all())

    # Build eligible list (no more queries)
    eligible = []
    for sid in candidate_ids:
        total_watched = watched_map.get(sid, 0)
        pct = int(total_watched / total_lectures) if total_lectures > 0 else 0
        if pct >= threshold:
            info = student_info[sid]
            eligible.append({
                "student_id": sid,
                "student_name": info["name"],
                "student_email": info["email"],
                "completion_percentage": pct,
            })

    total = len(eligible)
    eligible.sort(key=lambda x: x["completion_percentage"], reverse=True)
    start = (page - 1) * per_page
    return eligible[start : start + per_page], total


async def list_certificates(
    session: AsyncSession,
    current_user: "User",
    batch_id: uuid.UUID | None = None,
    course_id: uuid.UUID | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List certificates scoped by role."""
    base = (
        select(Certificate, User.name, User.email, Batch.name, Course.title)
        .join(User, Certificate.student_id == User.id)
        .join(Batch, Certificate.batch_id == Batch.id)
        .join(Course, Certificate.course_id == Course.id)
        .where(Certificate.deleted_at.is_(None), Certificate.institute_id == current_user.institute_id)
    )

    # Role scoping
    if current_user.role.value == "student":
        base = base.where(Certificate.student_id == current_user.id)
    elif current_user.role.value == "course_creator":
        # CC sees certs for courses they created
        base = base.where(Course.created_by == current_user.id)
    # admin sees all

    if batch_id:
        base = base.where(Certificate.batch_id == batch_id)
    if course_id:
        base = base.where(Certificate.course_id == course_id)
    if status:
        base = base.where(Certificate.status == status)

    # Count
    from sqlalchemy import func as sa_func
    count_q = select(sa_func.count()).select_from(base.subquery())
    total = (await session.execute(count_q)).scalar() or 0

    # Paginate
    query = base.order_by(Certificate.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await session.execute(query)

    certs = []
    for cert, student_name, student_email, batch_name, course_title in result.all():
        certs.append({
            "id": cert.id,
            "student_id": cert.student_id,
            "student_name": student_name,
            "student_email": student_email,
            "batch_id": cert.batch_id,
            "batch_name": batch_name,
            "course_id": cert.course_id,
            "course_title": course_title,
            "certificate_id": cert.certificate_id,
            "verification_code": cert.verification_code,
            "certificate_name": cert.certificate_name,
            "requested_at": cert.requested_at,
            "status": cert.status.value,
            "completion_percentage": cert.completion_percentage,
            "approved_by": cert.approved_by,
            "approved_at": cert.approved_at,
            "issued_at": cert.issued_at,
            "revoked_at": cert.revoked_at,
            "revocation_reason": cert.revocation_reason,
            "created_at": cert.created_at,
        })

    return certs, total


async def get_download_url(session: AsyncSession, cert_uuid: uuid.UUID, institute_id: uuid.UUID = None) -> str | None:
    """Get a presigned S3 download URL for the certificate PDF."""
    query = select(Certificate).where(Certificate.id == cert_uuid, Certificate.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Certificate.institute_id == institute_id)
    result = await session.execute(query)
    cert = result.scalar_one_or_none()
    if not cert or not cert.pdf_path:
        return None

    from app.utils.s3 import generate_download_url
    return generate_download_url(cert.pdf_path, f"{cert.certificate_id}.pdf")

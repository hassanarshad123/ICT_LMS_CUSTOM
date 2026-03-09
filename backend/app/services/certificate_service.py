"""Business logic for the certification system."""
import logging
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.certificate import Certificate, CertificateCounter
from app.models.course import Lecture, BatchCourse
from app.models.batch import Batch, StudentBatch
from app.models.other import LectureProgress, SystemSetting
from app.models.user import User
from app.models.enums import CertificateStatus
from app.utils.certificate_pdf import generate_certificate_pdf
from app.utils.s3 import _get_client as get_s3_client
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Eligibility ──────────────────────────────────────────────────────

async def calculate_completion_percentage(
    session: AsyncSession, student_id: uuid.UUID, batch_id: uuid.UUID, course_id: uuid.UUID,
) -> int:
    """Average watch_percentage across all lectures in a batch-course for a student."""
    # Count total lectures
    total_q = (
        select(func.count(Lecture.id))
        .where(
            Lecture.batch_id == batch_id,
            Lecture.course_id == course_id,
            Lecture.deleted_at.is_(None),
        )
    )
    total_result = await session.execute(total_q)
    total_lectures = total_result.scalar() or 0

    if total_lectures == 0:
        return 0

    # Sum of watch percentages (LEFT JOIN treats missing as 0)
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
    sum_result = await session.execute(sum_q)
    total_watched = sum_result.scalar() or 0

    return int(total_watched / total_lectures)


async def get_completion_threshold(session: AsyncSession) -> int:
    """Read threshold from system_settings, default 70."""
    result = await session.execute(
        select(SystemSetting).where(SystemSetting.setting_key == "certificate_completion_threshold")
    )
    setting = result.scalar_one_or_none()
    if setting:
        try:
            return int(setting.value)
        except ValueError:
            pass
    return 70


async def check_eligibility(
    session: AsyncSession, student_id: uuid.UUID, batch_id: uuid.UUID, course_id: uuid.UUID,
) -> tuple[bool, int]:
    """Returns (is_eligible, completion_percentage)."""
    pct = await calculate_completion_percentage(session, student_id, batch_id, course_id)
    threshold = await get_completion_threshold(session)
    return pct >= threshold, pct


# ── Certificate ID Generation ────────────────────────────────────────

async def generate_certificate_id(session: AsyncSession) -> str:
    """Generate sequential human-readable ID like ICT-2026-00001, with year rollover."""
    current_year = datetime.now(timezone.utc).year

    # Lock the counter row for update
    result = await session.execute(
        select(CertificateCounter).where(CertificateCounter.id == 1).with_for_update()
    )
    counter = result.scalar_one_or_none()

    if counter is None:
        counter = CertificateCounter(id=1, current_year=current_year, last_sequence=0)
        session.add(counter)

    if counter.current_year != current_year:
        counter.current_year = current_year
        counter.last_sequence = 0

    counter.last_sequence += 1
    seq = counter.last_sequence

    return f"ICT-{current_year}-{seq:05d}"


async def generate_verification_code() -> str:
    """12-char alphanumeric code."""
    return secrets.token_urlsafe(9)[:12].upper()


# ── Core Operations ──────────────────────────────────────────────────

async def create_and_approve_certificate(
    session: AsyncSession,
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
    course_id: uuid.UUID,
    completion_percentage: int,
    approved_by: uuid.UUID,
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
    course_result = await session.execute(
        select(Lecture.course_id).where(Lecture.course_id == course_id).limit(1)
    )
    from app.models.course import Course
    course = (await session.execute(select(Course).where(Course.id == course_id))).scalar_one()

    cert_id = await generate_certificate_id(session)
    verification_code = await generate_verification_code()

    now = datetime.now(timezone.utc)
    issue_date_str = now.strftime("%B %d, %Y")
    verification_url = f"{settings.FRONTEND_URL}/verify?code={verification_code}"

    cert = Certificate(
        student_id=student_id,
        batch_id=batch_id,
        course_id=course_id,
        certificate_id=cert_id,
        verification_code=verification_code,
        status=CertificateStatus.approved,
        completion_percentage=completion_percentage,
        approved_by=approved_by,
        approved_at=now,
        issued_at=now,
    )

    # Generate PDF
    try:
        pdf_bytes = generate_certificate_pdf(
            student_name=student.name,
            course_title=course.title,
            batch_name=batch.name,
            certificate_id=cert_id,
            verification_code=verification_code,
            issue_date=issue_date_str,
            verification_url=verification_url,
        )

        # Upload to S3
        s3 = get_s3_client()
        object_key = f"certificates/{cert_id}.pdf"
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
) -> Certificate:
    """Revoke an issued certificate."""
    result = await session.execute(
        select(Certificate).where(Certificate.id == cert_uuid, Certificate.deleted_at.is_(None))
    )
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


async def get_certificate(session: AsyncSession, cert_uuid: uuid.UUID) -> dict | None:
    """Get certificate with joined names."""
    from app.models.course import Course

    result = await session.execute(
        select(Certificate, User.name, User.email, Batch.name, Course.title)
        .join(User, Certificate.student_id == User.id)
        .join(Batch, Certificate.batch_id == Batch.id)
        .join(Course, Certificate.course_id == Course.id)
        .where(Certificate.id == cert_uuid, Certificate.deleted_at.is_(None))
    )
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
        "status": cert.status.value,
        "completion_percentage": cert.completion_percentage,
        "approved_by": cert.approved_by,
        "approved_at": cert.approved_at,
        "issued_at": cert.issued_at,
        "revoked_at": cert.revoked_at,
        "revocation_reason": cert.revocation_reason,
        "created_at": cert.created_at,
    }


async def get_certificate_by_verification_code(session: AsyncSession, code: str) -> dict | None:
    """Public lookup by verification code."""
    from app.models.course import Course

    result = await session.execute(
        select(Certificate, User.name, Batch.name, Course.title)
        .join(User, Certificate.student_id == User.id)
        .join(Batch, Certificate.batch_id == Batch.id)
        .join(Course, Certificate.course_id == Course.id)
        .where(Certificate.verification_code == code, Certificate.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        return None

    cert, student_name, batch_name, course_title = row
    return {
        "valid": cert.status == CertificateStatus.approved,
        "certificate_id": cert.certificate_id,
        "student_name": student_name,
        "course_title": course_title,
        "batch_name": batch_name,
        "issued_at": cert.issued_at,
        "status": cert.status.value,
    }


async def list_eligible_students(
    session: AsyncSession, batch_id: uuid.UUID, course_id: uuid.UUID, page: int, per_page: int,
) -> tuple[list[dict], int]:
    """Students enrolled in batch who meet threshold and don't have a cert yet."""
    threshold = await get_completion_threshold(session)

    # Get enrolled students
    enrolled_q = (
        select(StudentBatch.student_id)
        .where(StudentBatch.batch_id == batch_id, StudentBatch.removed_at.is_(None))
    )
    enrolled_result = await session.execute(enrolled_q)
    enrolled_ids = [row[0] for row in enrolled_result.all()]

    if not enrolled_ids:
        return [], 0

    # Exclude students who already have a certificate
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

    # Calculate completion for each candidate
    eligible = []
    for sid in candidate_ids:
        pct = await calculate_completion_percentage(session, sid, batch_id, course_id)
        if pct >= threshold:
            # Get student info
            student = (await session.execute(select(User).where(User.id == sid))).scalar_one()
            eligible.append({
                "student_id": student.id,
                "student_name": student.name,
                "student_email": student.email,
                "completion_percentage": pct,
            })

    total = len(eligible)
    # Sort by completion percentage descending
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
    from app.models.course import Course

    base = (
        select(Certificate, User.name, User.email, Batch.name, Course.title)
        .join(User, Certificate.student_id == User.id)
        .join(Batch, Certificate.batch_id == Batch.id)
        .join(Course, Certificate.course_id == Course.id)
        .where(Certificate.deleted_at.is_(None))
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


async def get_download_url(session: AsyncSession, cert_uuid: uuid.UUID) -> str | None:
    """Get a presigned S3 download URL for the certificate PDF."""
    result = await session.execute(
        select(Certificate).where(Certificate.id == cert_uuid, Certificate.deleted_at.is_(None))
    )
    cert = result.scalar_one_or_none()
    if not cert or not cert.pdf_path:
        return None

    from app.utils.s3 import generate_download_url
    return generate_download_url(cert.pdf_path, f"{cert.certificate_id}.pdf")

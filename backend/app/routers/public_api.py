import math
import secrets
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.database import get_session
from app.middleware.api_key_auth import PublicAuth, api_key_rate_key
from app.utils.rate_limit import limiter
from app.schemas.common import PaginatedResponse
from app.schemas.public_api import (
    PublicStudentOut, PublicStudentCreate, PublicStudentUpdate,
    PublicBatchOut,
    PublicCourseOut, PublicCourseDetailOut, PublicModuleOut,
    PublicEnrollmentOut, PublicEnrollmentCreate, PublicEnrollmentRemove,
    PublicCertificateOut,
    PublicClassOut, PublicAttendanceOut,
    PublicAnnouncementOut, PublicAnnouncementCreate,
    PublicJobOut,
)
from app.models.user import User
from app.models.batch import Batch, StudentBatch
from app.models.course import Course, CurriculumModule, BatchCourse
from app.models.certificate import Certificate
from app.models.zoom import ZoomClass, ZoomAttendance
from app.models.other import Announcement, Job
from app.models.enums import UserRole, UserStatus, CertificateStatus
from app.services import user_service, webhook_event_service

router = APIRouter()


# ── Students ──────────────────────────────────────────────────

@router.get("/students", response_model=PaginatedResponse[PublicStudentOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def list_students(
    request: Request,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    users, total = await user_service.list_users(
        session,
        page=page, per_page=per_page,
        role="student",
        status=status_filter,
        search=search,
        institute_id=auth.institute_id,
    )
    return PaginatedResponse(
        data=[
            PublicStudentOut(
                id=u.id, email=u.email, name=u.name, phone=u.phone,
                status=u.status.value, created_at=u.created_at,
            )
            for u in users
        ],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/students/{student_id}", response_model=PublicStudentOut)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def get_student(
    request: Request,
    student_id: uuid.UUID,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(User).where(
            User.id == student_id,
            User.institute_id == auth.institute_id,
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    return PublicStudentOut(
        id=user.id, email=user.email, name=user.name, phone=user.phone,
        status=user.status.value, created_at=user.created_at,
    )


@router.post("/students", response_model=PublicStudentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def create_student(
    request: Request,
    body: PublicStudentCreate,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    password = body.password or secrets.token_urlsafe(12)
    try:
        user = await user_service.create_user(
            session,
            email=body.email,
            name=body.name,
            password=password,
            role="student",
            phone=body.phone,
            institute_id=auth.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await webhook_event_service.queue_webhook_event(
        session, auth.institute_id, "user.created",
        {"user_id": str(user.id), "email": user.email, "name": user.name, "role": "student"},
    )
    await session.commit()

    return PublicStudentOut(
        id=user.id, email=user.email, name=user.name, phone=user.phone,
        status=user.status.value, created_at=user.created_at,
    )


@router.patch("/students/{student_id}", response_model=PublicStudentOut)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def update_student(
    request: Request,
    student_id: uuid.UUID,
    body: PublicStudentUpdate,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Verify student belongs to this institute
    result = await session.execute(
        select(User).where(
            User.id == student_id,
            User.institute_id == auth.institute_id,
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        user = await user_service.update_user(session, student_id, **fields)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await webhook_event_service.queue_webhook_event(
        session, auth.institute_id, "user.updated",
        {"user_id": str(user.id), "email": user.email, "name": user.name, "fields_updated": list(fields.keys())},
    )
    await session.commit()

    return PublicStudentOut(
        id=user.id, email=user.email, name=user.name, phone=user.phone,
        status=user.status.value, created_at=user.created_at,
    )


# ── Batches ───────────────────────────────────────────────────

@router.get("/batches", response_model=PaginatedResponse[PublicBatchOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def list_batches(
    request: Request,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(Batch).where(
        Batch.institute_id == auth.institute_id,
        Batch.deleted_at.is_(None),
    )
    count_q = select(func.count()).select_from(Batch).where(
        Batch.institute_id == auth.institute_id,
        Batch.deleted_at.is_(None),
    )

    total = (await session.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    batches = (await session.execute(
        query.order_by(Batch.created_at.desc()).offset(offset).limit(per_page)
    )).scalars().all()

    # Batch-fetch teacher names, student counts, course counts
    batch_ids = [b.id for b in batches]
    teacher_ids = [b.teacher_id for b in batches if b.teacher_id]

    teacher_map = {}
    if teacher_ids:
        r = await session.execute(select(User.id, User.name).where(User.id.in_(teacher_ids)))
        teacher_map = {row[0]: row[1] for row in r.all()}

    student_counts = {}
    course_counts = {}
    if batch_ids:
        r = await session.execute(
            select(StudentBatch.batch_id, func.count())
            .where(StudentBatch.batch_id.in_(batch_ids), StudentBatch.removed_at.is_(None))
            .group_by(StudentBatch.batch_id)
        )
        student_counts = {row[0]: row[1] for row in r.all()}

        r = await session.execute(
            select(BatchCourse.batch_id, func.count())
            .where(BatchCourse.batch_id.in_(batch_ids), BatchCourse.deleted_at.is_(None))
            .group_by(BatchCourse.batch_id)
        )
        course_counts = {row[0]: row[1] for row in r.all()}

    items = []
    for b in batches:
        now = datetime.now(timezone.utc).date()
        if b.end_date and b.end_date < now:
            batch_status = "completed"
        elif b.start_date and b.start_date <= now:
            batch_status = "active"
        else:
            batch_status = "upcoming"

        items.append(PublicBatchOut(
            id=b.id, name=b.name,
            start_date=b.start_date, end_date=b.end_date,
            teacher_name=teacher_map.get(b.teacher_id),
            student_count=student_counts.get(b.id, 0),
            course_count=course_counts.get(b.id, 0),
            status=batch_status,
            created_at=b.created_at,
        ))

    return PaginatedResponse(
        data=items, total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/batches/{batch_id}", response_model=PublicBatchOut)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def get_batch(
    request: Request,
    batch_id: uuid.UUID,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(Batch).where(
            Batch.id == batch_id,
            Batch.institute_id == auth.institute_id,
            Batch.deleted_at.is_(None),
        )
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")

    teacher_name = None
    if b.teacher_id:
        r = await session.execute(select(User.name).where(User.id == b.teacher_id))
        teacher_name = r.scalar_one_or_none()

    sc = (await session.execute(
        select(func.count()).select_from(StudentBatch).where(
            StudentBatch.batch_id == b.id, StudentBatch.removed_at.is_(None)
        )
    )).scalar() or 0

    cc = (await session.execute(
        select(func.count()).select_from(BatchCourse).where(
            BatchCourse.batch_id == b.id, BatchCourse.deleted_at.is_(None)
        )
    )).scalar() or 0

    now = datetime.now(timezone.utc).date()
    if b.end_date and b.end_date < now:
        batch_status = "completed"
    elif b.start_date and b.start_date <= now:
        batch_status = "active"
    else:
        batch_status = "upcoming"

    return PublicBatchOut(
        id=b.id, name=b.name,
        start_date=b.start_date, end_date=b.end_date,
        teacher_name=teacher_name,
        student_count=sc, course_count=cc,
        status=batch_status,
        created_at=b.created_at,
    )


# ── Courses ───────────────────────────────────────────────────

@router.get("/courses", response_model=PaginatedResponse[PublicCourseOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def list_courses(
    request: Request,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(Course).where(
        Course.institute_id == auth.institute_id,
        Course.deleted_at.is_(None),
    )
    count_q = select(func.count()).select_from(Course).where(
        Course.institute_id == auth.institute_id,
        Course.deleted_at.is_(None),
    )
    total = (await session.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    courses = (await session.execute(
        query.order_by(Course.created_at.desc()).offset(offset).limit(per_page)
    )).scalars().all()

    return PaginatedResponse(
        data=[
            PublicCourseOut(
                id=c.id, title=c.title, description=c.description,
                status=c.status.value, created_at=c.created_at,
            )
            for c in courses
        ],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/courses/{course_id}", response_model=PublicCourseDetailOut)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def get_course(
    request: Request,
    course_id: uuid.UUID,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(Course).where(
            Course.id == course_id,
            Course.institute_id == auth.institute_id,
            Course.deleted_at.is_(None),
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")

    modules_r = await session.execute(
        select(CurriculumModule).where(
            CurriculumModule.course_id == c.id,
            CurriculumModule.deleted_at.is_(None),
        ).order_by(CurriculumModule.sequence_order)
    )
    modules = modules_r.scalars().all()

    return PublicCourseDetailOut(
        id=c.id, title=c.title, description=c.description,
        status=c.status.value, created_at=c.created_at,
        modules=[
            PublicModuleOut(id=m.id, title=m.title, order=m.sequence_order)
            for m in modules
        ],
    )


# ── Enrollments ───────────────────────────────────────────────

@router.get("/enrollments", response_model=PaginatedResponse[PublicEnrollmentOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def list_enrollments(
    request: Request,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
    batch_id: Optional[uuid.UUID] = None,
    student_id: Optional[uuid.UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(StudentBatch).where(
        StudentBatch.institute_id == auth.institute_id,
        StudentBatch.removed_at.is_(None),
    )
    count_q = select(func.count()).select_from(StudentBatch).where(
        StudentBatch.institute_id == auth.institute_id,
        StudentBatch.removed_at.is_(None),
    )

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

    student_map = {}
    if s_ids:
        r = await session.execute(select(User.id, User.name, User.email).where(User.id.in_(s_ids)))
        student_map = {row[0]: (row[1], row[2]) for row in r.all()}

    batch_map = {}
    if b_ids:
        r = await session.execute(select(Batch.id, Batch.name).where(Batch.id.in_(b_ids)))
        batch_map = {row[0]: row[1] for row in r.all()}

    items = []
    for e in enrollments:
        s_name, s_email = student_map.get(e.student_id, ("Unknown", ""))
        items.append(PublicEnrollmentOut(
            id=e.id,
            student_id=e.student_id, student_name=s_name, student_email=s_email,
            batch_id=e.batch_id, batch_name=batch_map.get(e.batch_id, "Unknown"),
            enrolled_at=e.enrolled_at,
        ))

    return PaginatedResponse(
        data=items, total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/enrollments", response_model=PublicEnrollmentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def create_enrollment(
    request: Request,
    body: PublicEnrollmentCreate,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.services import batch_service

    try:
        sb = await batch_service.enroll_student(
            session, body.batch_id, body.student_id,
            enrolled_by=None,
            institute_id=auth.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fetch names for response
    r = await session.execute(select(User.name, User.email).where(User.id == body.student_id))
    row = r.first()
    s_name, s_email = (row[0], row[1]) if row else ("Unknown", "")

    r = await session.execute(select(Batch.name).where(Batch.id == body.batch_id))
    b_name = r.scalar_one_or_none() or "Unknown"

    await webhook_event_service.queue_webhook_event(
        session, auth.institute_id, "enrollment.created",
        {"student_id": str(body.student_id), "batch_id": str(body.batch_id)},
    )
    await session.commit()

    return PublicEnrollmentOut(
        id=sb.id,
        student_id=sb.student_id, student_name=s_name, student_email=s_email,
        batch_id=sb.batch_id, batch_name=b_name,
        enrolled_at=sb.enrolled_at,
    )


@router.delete("/enrollments", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def remove_enrollment(
    request: Request,
    body: PublicEnrollmentRemove,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.services import batch_service

    try:
        await batch_service.remove_student(
            session, body.batch_id, body.student_id,
            removed_by=None,
            institute_id=auth.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await webhook_event_service.queue_webhook_event(
        session, auth.institute_id, "enrollment.removed",
        {"student_id": str(body.student_id), "batch_id": str(body.batch_id)},
    )
    await session.commit()


# ── Certificates ──────────────────────────────────────────────

@router.get("/certificates", response_model=PaginatedResponse[PublicCertificateOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def list_certificates(
    request: Request,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
    batch_id: Optional[uuid.UUID] = None,
    course_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(Certificate).where(
        Certificate.institute_id == auth.institute_id,
        Certificate.deleted_at.is_(None),
    )
    count_q = select(func.count()).select_from(Certificate).where(
        Certificate.institute_id == auth.institute_id,
        Certificate.deleted_at.is_(None),
    )

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
    student_map = {}
    if s_ids:
        r = await session.execute(select(User.id, User.name).where(User.id.in_(s_ids)))
        student_map = {row[0]: row[1] for row in r.all()}

    return PaginatedResponse(
        data=[
            PublicCertificateOut(
                id=c.id, student_id=c.student_id,
                student_name=student_map.get(c.student_id),
                certificate_id=c.certificate_id,
                verification_code=c.verification_code,
                status=c.status.value,
                completion_percentage=c.completion_percentage,
                issued_at=c.issued_at,
            )
            for c in certs
        ],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/certificates/{cert_id}/approve", response_model=PublicCertificateOut)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def approve_certificate(
    request: Request,
    cert_id: uuid.UUID,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.services import certificate_service

    try:
        cert = await certificate_service.approve_existing_certificate(
            session, cert_id, approved_by=None, institute_id=auth.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fetch student name
    r = await session.execute(select(User.name).where(User.id == cert.student_id))
    student_name = r.scalar_one_or_none()

    await webhook_event_service.queue_webhook_event(
        session, auth.institute_id, "certificate.approved",
        {"certificate_id": str(cert.id), "student_id": str(cert.student_id)},
    )
    await session.commit()

    return PublicCertificateOut(
        id=cert.id, student_id=cert.student_id,
        student_name=student_name,
        certificate_id=cert.certificate_id,
        verification_code=cert.verification_code,
        status=cert.status.value,
        completion_percentage=cert.completion_percentage,
        issued_at=cert.issued_at,
    )


@router.post("/certificates/{cert_id}/revoke", response_model=PublicCertificateOut)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def revoke_certificate(
    request: Request,
    cert_id: uuid.UUID,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(Certificate).where(
            Certificate.id == cert_id,
            Certificate.institute_id == auth.institute_id,
            Certificate.deleted_at.is_(None),
        )
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    if cert.status != CertificateStatus.approved:
        raise HTTPException(status_code=400, detail="Only approved certificates can be revoked")

    cert.status = CertificateStatus.revoked
    cert.revoked_at = datetime.now(timezone.utc)
    session.add(cert)

    r = await session.execute(select(User.name).where(User.id == cert.student_id))
    student_name = r.scalar_one_or_none()

    await webhook_event_service.queue_webhook_event(
        session, auth.institute_id, "certificate.revoked",
        {"certificate_id": str(cert.id), "student_id": str(cert.student_id)},
    )
    await session.commit()

    return PublicCertificateOut(
        id=cert.id, student_id=cert.student_id,
        student_name=student_name,
        certificate_id=cert.certificate_id,
        verification_code=cert.verification_code,
        status=cert.status.value,
        completion_percentage=cert.completion_percentage,
        issued_at=cert.issued_at,
    )


# ── Classes ───────────────────────────────────────────────────

@router.get("/classes", response_model=PaginatedResponse[PublicClassOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def list_classes(
    request: Request,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
    batch_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(ZoomClass).where(
        ZoomClass.institute_id == auth.institute_id,
        ZoomClass.deleted_at.is_(None),
    )
    count_q = select(func.count()).select_from(ZoomClass).where(
        ZoomClass.institute_id == auth.institute_id,
        ZoomClass.deleted_at.is_(None),
    )

    if batch_id:
        query = query.where(ZoomClass.batch_id == batch_id)
        count_q = count_q.where(ZoomClass.batch_id == batch_id)
    if status_filter:
        from app.models.enums import ZoomClassStatus
        query = query.where(ZoomClass.status == ZoomClassStatus(status_filter))
        count_q = count_q.where(ZoomClass.status == ZoomClassStatus(status_filter))

    total = (await session.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    classes = (await session.execute(
        query.order_by(ZoomClass.scheduled_date.desc()).offset(offset).limit(per_page)
    )).scalars().all()

    return PaginatedResponse(
        data=[
            PublicClassOut(
                id=c.id, batch_id=c.batch_id, title=c.title,
                scheduled_date=c.scheduled_date,
                scheduled_time=c.scheduled_time.isoformat() if c.scheduled_time else None,
                duration=c.duration,
                status=c.status.value,
                zoom_meeting_url=c.zoom_meeting_url,
            )
            for c in classes
        ],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/classes/{class_id}/attendance", response_model=list[PublicAttendanceOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def get_class_attendance(
    request: Request,
    class_id: uuid.UUID,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Verify class belongs to institute
    result = await session.execute(
        select(ZoomClass).where(
            ZoomClass.id == class_id,
            ZoomClass.institute_id == auth.institute_id,
            ZoomClass.deleted_at.is_(None),
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Class not found")

    r = await session.execute(
        select(ZoomAttendance).where(ZoomAttendance.zoom_class_id == class_id)
    )
    records = r.scalars().all()

    # Fetch student names
    s_ids = [a.student_id for a in records]
    student_map = {}
    if s_ids:
        r2 = await session.execute(select(User.id, User.name).where(User.id.in_(s_ids)))
        student_map = {row[0]: row[1] for row in r2.all()}

    return [
        PublicAttendanceOut(
            student_id=a.student_id,
            student_name=student_map.get(a.student_id, "Unknown"),
            attended=a.attended,
            duration_minutes=a.duration_minutes,
        )
        for a in records
    ]


# ── Announcements ─────────────────────────────────────────────

@router.get("/announcements", response_model=PaginatedResponse[PublicAnnouncementOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def list_announcements(
    request: Request,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(Announcement).where(
        Announcement.institute_id == auth.institute_id,
        Announcement.deleted_at.is_(None),
    )
    count_q = select(func.count()).select_from(Announcement).where(
        Announcement.institute_id == auth.institute_id,
        Announcement.deleted_at.is_(None),
    )

    total = (await session.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    announcements = (await session.execute(
        query.order_by(Announcement.created_at.desc()).offset(offset).limit(per_page)
    )).scalars().all()

    return PaginatedResponse(
        data=[
            PublicAnnouncementOut(
                id=a.id, title=a.title, content=a.content,
                scope=a.scope.value, created_at=a.created_at,
            )
            for a in announcements
        ],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/announcements", response_model=PublicAnnouncementOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def create_announcement(
    request: Request,
    body: PublicAnnouncementCreate,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.services import announcement_service

    try:
        ann = await announcement_service.create_announcement(
            session,
            title=body.title,
            content=body.content,
            scope=body.scope,
            posted_by=None,
            batch_id=body.batch_id,
            course_id=body.course_id,
            institute_id=auth.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PublicAnnouncementOut(
        id=ann.id, title=ann.title, content=ann.content,
        scope=ann.scope.value, created_at=ann.created_at,
    )


# ── Jobs ──────────────────────────────────────────────────────

@router.get("/jobs", response_model=PaginatedResponse[PublicJobOut])
@limiter.limit("1000/minute", key_func=api_key_rate_key)
async def list_jobs(
    request: Request,
    auth: PublicAuth,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(Job).where(
        Job.institute_id == auth.institute_id,
        Job.deleted_at.is_(None),
    )
    count_q = select(func.count()).select_from(Job).where(
        Job.institute_id == auth.institute_id,
        Job.deleted_at.is_(None),
    )

    total = (await session.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    jobs = (await session.execute(
        query.order_by(Job.created_at.desc()).offset(offset).limit(per_page)
    )).scalars().all()

    return PaginatedResponse(
        data=[
            PublicJobOut(
                id=j.id, title=j.title, company=j.company,
                location=j.location,
                job_type=j.job_type.value if j.job_type else None,
                salary=j.salary, description=j.description,
                deadline=j.deadline, created_at=j.created_at,
            )
            for j in jobs
        ],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )

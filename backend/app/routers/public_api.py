import math
import secrets
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.services import user_service, webhook_event_service, public_service

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
    user = await public_service.get_student(session, student_id, auth.institute_id)
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
    user = await public_service.get_student(session, student_id, auth.institute_id)
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
    items, total = await public_service.list_batches(
        session, auth.institute_id, page, per_page,
    )

    return PaginatedResponse(
        data=[
            PublicBatchOut(
                id=item["batch"].id,
                name=item["batch"].name,
                start_date=item["batch"].start_date,
                end_date=item["batch"].end_date,
                teacher_name=item["teacher_name"],
                student_count=item["student_count"],
                course_count=item["course_count"],
                status=item["status"],
                created_at=item["batch"].created_at,
            )
            for item in items
        ],
        total=total, page=page, per_page=per_page,
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
    item = await public_service.get_batch(session, batch_id, auth.institute_id)
    if not item:
        raise HTTPException(status_code=404, detail="Batch not found")

    b = item["batch"]
    return PublicBatchOut(
        id=b.id, name=b.name,
        start_date=b.start_date, end_date=b.end_date,
        teacher_name=item["teacher_name"],
        student_count=item["student_count"],
        course_count=item["course_count"],
        status=item["status"],
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
    courses, total = await public_service.list_courses(
        session, auth.institute_id, page, per_page,
    )

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
    result = await public_service.get_course_with_modules(
        session, course_id, auth.institute_id,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Course not found")

    c = result["course"]
    return PublicCourseDetailOut(
        id=c.id, title=c.title, description=c.description,
        status=c.status.value, created_at=c.created_at,
        modules=[
            PublicModuleOut(id=m.id, title=m.title, order=m.sequence_order)
            for m in result["modules"]
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
    items, total = await public_service.list_enrollments(
        session, auth.institute_id, batch_id, student_id, page, per_page,
    )

    return PaginatedResponse(
        data=[
            PublicEnrollmentOut(
                id=item["enrollment"].id,
                student_id=item["enrollment"].student_id,
                student_name=item["student_name"],
                student_email=item["student_email"],
                batch_id=item["enrollment"].batch_id,
                batch_name=item["batch_name"],
                enrolled_at=item["enrollment"].enrolled_at,
            )
            for item in items
        ],
        total=total, page=page, per_page=per_page,
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
    s_name, s_email, b_name = await public_service.get_enrollment_names(
        session, body.student_id, body.batch_id,
    )

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
    items, total = await public_service.list_certificates(
        session, auth.institute_id, batch_id, course_id, status_filter, page, per_page,
    )

    return PaginatedResponse(
        data=[
            PublicCertificateOut(
                id=item["cert"].id,
                student_id=item["cert"].student_id,
                student_name=item["student_name"],
                certificate_id=item["cert"].certificate_id,
                verification_code=item["cert"].verification_code,
                status=item["cert"].status.value,
                completion_percentage=item["cert"].completion_percentage,
                issued_at=item["cert"].issued_at,
            )
            for item in items
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
    student_name = await public_service.get_student_name(session, cert.student_id)

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
    try:
        result = await public_service.revoke_certificate(
            session, cert_id, auth.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result is None:
        raise HTTPException(status_code=404, detail="Certificate not found")

    cert, student_name = result

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
    classes, total = await public_service.list_classes(
        session, auth.institute_id, batch_id, status_filter, page, per_page,
    )

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
    records = await public_service.get_class_attendance(
        session, class_id, auth.institute_id,
    )
    if records is None:
        raise HTTPException(status_code=404, detail="Class not found")

    return [
        PublicAttendanceOut(
            student_id=r["student_id"],
            student_name=r["student_name"],
            attended=r["attended"],
            duration_minutes=r["duration_minutes"],
        )
        for r in records
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
    announcements, total = await public_service.list_announcements(
        session, auth.institute_id, page, per_page,
    )

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
    jobs, total = await public_service.list_jobs(
        session, auth.institute_id, page, per_page,
    )

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

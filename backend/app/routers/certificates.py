import logging
import math
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.schemas.certificate import (
    CertificateOut,
    EligibleStudentOut,
    StudentDashboardCourseOut,
    CertificateRequestBody,
    CertificateBatchApproveRequest,
    CertificateRevokeRequest,
    CertificateVerifyOut,
)
from app.schemas.common import PaginatedResponse
from app.services import certificate_service
from app.middleware.auth import require_roles, get_current_user, get_institute_slug_from_header
from app.models.user import User
from app.models.institute import Institute

logger = logging.getLogger(__name__)

router = APIRouter()

CC = Annotated[User, Depends(require_roles("course_creator"))]
AdminOrCC = Annotated[User, Depends(require_roles("admin", "course_creator"))]
Student = Annotated[User, Depends(require_roles("student"))]
AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("/eligible", response_model=PaginatedResponse[EligibleStudentOut])
async def list_eligible_students(
    batch_id: uuid.UUID,
    course_id: uuid.UUID,
    current_user: CC,
    session: AsyncSession = Depends(get_session),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List students eligible for certification in a batch-course."""
    students, total = await certificate_service.list_eligible_students(
        session, batch_id, course_id, page, per_page,
        institute_id=current_user.institute_id,
    )
    return PaginatedResponse(
        data=[EligibleStudentOut(**s) for s in students],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/my-dashboard", response_model=list[StudentDashboardCourseOut])
async def student_dashboard(
    current_user: Student,
    session: AsyncSession = Depends(get_session),
):
    """Get all enrolled courses with progress and certificate status for the current student."""
    items = await certificate_service.get_student_dashboard(session, current_user.id, institute_id=current_user.institute_id)
    return [StudentDashboardCourseOut(**item) for item in items]


@router.post("/request", response_model=CertificateOut)
async def request_certificate(
    body: CertificateRequestBody,
    current_user: Student,
    session: AsyncSession = Depends(get_session),
):
    """Student requests a certificate with their preferred name."""
    try:
        cert = await certificate_service.request_certificate(
            session, current_user.id, body.batch_id, body.course_id, body.certificate_name,
            institute_id=current_user.institute_id,
        )
        await session.commit()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    data = await certificate_service.get_certificate(session, cert.id, institute_id=current_user.institute_id)
    return CertificateOut(**data)


@router.get("/requests", response_model=PaginatedResponse[EligibleStudentOut])
async def list_certificate_requests(
    current_user: CC,
    session: AsyncSession = Depends(get_session),
    batch_id: Optional[uuid.UUID] = None,
    course_id: Optional[uuid.UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List pending certificate requests from students."""
    requests, total = await certificate_service.list_certificate_requests(
        session, current_user, batch_id, course_id, page, per_page,
    )
    return PaginatedResponse(
        data=[EligibleStudentOut(**r) for r in requests],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, math.ceil(total / per_page)),
    )


@router.post("/approve/{student_id}", response_model=CertificateOut)
async def approve_certificate(
    student_id: uuid.UUID,
    current_user: CC,
    batch_id: uuid.UUID = Query(...),
    course_id: uuid.UUID = Query(...),
    session: AsyncSession = Depends(get_session),
):
    """Approve and generate a certificate for a single student."""
    is_eligible, pct = await certificate_service.check_eligibility(
        session, student_id, batch_id, course_id,
    )
    if not is_eligible:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student has not met the completion threshold ({pct}%)",
        )

    try:
        cert = await certificate_service.create_and_approve_certificate(
            session, student_id, batch_id, course_id, pct, current_user.id,
            institute_id=current_user.institute_id,
        )
        await session.commit()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    data = await certificate_service.get_certificate(session, cert.id, institute_id=current_user.institute_id)
    return CertificateOut(**data)


@router.post("/approve-batch", response_model=list[CertificateOut])
async def approve_batch_certificates(
    body: CertificateBatchApproveRequest,
    current_user: CC,
    batch_id: uuid.UUID = Query(...),
    course_id: uuid.UUID = Query(...),
    session: AsyncSession = Depends(get_session),
):
    """Bulk approve certificates for multiple students."""
    results = []
    for student_id in body.student_ids:
        is_eligible, pct = await certificate_service.check_eligibility(
            session, student_id, batch_id, course_id,
        )
        if not is_eligible:
            logger.warning("Student %s not eligible (%d%%), skipping", student_id, pct)
            continue

        try:
            cert = await certificate_service.create_and_approve_certificate(
                session, student_id, batch_id, course_id, pct, current_user.id,
                institute_id=current_user.institute_id,
            )
            data = await certificate_service.get_certificate(session, cert.id, institute_id=current_user.institute_id)
            results.append(CertificateOut(**data))
        except ValueError as e:
            logger.warning("Skipping student %s: %s", student_id, e)

    await session.commit()
    return results


@router.post("/approve-request/{cert_uuid}", response_model=CertificateOut)
async def approve_certificate_request(
    cert_uuid: uuid.UUID,
    current_user: CC,
    session: AsyncSession = Depends(get_session),
):
    """Approve a pending certificate request from a student."""
    try:
        cert = await certificate_service.approve_existing_certificate(
            session, cert_uuid, current_user.id,
            institute_id=current_user.institute_id,
        )
        await session.commit()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    data = await certificate_service.get_certificate(session, cert.id, institute_id=current_user.institute_id)
    return CertificateOut(**data)


@router.get("/verify/{code}", response_model=CertificateVerifyOut)
async def verify_certificate(
    code: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Public endpoint: verify a certificate by its verification code."""
    # Resolve institute from header for tenant scoping
    slug = get_institute_slug_from_header(request)
    institute_id = None
    if slug:
        result = await session.execute(
            select(Institute.id).where(Institute.slug == slug, Institute.deleted_at.is_(None))
        )
        institute_id = result.scalar_one_or_none()

    data = await certificate_service.get_certificate_by_verification_code(session, code, institute_id=institute_id)
    if not data:
        return CertificateVerifyOut(valid=False)
    return CertificateVerifyOut(**data)


@router.get("", response_model=PaginatedResponse[CertificateOut])
async def list_certificates(
    current_user: AllRoles,
    session: AsyncSession = Depends(get_session),
    batch_id: Optional[uuid.UUID] = None,
    course_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List certificates (role-scoped)."""
    certs, total = await certificate_service.list_certificates(
        session, current_user, batch_id, course_id, status_filter, page, per_page,
    )
    return PaginatedResponse(
        data=[CertificateOut(**c) for c in certs],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/{cert_uuid}", response_model=CertificateOut)
async def get_certificate(
    cert_uuid: uuid.UUID,
    current_user: AllRoles,
    session: AsyncSession = Depends(get_session),
):
    """Get a single certificate's details."""
    data = await certificate_service.get_certificate(session, cert_uuid, institute_id=current_user.institute_id)
    if not data:
        raise HTTPException(status_code=404, detail="Certificate not found")

    # Role check: students can only see their own
    if current_user.role.value == "student" and data["student_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return CertificateOut(**data)


@router.get("/{cert_uuid}/download")
async def download_certificate(
    cert_uuid: uuid.UUID,
    current_user: AllRoles,
    session: AsyncSession = Depends(get_session),
):
    """Get a presigned S3 download URL for the certificate PDF."""
    url = await certificate_service.get_download_url(session, cert_uuid, institute_id=current_user.institute_id)
    if not url:
        raise HTTPException(status_code=404, detail="Certificate PDF not found")
    return {"download_url": url}


@router.post("/{cert_uuid}/revoke", response_model=CertificateOut)
async def revoke_certificate(
    cert_uuid: uuid.UUID,
    body: CertificateRevokeRequest,
    current_user: AdminOrCC,
    session: AsyncSession = Depends(get_session),
):
    """Revoke an issued certificate."""
    try:
        await certificate_service.revoke_certificate(
            session, cert_uuid, current_user.id, body.reason,
            institute_id=current_user.institute_id,
        )
        await session.commit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = await certificate_service.get_certificate(session, cert_uuid, institute_id=current_user.institute_id)
    return CertificateOut(**data)

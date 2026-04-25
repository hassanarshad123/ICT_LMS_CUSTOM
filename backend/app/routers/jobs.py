import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.job import JobCreate, JobUpdate, JobOut, JobApply, ApplicationOut, ApplicationStatusUpdate
from app.schemas.common import PaginatedResponse
from app.services import job_service
from app.middleware.auth import get_current_user
from app.rbac.dependencies import require_permissions
from app.models.user import User
from app.utils.rate_limit import limiter

router = APIRouter()

CanViewJobs = Annotated[User, Depends(require_permissions("jobs.view"))]
CanCreateJobs = Annotated[User, Depends(require_permissions("jobs.create"))]
CanEditJobs = Annotated[User, Depends(require_permissions("jobs.edit"))]
CanDeleteJobs = Annotated[User, Depends(require_permissions("jobs.delete"))]
CanManageApplications = Annotated[User, Depends(require_permissions("jobs.manage_applications"))]
CanApplyJobs = Annotated[User, Depends(require_permissions("jobs.apply"))]


# /my-applications MUST be before /{job_id} to avoid route collision
@router.get("/my-applications")
async def get_my_applications(
    current_user: CanApplyJobs,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await job_service.get_my_applications(
        session, current_user.id, institute_id=current_user.institute_id
    )


@router.get("", response_model=PaginatedResponse[JobOut])
async def list_jobs(
    current_user: CanViewJobs,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    search: Optional[str] = None,
):
    items, total = await job_service.list_jobs(
        session, page=page, per_page=per_page, job_type=type, search=search,
        institute_id=current_user.institute_id,
    )
    return PaginatedResponse(
        data=[JobOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    body: JobCreate,
    current_user: CanCreateJobs,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.utils.transformers import to_api
    job = await job_service.create_job(
        session, posted_by=current_user.id,
        institute_id=current_user.institute_id, **body.model_dump()
    )
    return JobOut(
        id=job.id, title=job.title, company=job.company, location=job.location,
        type=to_api(job.job_type.value), salary=job.salary,
        description=job.description, requirements=job.requirements,
        posted_date=job.created_at, deadline=job.deadline, posted_by=job.posted_by,
    )


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    current_user: CanViewJobs,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await job_service.get_job(session, job_id, institute_id=current_user.institute_id)
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobOut(**data)


@router.patch("/{job_id}", response_model=JobOut)
async def update_job(
    job_id: uuid.UUID,
    body: JobUpdate,
    current_user: CanEditJobs,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await job_service.update_job(
            session, job_id, institute_id=current_user.institute_id,
            **body.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    data = await job_service.get_job(session, job_id, institute_id=current_user.institute_id)
    return JobOut(**data)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: uuid.UUID,
    current_user: CanDeleteJobs,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await job_service.soft_delete_job(session, job_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{job_id}/apply", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def apply_to_job(
    request: Request,
    job_id: uuid.UUID,
    body: JobApply,
    current_user: CanApplyJobs,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Check job deadline before allowing application
    job = await job_service.get_job(session, job_id, institute_id=current_user.institute_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("deadline"):
        from datetime import date as date_type
        deadline = job["deadline"] if isinstance(job["deadline"], date_type) else date_type.fromisoformat(str(job["deadline"]))
        if date_type.today() > deadline:
            raise HTTPException(status_code=400, detail="Application deadline has passed")

    try:
        app = await job_service.apply_to_job(
            session, job_id=job_id, student_id=current_user.id,
            resume_key=body.resume_key, cover_letter=body.cover_letter,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": app.id, "job_id": app.job_id, "status": app.status.value}


@router.get("/{job_id}/applications", response_model=PaginatedResponse[ApplicationOut])
async def list_applications(
    job_id: uuid.UUID,
    current_user: CanManageApplications,
    session: Annotated[AsyncSession, Depends(get_session)],
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = await job_service.list_applications(
        session, job_id, institute_id=current_user.institute_id,
        search=search, status_filter=status, page=page, per_page=per_page,
    )
    return PaginatedResponse(
        data=[ApplicationOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=max(1, math.ceil(total / per_page)),
    )


@router.patch("/{job_id}/applications/{app_id}/status")
async def update_application_status(
    job_id: uuid.UUID,
    app_id: uuid.UUID,
    body: ApplicationStatusUpdate,
    current_user: CanManageApplications,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        app = await job_service.update_application_status(
            session, app_id, body.status, current_user.id,
            institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"id": app.id, "status": app.status.value}

import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.job import JobCreate, JobUpdate, JobOut, JobApply, ApplicationOut, ApplicationStatusUpdate
from app.schemas.common import PaginatedResponse
from app.services import job_service
from app.middleware.auth import require_roles, get_current_user
from app.models.user import User

router = APIRouter()

CC = Annotated[User, Depends(require_roles("course_creator"))]
Student = Annotated[User, Depends(require_roles("student"))]
CCOrStudent = Annotated[User, Depends(require_roles("course_creator", "student"))]


# /my-applications MUST be before /{job_id} to avoid route collision
@router.get("/my-applications")
async def get_my_applications(
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await job_service.get_my_applications(
        session, current_user.id, institute_id=current_user.institute_id
    )


@router.get("", response_model=PaginatedResponse[JobOut])
async def list_jobs(
    current_user: CCOrStudent,
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
    current_user: CC,
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
    current_user: CCOrStudent,
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
    current_user: CC,
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
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await job_service.soft_delete_job(session, job_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{job_id}/apply", status_code=status.HTTP_201_CREATED)
async def apply_to_job(
    job_id: uuid.UUID,
    body: JobApply,
    current_user: Student,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    app = await job_service.apply_to_job(
        session, job_id=job_id, student_id=current_user.id,
        resume_key=body.resume_key, cover_letter=body.cover_letter,
        institute_id=current_user.institute_id,
    )
    return {"id": app.id, "job_id": app.job_id, "status": app.status.value}


@router.get("/{job_id}/applications", response_model=list[ApplicationOut])
async def list_applications(
    job_id: uuid.UUID,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    items = await job_service.list_applications(
        session, job_id, institute_id=current_user.institute_id
    )
    return [ApplicationOut(**item) for item in items]


@router.patch("/{job_id}/applications/{app_id}/status")
async def update_application_status(
    job_id: uuid.UUID,
    app_id: uuid.UUID,
    body: ApplicationStatusUpdate,
    current_user: CC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        app = await job_service.update_application_status(
            session, app_id, body.status, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"id": app.id, "status": app.status.value}

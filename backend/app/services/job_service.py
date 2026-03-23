import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.job import Job, JobApplication
from app.models.user import User
from app.models.enums import JobType, ApplicationStatus
from app.utils.transformers import to_db, to_api


async def list_jobs(
    session: AsyncSession,
    page: int = 1,
    per_page: int = 20,
    job_type: Optional[str] = None,
    search: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> tuple[list[dict], int]:
    query = select(Job).where(Job.deleted_at.is_(None))
    count_query = select(func.count()).select_from(Job).where(Job.deleted_at.is_(None))

    if institute_id is not None:
        query = query.where(Job.institute_id == institute_id)
        count_query = count_query.where(Job.institute_id == institute_id)

    if job_type:
        db_type = to_db(job_type)
        query = query.where(Job.job_type == JobType(db_type))
        count_query = count_query.where(Job.job_type == JobType(db_type))

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (col(Job.title).ilike(pattern)) | (col(Job.company).ilike(pattern))
        )
        count_query = count_query.where(
            (col(Job.title).ilike(pattern)) | (col(Job.company).ilike(pattern))
        )

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(Job.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    jobs = result.scalars().all()

    return [
        {
            "id": j.id,
            "title": j.title,
            "company": j.company,
            "location": j.location,
            "type": to_api(j.job_type.value),
            "salary": j.salary,
            "description": j.description,
            "requirements": j.requirements,
            "posted_date": j.created_at,
            "deadline": j.deadline,
            "posted_by": j.posted_by,
        }
        for j in jobs
    ], total


async def get_job(
    session: AsyncSession, job_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> dict | None:
    query = select(Job).where(Job.id == job_id, Job.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Job.institute_id == institute_id)
    result = await session.execute(query)
    j = result.scalar_one_or_none()
    if not j:
        return None

    return {
        "id": j.id,
        "title": j.title,
        "company": j.company,
        "location": j.location,
        "type": to_api(j.job_type.value),
        "salary": j.salary,
        "description": j.description,
        "requirements": j.requirements,
        "posted_date": j.created_at,
        "deadline": j.deadline,
        "posted_by": j.posted_by,
    }


async def create_job(
    session: AsyncSession, posted_by: uuid.UUID, institute_id: Optional[uuid.UUID] = None, **fields
) -> Job:
    job_type = fields.pop("job_type")
    job = Job(
        job_type=JobType(to_db(job_type)),
        posted_by=posted_by,
        institute_id=institute_id,
        **fields,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


async def update_job(
    session: AsyncSession, job_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None, **fields
) -> Job:
    query = select(Job).where(Job.id == job_id, Job.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Job.institute_id == institute_id)
    result = await session.execute(query)
    job = result.scalar_one_or_none()
    if not job:
        raise ValueError("Job not found")

    for key, value in fields.items():
        if value is not None and hasattr(job, key):
            if key == "job_type":
                value = JobType(to_db(value))
            setattr(job, key, value)

    job.updated_at = datetime.now(timezone.utc)
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


async def soft_delete_job(
    session: AsyncSession, job_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> None:
    query = select(Job).where(Job.id == job_id, Job.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(Job.institute_id == institute_id)
    result = await session.execute(query)
    job = result.scalar_one_or_none()
    if not job:
        raise ValueError("Job not found")

    now = datetime.now(timezone.utc)
    job.deleted_at = now
    session.add(job)

    # Cascade: soft-delete job applications
    app_result = await session.execute(
        select(JobApplication).where(
            JobApplication.job_id == job_id, JobApplication.deleted_at.is_(None)
        )
    )
    for app in app_result.scalars().all():
        app.deleted_at = now
        session.add(app)

    await session.commit()


async def apply_to_job(
    session: AsyncSession,
    job_id: uuid.UUID,
    student_id: uuid.UUID,
    resume_key: Optional[str] = None,
    cover_letter: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> JobApplication:
    # Soft-delete previous application if exists
    result = await session.execute(
        select(JobApplication).where(
            JobApplication.job_id == job_id,
            JobApplication.student_id == student_id,
            JobApplication.deleted_at.is_(None),
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.deleted_at = datetime.now(timezone.utc)
        session.add(existing)

    app = JobApplication(
        job_id=job_id,
        student_id=student_id,
        resume_url=resume_key,
        cover_letter=cover_letter,
        institute_id=institute_id,
    )
    session.add(app)
    await session.commit()
    await session.refresh(app)
    return app


async def list_applications(
    session: AsyncSession, job_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> list[dict]:
    query = (
        select(JobApplication, User)
        .join(User, JobApplication.student_id == User.id)
        .where(
            JobApplication.job_id == job_id,
            JobApplication.deleted_at.is_(None),
        )
    )
    if institute_id is not None:
        query = query.where(JobApplication.institute_id == institute_id)
    result = await session.execute(
        query.order_by(JobApplication.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": app.id,
            "job_id": app.job_id,
            "student_id": app.student_id,
            "student_name": u.name,
            "student_email": u.email,
            "resume_url": app.resume_url,
            "cover_letter": app.cover_letter,
            "status": app.status.value,
            "created_at": app.created_at,
        }
        for app, u in rows
    ]


async def update_application_status(
    session: AsyncSession,
    app_id: uuid.UUID,
    new_status: str,
    changed_by: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> JobApplication:
    filters = [JobApplication.id == app_id, JobApplication.deleted_at.is_(None)]
    if institute_id is not None:
        filters.append(JobApplication.institute_id == institute_id)
    result = await session.execute(select(JobApplication).where(*filters))
    app = result.scalar_one_or_none()
    if not app:
        raise ValueError("Application not found")

    app.status = ApplicationStatus(to_db(new_status))
    app.status_changed_at = datetime.now(timezone.utc)
    app.status_changed_by = changed_by
    session.add(app)
    await session.commit()
    await session.refresh(app)
    return app


async def get_my_applications(
    session: AsyncSession, student_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> list[dict]:
    query = (
        select(JobApplication, Job)
        .join(Job, JobApplication.job_id == Job.id)
        .where(
            JobApplication.student_id == student_id,
            JobApplication.deleted_at.is_(None),
        )
    )
    if institute_id is not None:
        query = query.where(JobApplication.institute_id == institute_id, Job.institute_id == institute_id)
    result = await session.execute(
        query.order_by(JobApplication.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": app.id,
            "job_id": app.job_id,
            "job_title": j.title,
            "company": j.company,
            "resume_url": app.resume_url,
            "cover_letter": app.cover_letter,
            "status": app.status.value,
            "created_at": app.created_at,
        }
        for app, j in rows
    ]

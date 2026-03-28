"""
Centralized resource access verification.

These helpers enforce that a user has legitimate access to a specific
resource (batch, zoom class, etc.) based on their role and relationship
to that resource. They go beyond require_roles() which only checks the
role string — these verify enrollment, assignment, or ownership.

Usage in routers:
    from app.middleware.access_control import verify_batch_access

    @router.get("/{batch_id}/students")
    async def list_batch_students(batch_id, current_user, session):
        await verify_batch_access(session, current_user, batch_id)
        ...
"""

import uuid
import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.batch import Batch, StudentBatch
from app.models.user import User
from app.models.zoom import ZoomClass

logger = logging.getLogger("ict_lms.access_control")


async def verify_batch_access(
    session: AsyncSession,
    current_user: User,
    batch_id: uuid.UUID,
    check_active: bool = False,
) -> Batch:
    """Verify current_user can access this batch. Returns the Batch or raises.

    Rules:
    - admin / super_admin: any batch in their institute
    - course_creator: any batch in their institute (they manage all content)
    - teacher: only batches assigned to them (Batch.teacher_id)
    - student: only batches they are enrolled in (StudentBatch)

    If check_active=True and user is a student, also verifies the enrollment
    is active (is_active=True). Used for content access (lectures, materials).
    """
    result = await session.execute(
        select(Batch).where(
            Batch.id == batch_id,
            Batch.deleted_at.is_(None),
            *([Batch.institute_id == current_user.institute_id]
              if current_user.institute_id else []),
        )
    )
    batch = result.scalar_one_or_none()

    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found",
        )

    role = current_user.role.value

    # Admin and super_admin see everything in their institute
    if role in ("admin", "super_admin"):
        return batch

    # Course creators manage all content in their institute
    if role == "course_creator":
        return batch

    # Teachers must be assigned to the batch
    if role == "teacher":
        if batch.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not assigned to this batch",
            )
        return batch

    # Students must be enrolled in the batch
    if role == "student":
        enrolled = await session.execute(
            select(StudentBatch.id, StudentBatch.is_active).where(
                StudentBatch.student_id == current_user.id,
                StudentBatch.batch_id == batch_id,
                StudentBatch.removed_at.is_(None),
            )
        )
        row = enrolled.one_or_none()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enrolled in this batch",
            )
        if check_active and not row.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your enrollment in this batch is currently inactive",
            )
        return batch

    # Unknown role — deny by default
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied",
    )


async def verify_zoom_class_access(
    session: AsyncSession,
    current_user: User,
    class_id: uuid.UUID,
) -> ZoomClass:
    """Verify current_user can access this zoom class.

    Loads the class, then delegates to verify_batch_access using the
    class's batch_id.
    """
    result = await session.execute(
        select(ZoomClass).where(
            ZoomClass.id == class_id,
            ZoomClass.deleted_at.is_(None),
            *([ZoomClass.institute_id == current_user.institute_id]
              if current_user.institute_id else []),
        )
    )
    zoom_class = result.scalar_one_or_none()

    if not zoom_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    # Delegate batch-level access check
    await verify_batch_access(session, current_user, zoom_class.batch_id)

    return zoom_class

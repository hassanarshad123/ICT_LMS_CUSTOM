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
from datetime import date as date_type

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.batch import Batch, StudentBatch
from app.models.user import User
from app.models.zoom import ZoomClass

logger = logging.getLogger("ict_lms.access_control")


def get_effective_end_date(batch: Batch, student_batch: StudentBatch) -> date_type:
    """Return the student's effective access end date.

    Uses the per-student extended_end_date if set, otherwise the batch end_date.
    """
    return student_batch.extended_end_date or batch.end_date


async def verify_batch_access(
    session: AsyncSession,
    current_user: User,
    batch_id: uuid.UUID,
    check_active: bool = False,
    check_expiry: bool = False,
) -> Batch:
    """Verify current_user can access this batch. Returns the Batch or raises.

    Rules:
    - admin / super_admin: any batch in their institute
    - course_creator: any batch in their institute (they manage all content)
    - teacher: only batches assigned to them (Batch.teacher_id)
    - student: only batches they are enrolled in (StudentBatch)

    If check_active=True and user is a student, also verifies the enrollment
    is active (is_active=True). Used for content access (lectures, materials).

    If check_expiry=True and user is a student, also verifies the student's
    effective end date has not passed. Used for interactive endpoints (play video,
    download material, take quiz, request certificate). Students with expired
    access get 403 with a specific message so the frontend can show locked UI.
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
            select(StudentBatch).where(
                StudentBatch.student_id == current_user.id,
                StudentBatch.batch_id == batch_id,
                StudentBatch.removed_at.is_(None),
            )
        )
        student_batch = enrolled.scalar_one_or_none()
        if not student_batch:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enrolled in this batch",
            )
        if not student_batch.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your enrollment in this batch is currently inactive",
            )
        if check_expiry:
            effective_end = get_effective_end_date(batch, student_batch)
            if date_type.today() > effective_end:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your access to this batch has expired",
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
    check_active: bool = False,
    check_expiry: bool = False,
) -> ZoomClass:
    """Verify current_user can access this zoom class.

    Loads the class, then delegates to verify_batch_access using the
    class's batch_id. Passes through check_active and check_expiry flags.
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

    # Teachers assigned to the class itself get access even if they
    # are not the batch-level teacher (ZoomClass.teacher_id may differ
    # from Batch.teacher_id).
    if (
        current_user.role.value == "teacher"
        and zoom_class.teacher_id == current_user.id
    ):
        return zoom_class

    # Delegate batch-level access check for all other cases
    await verify_batch_access(session, current_user, zoom_class.batch_id,
                              check_active=check_active, check_expiry=check_expiry)

    return zoom_class


async def check_student_batch_expiry(
    session: AsyncSession,
    student_id: uuid.UUID,
    course_id: uuid.UUID,
) -> None:
    """Check if the student's batch access for a given course has expired.

    Finds the student's active enrollment in a batch that contains this course,
    then checks the effective end date. Raises 403 if expired.
    Used for quiz and certificate endpoints where batch_id isn't directly available.
    """
    from app.models.course import BatchCourse

    result = await session.execute(
        select(StudentBatch, Batch).join(
            BatchCourse, BatchCourse.batch_id == StudentBatch.batch_id,
        ).join(
            Batch, Batch.id == StudentBatch.batch_id,
        ).where(
            StudentBatch.student_id == student_id,
            BatchCourse.course_id == course_id,
            BatchCourse.deleted_at.is_(None),
            StudentBatch.removed_at.is_(None),
            StudentBatch.is_active.is_(True),
            Batch.deleted_at.is_(None),
        ).limit(1)
    )
    row = result.one_or_none()
    if not row:
        return  # No enrollment found — let the service layer handle the 403

    student_batch, batch = row
    effective_end = get_effective_end_date(batch, student_batch)
    if date_type.today() > effective_end:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your access to this batch has expired",
        )

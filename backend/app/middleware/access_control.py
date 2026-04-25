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
from app.models.enums import UserRole
from app.models.institute import Institute
from app.models.user import User
from app.models.zoom import ZoomClass
from app.utils.plan_limits import is_v2_billing_tier

logger = logging.getLogger("ict_lms.access_control")


# ──────────────────────────────────────────────────────────────────
# Pricing v2: billing-restriction gate
# ──────────────────────────────────────────────────────────────────
#
# Set by the late-payment enforcement cron (scheduler/billing_jobs.py)
# when an institute's invoice is ≥15 days overdue. Grandfathered tiers
# never carry this flag — ICT and friends always skip both the
# tier gate AND the None check, so they cannot be blocked.

# Route categories relevant to the restriction. Write actions here are
# what get blocked when billing_restriction == "add_blocked" or "read_only".
_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def check_billing_restriction(
    institute: Institute,
    method: str,
    *,
    is_student_add: bool = False,
    is_upload: bool = False,
) -> None:
    """Raise HTTP 402 if the institute's billing_restriction blocks this action.

    Grandfathered tiers always pass — ``is_v2_billing_tier()`` returns False
    for any plan_tier that's not ``professional`` / ``custom``, so the
    function returns immediately for ICT (pro) and all other legacy tiers.

    v2 tiers with no restriction also pass immediately.

    When billing_restriction is set:
      * ``add_blocked`` (day 15+ overdue) — blocks POST /users and uploads
        only; other writes still permitted.
      * ``read_only`` (day 30+ overdue) — blocks every write method.
    """
    if not is_v2_billing_tier(institute.plan_tier):
        return
    if institute.billing_restriction is None:
        return
    if method.upper() not in _WRITE_METHODS:
        return  # reads are always allowed

    r = institute.billing_restriction
    if r == "read_only":
        raise HTTPException(
            status_code=402,
            detail={
                "code": "billing_read_only",
                "message": (
                    "This institute is in read-only mode because an invoice is 30+ days overdue. "
                    "Please clear the balance from the billing page to restore writes."
                ),
            },
        )

    if r == "add_blocked" and (is_student_add or is_upload):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "billing_add_blocked",
                "message": (
                    "New student sign-ups and uploads are blocked because an invoice is 15+ days overdue. "
                    "Please clear the balance from the billing page."
                ),
            },
        )


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
    check_fee_overdue: bool = False,
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

    If check_fee_overdue=True and user is a student, also verifies they have no
    overdue fee installments on this batch. Raises HTTP 402 Payment Required with
    a structured detail ``{code: "fee_overdue", batch_id, ...}`` so the frontend
    can show a soft-lock overlay instead of a hard 403.
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
        if check_fee_overdue:
            await _raise_if_fee_overdue(session, current_user.id, batch_id)
        return batch

    # Custom role users — resolve via view_type
    if current_user.role == UserRole.custom:
        view_type = getattr(current_user, "_view_type", None)
        if view_type == "admin_view":
            # Same as admin/CC — full institute access
            return batch
        elif view_type == "staff_view":
            # Same as teacher — assigned batches only
            if batch.teacher_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not assigned to this batch",
                )
            return batch
        else:
            # student_view — enrolled only
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
            if check_fee_overdue:
                await _raise_if_fee_overdue(session, current_user.id, batch_id)
            return batch

    # Unknown role — deny by default
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied",
    )


async def _raise_if_fee_overdue(
    session: AsyncSession,
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
) -> None:
    """Raise HTTP 402 with structured detail if the student has overdue fees
    for ``batch_id``. The frontend checks ``error.data.code == 'fee_overdue'`` to
    render the soft-lock overlay instead of a generic error toast.
    """
    from datetime import date as _date_cls

    from app.models.fee import FeeInstallment, FeePlan

    overdue_row = await session.execute(
        select(FeeInstallment, FeePlan)
        .join(FeePlan, FeePlan.id == FeeInstallment.fee_plan_id)
        .where(
            FeePlan.student_id == student_id,
            FeePlan.batch_id == batch_id,
            FeePlan.deleted_at.is_(None),
            FeeInstallment.due_date < _date_cls.today(),
            FeeInstallment.status.in_(["pending", "partially_paid", "overdue"]),
        )
        .order_by(FeeInstallment.due_date.asc())
        .limit(1)
    )
    row = overdue_row.first()
    if row is None:
        return

    overdue_installment, plan = row
    amount_due = int(overdue_installment.amount_due) - int(overdue_installment.amount_paid)

    raise HTTPException(
        status_code=402,
        detail={
            "code": "fee_overdue",
            "message": "Your fees are overdue — please contact your admissions officer",
            "batch_id": str(batch_id),
            "fee_plan_id": str(plan.id),
            "overdue_installment_id": str(overdue_installment.id),
            "overdue_since": overdue_installment.due_date.isoformat(),
            "amount_due": amount_due,
            "currency": plan.currency,
        },
    )


async def verify_zoom_class_access(
    session: AsyncSession,
    current_user: User,
    class_id: uuid.UUID,
    check_active: bool = False,
    check_expiry: bool = False,
    check_fee_overdue: bool = False,
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
    is_teacher_like = (
        current_user.role.value == "teacher"
        or (
            current_user.role == UserRole.custom
            and getattr(current_user, "_view_type", None) == "staff_view"
        )
    )
    if is_teacher_like and zoom_class.teacher_id == current_user.id:
        return zoom_class

    # Delegate batch-level access check for all other cases
    await verify_batch_access(
        session, current_user, zoom_class.batch_id,
        check_active=check_active,
        check_expiry=check_expiry,
        check_fee_overdue=check_fee_overdue,
    )

    return zoom_class


async def check_student_batch_expiry(
    session: AsyncSession,
    student_id: uuid.UUID,
    course_id: uuid.UUID,
    check_fee_overdue: bool = False,
) -> None:
    """Check if the student's batch access for a given course has expired.

    Finds the student's active enrollment in a batch that contains this course,
    then checks the effective end date. Raises 403 if expired.
    Used for quiz and certificate endpoints where batch_id isn't directly available.

    When ``check_fee_overdue=True``, also raises HTTP 402 with structured detail
    if the student has any overdue installment on the matched batch's fee plan.
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

    if check_fee_overdue:
        await _raise_if_fee_overdue(session, student_id, batch.id)

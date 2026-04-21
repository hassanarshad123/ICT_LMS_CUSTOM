"""Admissions Officer workflow — onboard paying students end-to-end.

Single entry point ``onboard_student`` orchestrates:
  1. Default-password generation for the new student account
  2. ``create_user`` with role=student
  3. Quota check + enrollment row in ``student_batches``
  4. ``FeePlan`` creation with discount calculation
  5. ``FeeInstallment`` generation based on plan type
  6. Activity log entry
  7. Welcome email dispatch (best-effort, via existing templates)

All writes happen on the supplied session. Callers are responsible for the
outer commit; the service flushes between steps so FK references are valid.
"""
from __future__ import annotations

import logging
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.user import User
from app.models.batch import Batch, StudentBatch, StudentBatchHistory
from app.models.fee import FeePlan, FeeInstallment
from app.models.enums import (
    BatchHistoryAction,
    FeeDiscountType,
    FeeInstallmentStatus,
    FeePlanStatus,
    FeePlanType,
    UserRole,
)
from app.schemas.fee import FeePlanCreate, InstallmentDraft, OnboardStudentRequest
from app.services.user_service import create_user
from app.services.institute_service import check_and_increment_student_quota

logger = logging.getLogger("ict_lms.admissions")


class AdmissionsError(ValueError):
    """Surface-level validation failure — mapped to HTTP 400 by the router."""


# ─── Discount & installment math ─────────────────────────────────────────

def compute_final_amount(
    total_amount: int,
    discount_type: Optional[str],
    discount_value: Optional[int],
) -> int:
    """Apply discount to the total. Returns 0 when result would be negative."""
    if not discount_type or not discount_value:
        return total_amount
    if discount_type == FeeDiscountType.percent.value:
        if discount_value < 0 or discount_value > 100:
            raise AdmissionsError("Percentage discount must be between 0 and 100")
        final = total_amount - (total_amount * discount_value) // 100
    elif discount_type == FeeDiscountType.flat.value:
        final = total_amount - discount_value
    else:
        raise AdmissionsError(f"Unknown discount_type '{discount_type}'")
    return max(final, 0)


def _build_monthly_installments(
    final_amount: int,
    first_due_date: date,
    months: int,
) -> list[dict]:
    """Evenly split ``final_amount`` across ``months`` monthly installments.

    Remainder from integer division is added to the first installment so the
    sum of ``amount_due`` matches ``final_amount`` exactly.
    """
    if months < 1:
        raise AdmissionsError("Monthly plan needs at least 1 installment")
    base = final_amount // months
    remainder = final_amount - (base * months)
    out: list[dict] = []
    for idx in range(months):
        amt = base + (remainder if idx == 0 else 0)
        due = _add_months(first_due_date, idx)
        out.append(
            dict(
                sequence=idx + 1,
                amount_due=amt,
                due_date=due,
                label=f"Month {idx + 1}",
            )
        )
    return out


def _add_months(d: date, months: int) -> date:
    """Naive month addition — clips day to 28 for safety."""
    y = d.year + (d.month - 1 + months) // 12
    m = ((d.month - 1 + months) % 12) + 1
    day = min(d.day, 28)
    return date(y, m, day)


def _build_installment_drafts(
    plan_type: str,
    plan_data: FeePlanCreate,
    final_amount: int,
    enrollment_start: date,
) -> list[dict]:
    """Return a list of installment dicts ready for DB insertion."""
    if plan_type == FeePlanType.one_time.value:
        due = plan_data.first_due_date or enrollment_start
        return [dict(sequence=1, amount_due=final_amount, due_date=due, label="Full payment")]

    if plan_type == FeePlanType.monthly.value:
        months = plan_data.monthly_installments or 1
        first_due = plan_data.first_due_date or enrollment_start
        return _build_monthly_installments(final_amount, first_due, months)

    if plan_type == FeePlanType.installment.value:
        if not plan_data.installments:
            raise AdmissionsError("Installment plan requires an installments schedule")
        total = sum(item.amount_due for item in plan_data.installments)
        if total != final_amount:
            raise AdmissionsError(
                f"Installment amounts sum to {total} but final amount is {final_amount}"
            )
        return [_draft_to_dict(i) for i in plan_data.installments]

    raise AdmissionsError(f"Unknown plan_type '{plan_type}'")


def _draft_to_dict(draft: InstallmentDraft) -> dict:
    return dict(
        sequence=draft.sequence,
        amount_due=draft.amount_due,
        due_date=draft.due_date,
        label=draft.label,
    )


# ─── Core orchestration ──────────────────────────────────────────────────

async def onboard_student(
    session: AsyncSession,
    *,
    officer: User,
    payload: OnboardStudentRequest,
) -> dict:
    """End-to-end onboarding. Returns a dict suitable for OnboardStudentResponse.

    The function is NOT idempotent — duplicate emails within the same institute
    will raise :class:`AdmissionsError`. Callers should catch and surface.
    """
    if officer.institute_id is None:
        raise AdmissionsError("Officer must be attached to an institute")

    batch = await _load_batch_in_institute(session, payload.batch_id, officer.institute_id)
    plan_type, final_amount, installments = _compute_plan_inputs(payload.fee_plan)

    # ── Detect existing student by email in this institute ──
    # If they're already here, enroll them in the new batch instead of
    # refusing the onboarding with "email in use". Keeps the AO's flow
    # single-purpose: "get this person into this batch".
    from sqlalchemy import func as _sa_func

    existing_email = payload.email.strip().lower()
    existing_q = select(User).where(
        _sa_func.lower(User.email) == existing_email,
        User.institute_id == officer.institute_id,
        User.deleted_at.is_(None),
    )
    existing = (await session.execute(existing_q)).scalar_one_or_none()

    if existing is not None and existing.role != UserRole.student:
        raise AdmissionsError(
            f"Email is already used by a {existing.role.value} in this institute — "
            f"cannot enroll them as a student"
        )

    is_new_user = existing is None
    temp_password = ""

    if existing is not None:
        # Guard: reject if the student already has an active enrollment in
        # THIS batch. StudentBatch has a partial unique index on
        # (student_id, batch_id) where removed_at IS NULL, so the DB would
        # reject anyway — surface a friendlier error first.
        dup_enroll_q = select(StudentBatch.id).where(
            StudentBatch.student_id == existing.id,
            StudentBatch.batch_id == batch.id,
            StudentBatch.removed_at.is_(None),
        ).limit(1)
        if (await session.execute(dup_enroll_q)).scalar_one_or_none() is not None:
            raise AdmissionsError(
                f"{existing.name} is already enrolled in {batch.name}"
            )
        student = existing
    else:
        # ── Quota (only when creating a NEW student) ──
        try:
            await check_and_increment_student_quota(session, officer.institute_id)
        except ValueError as e:
            raise AdmissionsError(str(e))

        # ── Default student password ──
        from app.routers.users import _get_default_student_password

        temp_password = await _get_default_student_password(session, officer.institute_id)
        try:
            student = await create_user(
                session,
                email=payload.email,
                name=payload.name,
                password=temp_password,
                role=UserRole.student.value,
                phone=payload.phone,
                specialization=None,
                institute_id=officer.institute_id,
            )
        except ValueError as e:
            raise AdmissionsError(str(e))

    # ── Enroll + fee plan (shared with add-batch flow) ──
    plan = await _create_enrollment_with_plan(
        session,
        officer=officer,
        student=student,
        batch=batch,
        plan_type=plan_type,
        final_amount=final_amount,
        installments=installments,
        payload_fee=payload.fee_plan,
        notes=payload.notes or payload.fee_plan.notes,
        action="admissions.student_onboarded",
    )

    # ── Webhook event (pre-commit, same transaction) ──
    from app.services import webhook_event_service

    await webhook_event_service.queue_webhook_event(
        session,
        officer.institute_id,
        "fee.plan_created",
        {
            "fee_plan_id": str(plan.id),
            "student_id": str(student.id),
            "student_email": student.email,
            "student_name": student.name,
            "batch_id": str(plan.batch_id),
            "student_batch_id": str(plan.student_batch_id),
            "plan_type": plan.plan_type,
            "total_amount": plan.total_amount,
            "final_amount": final_amount,
            "currency": plan.currency,
            "installment_count": len(installments),
            "onboarded_by_user_id": str(officer.id),
            "source": "onboarding",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    # -- Initial payment at onboarding (optional) --
    # Record a FeePayment row when the officer uploads proof at onboarding time.
    # We construct FeePayment directly because fee_service.record_payment requires
    # amount >= 1 and a restricted payment_method allowlist -- both intentionally
    # bypassed here (proof-only upload has amount=0; method is onboarding_upload).
    if payload.payment_proof_object_key or (payload.initial_payment_amount or 0) > 0:
        from app.models.fee import FeePayment as _FeePayment
        _initial_payment = _FeePayment(
            fee_plan_id=plan.id,
            institute_id=officer.institute_id,
            amount=payload.initial_payment_amount or 0,
            payment_date=datetime.now(timezone.utc),
            payment_method="onboarding_upload",
            status="received",
            recorded_by_user_id=officer.id,
            payment_proof_key=payload.payment_proof_object_key,
        )
        session.add(_initial_payment)
        await session.flush()

    await session.commit()
    await session.refresh(plan)

    # Best-effort welcome email (non-fatal). Skip for existing students —
    # they already have a login and we don't want to re-send credentials.
    if is_new_user:
        try:
            from app.utils.email_sender import (
                send_email_background,
                get_institute_branding,
                build_login_url,
                build_reset_url,
                should_send_email,
            )
            from app.utils.email_templates import welcome_email

            if await should_send_email(session, officer.institute_id, student.id, "email_welcome"):
                branding = await get_institute_branding(session, officer.institute_id)
                subject, html = welcome_email(
                    student_name=student.name,
                    email=student.email,
                    default_password=temp_password,
                    login_url=build_login_url(branding["slug"]),
                    reset_url=build_reset_url(branding["slug"]),
                    institute_name=branding["name"],
                    logo_url=branding.get("logo_url"),
                    accent_color=branding.get("accent_color", "#C5D86D"),
                )
                send_email_background(student.email, subject, html, from_name=branding["name"])
        except Exception:
            logger.exception("welcome email dispatch failed for user %s", student.id)

    return dict(
        user_id=student.id,
        student_batch_id=plan.student_batch_id,
        fee_plan_id=plan.id,
        temporary_password=temp_password,
        email=student.email,
        final_amount=final_amount,
        currency=plan.currency,
        installment_count=len(installments),
        is_new_user=is_new_user,
    )


# ─── Shared helpers ─────────────────────────────────────────────────────

async def _load_batch_in_institute(
    session: AsyncSession, batch_id: uuid.UUID, institute_id: uuid.UUID
) -> Batch:
    row = await session.execute(
        select(Batch).where(
            Batch.id == batch_id,
            Batch.deleted_at.is_(None),
            Batch.institute_id == institute_id,
        )
    )
    batch = row.scalar_one_or_none()
    if not batch:
        raise AdmissionsError("Batch not found in your institute")
    return batch


def _compute_plan_inputs(fee_plan: FeePlanCreate) -> tuple[str, int, list[dict]]:
    """Normalize + validate the fee plan side of the request. Pure, no I/O."""
    plan_type = fee_plan.plan_type  # already normalised by schema validator
    final_amount = compute_final_amount(
        total_amount=fee_plan.total_amount,
        discount_type=fee_plan.discount_type,
        discount_value=fee_plan.discount_value,
    )
    installments = _build_installment_drafts(plan_type, fee_plan, final_amount, date.today())
    return plan_type, final_amount, installments


async def _create_enrollment_with_plan(
    session: AsyncSession,
    *,
    officer: User,
    student: User,
    batch: Batch,
    plan_type: str,
    final_amount: int,
    installments: list[dict],
    payload_fee: FeePlanCreate,
    notes: Optional[str],
    action: str,
) -> FeePlan:
    """Create StudentBatch + history + FeePlan + FeeInstallments in a single
    session.flush cycle. Caller commits.
    """
    enrollment = StudentBatch(
        student_id=student.id,
        batch_id=batch.id,
        enrolled_by=officer.id,
        institute_id=officer.institute_id,
    )
    session.add(enrollment)

    history = StudentBatchHistory(
        student_id=student.id,
        batch_id=batch.id,
        action=BatchHistoryAction.assigned,
        changed_by=officer.id,
        institute_id=officer.institute_id,
    )
    session.add(history)
    await session.flush()

    plan = FeePlan(
        student_batch_id=enrollment.id,
        student_id=student.id,
        batch_id=batch.id,
        institute_id=officer.institute_id,
        plan_type=plan_type,
        total_amount=payload_fee.total_amount,
        discount_type=payload_fee.discount_type,
        discount_value=payload_fee.discount_value,
        final_amount=final_amount,
        currency=payload_fee.currency or "PKR",
        billing_day_of_month=payload_fee.billing_day_of_month,
        onboarded_by_user_id=officer.id,
        status=FeePlanStatus.active.value,
        notes=notes,
    )
    plan.frappe_item_code = getattr(payload_fee, "frappe_item_code", None)
    plan.frappe_payment_terms_template = getattr(payload_fee, "frappe_payment_terms_template", None)
    session.add(plan)
    await session.flush()

    for row in installments:
        session.add(
            FeeInstallment(
                fee_plan_id=plan.id,
                institute_id=officer.institute_id,
                sequence=row["sequence"],
                amount_due=row["amount_due"],
                amount_paid=0,
                due_date=row["due_date"],
                status=FeeInstallmentStatus.pending.value,
                label=row.get("label"),
            )
        )

    from app.services.activity_service import log_activity

    await log_activity(
        session,
        action=action,
        entity_type="fee_plan",
        entity_id=plan.id,
        user_id=officer.id,
        institute_id=officer.institute_id,
        details={
            "student_id": str(student.id),
            "student_email": student.email,
            "batch_id": str(batch.id),
            "batch_name": batch.name,
            "plan_type": plan_type,
            "total_amount": payload_fee.total_amount,
            "final_amount": final_amount,
            "discount_type": payload_fee.discount_type,
            "discount_value": payload_fee.discount_value,
            "installments": len(installments),
        },
    )
    return plan


async def _ensure_officer_owns_student(
    session: AsyncSession, *, officer: User, student_id: uuid.UUID
) -> User:
    """Load the student, verifying institute + ownership.

    Officers: only students they onboarded at least one FeePlan for.
    Admins: any student in their institute.
    """
    student = await session.get(User, student_id)
    if (
        student is None
        or student.deleted_at is not None
        or student.institute_id != officer.institute_id
    ):
        raise AdmissionsError("Student not found")

    if officer.role == UserRole.admissions_officer:
        own = await session.execute(
            select(FeePlan.id).where(
                FeePlan.student_id == student_id,
                FeePlan.onboarded_by_user_id == officer.id,
                FeePlan.deleted_at.is_(None),
            ).limit(1)
        )
        if own.scalar_one_or_none() is None:
            raise AdmissionsError("Student not found")

    return student


# ─── Officer control panel operations (Milestone J) ─────────────────────

async def update_student_profile(
    session: AsyncSession,
    *,
    officer: User,
    student_id: uuid.UUID,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> User:
    from app.services.user_service import update_user as _svc_update_user
    from app.services.activity_service import log_activity

    student = await _ensure_officer_owns_student(session, officer=officer, student_id=student_id)

    changes: dict = {}
    if name is not None and name != student.name:
        changes["name"] = name
    if phone is not None and phone != student.phone:
        changes["phone"] = phone
    if email is not None:
        normalized = email.strip().lower()
        if normalized != (student.email or "").lower():
            # Institute-scoped duplicate check
            dupe = await session.execute(
                select(User).where(
                    func.lower(User.email) == normalized,
                    User.institute_id == student.institute_id,
                    User.id != student.id,
                    User.deleted_at.is_(None),
                )
            )
            if dupe.scalar_one_or_none():
                raise AdmissionsError(f"Email '{normalized}' is already in use")
            changes["email"] = normalized

    if not changes:
        return student

    try:
        updated = await _svc_update_user(session, student_id, **changes)
    except ValueError as e:
        raise AdmissionsError(str(e))

    await log_activity(
        session,
        action="admissions.student_updated",
        entity_type="user",
        entity_id=student_id,
        user_id=officer.id,
        institute_id=officer.institute_id,
        details=changes,
    )
    await session.commit()
    await session.refresh(updated)
    return updated


async def suspend_student(
    session: AsyncSession,
    *,
    officer: User,
    student_id: uuid.UUID,
) -> User:
    from app.services.user_service import deactivate_user
    from app.services.activity_service import log_activity

    await _ensure_officer_owns_student(session, officer=officer, student_id=student_id)
    updated = await deactivate_user(session, student_id)
    await log_activity(
        session,
        action="admissions.student_suspended",
        entity_type="user",
        entity_id=student_id,
        user_id=officer.id,
        institute_id=officer.institute_id,
    )
    await session.commit()
    await session.refresh(updated)
    return updated


async def reactivate_student(
    session: AsyncSession,
    *,
    officer: User,
    student_id: uuid.UUID,
) -> User:
    from app.services.user_service import activate_user
    from app.services.activity_service import log_activity

    await _ensure_officer_owns_student(session, officer=officer, student_id=student_id)
    updated = await activate_user(session, student_id)
    await log_activity(
        session,
        action="admissions.student_reactivated",
        entity_type="user",
        entity_id=student_id,
        user_id=officer.id,
        institute_id=officer.institute_id,
    )
    await session.commit()
    await session.refresh(updated)
    return updated


async def soft_delete_student(
    session: AsyncSession,
    *,
    officer: User,
    student_id: uuid.UUID,
) -> None:
    from app.services.user_service import soft_delete_user
    from app.services.activity_service import log_activity

    await _ensure_officer_owns_student(session, officer=officer, student_id=student_id)

    # Cancel all fee plans owned by this student (best-effort; keeps audit trail)
    plans = (await session.execute(
        select(FeePlan).where(
            FeePlan.student_id == student_id,
            FeePlan.deleted_at.is_(None),
        )
    )).scalars().all()
    now = datetime.now(timezone.utc)
    from app.services import webhook_event_service

    for plan in plans:
        plan.status = FeePlanStatus.cancelled.value
        plan.deleted_at = now
        session.add(plan)
        await webhook_event_service.queue_webhook_event(
            session,
            officer.institute_id,
            "fee.plan_cancelled",
            {
                "fee_plan_id": str(plan.id),
                "student_id": str(student_id),
                "batch_id": str(plan.batch_id),
                "student_batch_id": str(plan.student_batch_id),
                "reason": "student_deleted",
                "cancelled_by_user_id": str(officer.id),
                "occurred_at": now.isoformat(),
            },
        )

    await soft_delete_user(session, student_id)
    await log_activity(
        session,
        action="admissions.student_deleted",
        entity_type="user",
        entity_id=student_id,
        user_id=officer.id,
        institute_id=officer.institute_id,
    )
    await session.commit()


async def add_enrollment(
    session: AsyncSession,
    *,
    officer: User,
    student_id: uuid.UUID,
    batch_id: uuid.UUID,
    fee_plan: FeePlanCreate,
    notes: Optional[str] = None,
    payment_proof_object_key: Optional[str] = None,
    initial_payment_amount: Optional[int] = None,
) -> FeePlan:
    """Enroll an existing student in another batch with a new fee plan."""
    student = await _ensure_officer_owns_student(session, officer=officer, student_id=student_id)
    batch = await _load_batch_in_institute(session, batch_id, officer.institute_id)

    # Already enrolled?
    dupe = await session.execute(
        select(StudentBatch).where(
            StudentBatch.student_id == student_id,
            StudentBatch.batch_id == batch_id,
            StudentBatch.removed_at.is_(None),
        )
    )
    if dupe.scalar_one_or_none():
        raise AdmissionsError("Student is already enrolled in this batch")

    plan_type, final_amount, installments = _compute_plan_inputs(fee_plan)

    plan = await _create_enrollment_with_plan(
        session,
        officer=officer,
        student=student,
        batch=batch,
        plan_type=plan_type,
        final_amount=final_amount,
        installments=installments,
        payload_fee=fee_plan,
        notes=notes or fee_plan.notes,
        action="admissions.enrollment_added",
    )

    from app.services import webhook_event_service

    await webhook_event_service.queue_webhook_event(
        session,
        officer.institute_id,
        "fee.plan_created",
        {
            "fee_plan_id": str(plan.id),
            "student_id": str(student.id),
            "student_email": student.email,
            "student_name": student.name,
            "batch_id": str(plan.batch_id),
            "student_batch_id": str(plan.student_batch_id),
            "plan_type": plan.plan_type,
            "total_amount": plan.total_amount,
            "final_amount": final_amount,
            "currency": plan.currency,
            "installment_count": len(installments),
            "onboarded_by_user_id": str(officer.id),
            "source": "add_enrollment",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    # -- Initial payment at onboarding (optional) --
    if payment_proof_object_key or (initial_payment_amount or 0) > 0:
        from app.models.fee import FeePayment as _FeePayment
        _initial_payment = _FeePayment(
            fee_plan_id=plan.id,
            institute_id=officer.institute_id,
            amount=initial_payment_amount or 0,
            payment_date=datetime.now(timezone.utc),
            payment_method="onboarding_upload",
            status="received",
            recorded_by_user_id=officer.id,
            payment_proof_key=payment_proof_object_key,
        )
        session.add(_initial_payment)
        await session.flush()

    await session.commit()
    await session.refresh(plan)
    return plan


async def remove_enrollment(
    session: AsyncSession,
    *,
    officer: User,
    student_id: uuid.UUID,
    student_batch_id: uuid.UUID,
) -> None:
    """Soft-remove an enrollment + cancel its fee plan."""
    from app.services.activity_service import log_activity

    await _ensure_officer_owns_student(session, officer=officer, student_id=student_id)

    sb = await session.get(StudentBatch, student_batch_id)
    if (
        sb is None
        or sb.removed_at is not None
        or sb.student_id != student_id
        or sb.institute_id != officer.institute_id
    ):
        raise AdmissionsError("Enrollment not found")

    now = datetime.now(timezone.utc)
    sb.removed_at = now
    sb.removed_by = officer.id
    sb.is_active = False
    session.add(sb)

    # Cancel the plan for this enrollment
    plan_row = await session.execute(
        select(FeePlan).where(
            FeePlan.student_batch_id == student_batch_id,
            FeePlan.deleted_at.is_(None),
        )
    )
    plan = plan_row.scalar_one_or_none()
    if plan:
        plan.status = FeePlanStatus.cancelled.value
        plan.deleted_at = now
        session.add(plan)

        from app.services import webhook_event_service

        await webhook_event_service.queue_webhook_event(
            session,
            officer.institute_id,
            "fee.plan_cancelled",
            {
                "fee_plan_id": str(plan.id),
                "student_id": str(student_id),
                "batch_id": str(sb.batch_id),
                "student_batch_id": str(student_batch_id),
                "reason": "enrollment_removed",
                "cancelled_by_user_id": str(officer.id),
                "occurred_at": now.isoformat(),
            },
        )

    session.add(
        StudentBatchHistory(
            student_id=student_id,
            batch_id=sb.batch_id,
            action=BatchHistoryAction.removed,
            changed_by=officer.id,
            institute_id=officer.institute_id,
        )
    )

    await log_activity(
        session,
        action="admissions.enrollment_removed",
        entity_type="student_batch",
        entity_id=student_batch_id,
        user_id=officer.id,
        institute_id=officer.institute_id,
        details={
            "student_id": str(student_id),
            "batch_id": str(sb.batch_id),
            "fee_plan_id": str(plan.id) if plan else None,
        },
    )
    await session.commit()


def _generate_temp_password(length: int = 12) -> str:
    """Alphanumeric + one special char, safe to drop into onboarding handoff sheets."""
    alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length - 1)) + "!"


# ─── Read helpers used by the router list/detail endpoints ──────────────

async def list_officer_students(
    session: AsyncSession,
    *,
    current_user: User,
    officer_id: Optional[uuid.UUID] = None,
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
) -> tuple[list[dict], int]:
    """Roster list for officer (own) or admin (any in institute).

    Returned rows carry enough data to render the officer dashboard table:
    student identity, fee plan summary, next due date, overdue flag.
    """
    from sqlalchemy import func, and_, or_
    from sqlalchemy.sql import select as sql_select

    # Identify ownership filter
    if current_user.role == UserRole.admissions_officer:
        owner_filter = FeePlan.onboarded_by_user_id == current_user.id
    elif officer_id is not None:
        owner_filter = FeePlan.onboarded_by_user_id == officer_id
    else:
        owner_filter = True  # admin sees everyone

    institute_filter = FeePlan.institute_id == current_user.institute_id

    base = (
        sql_select(
            FeePlan.id.label("fee_plan_id"),
            FeePlan.student_batch_id,
            FeePlan.plan_type,
            FeePlan.final_amount,
            FeePlan.onboarded_by_user_id,
            FeePlan.created_at,
            User.id.label("user_id"),
            User.name.label("student_name"),
            User.email.label("student_email"),
            User.phone.label("student_phone"),
            User.status.label("student_status"),
            Batch.id.label("batch_id"),
            Batch.name.label("batch_name"),
        )
        .join(User, User.id == FeePlan.student_id)
        .join(Batch, Batch.id == FeePlan.batch_id)
        .where(
            FeePlan.deleted_at.is_(None),
            User.deleted_at.is_(None),
            institute_filter,
            owner_filter,
        )
    )

    if search:
        pattern = f"%{search}%"
        base = base.where(or_(User.name.ilike(pattern), User.email.ilike(pattern), User.phone.ilike(pattern)))

    count_q = sql_select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_q)).scalar_one()

    page_q = base.order_by(FeePlan.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await session.execute(page_q)).all()

    # Aggregate installments per plan in a single query
    plan_ids = [r.fee_plan_id for r in rows]
    aggregates: dict[uuid.UUID, dict] = {}
    if plan_ids:
        agg_q = sql_select(
            FeeInstallment.fee_plan_id,
            func.coalesce(func.sum(FeeInstallment.amount_paid), 0).label("amount_paid"),
            func.coalesce(func.sum(FeeInstallment.amount_due), 0).label("amount_due"),
            func.min(
                func.coalesce(
                    _next_due_expr(FeeInstallment),
                    None,
                )
            ).label("next_due_date"),
        ).where(FeeInstallment.fee_plan_id.in_(plan_ids)).group_by(FeeInstallment.fee_plan_id)
        agg_rows = (await session.execute(agg_q)).all()
        for ar in agg_rows:
            aggregates[ar.fee_plan_id] = dict(
                amount_paid=int(ar.amount_paid),
                amount_due=int(ar.amount_due),
                next_due_date=ar.next_due_date,
            )

        overdue_q = sql_select(FeeInstallment.fee_plan_id).where(
            FeeInstallment.fee_plan_id.in_(plan_ids),
            FeeInstallment.status.in_(
                [FeeInstallmentStatus.pending.value, FeeInstallmentStatus.partially_paid.value]
            ),
            FeeInstallment.due_date < date.today(),
        ).distinct()
        overdue_set = {r[0] for r in (await session.execute(overdue_q)).all()}
    else:
        overdue_set = set()

    # Preload officer names for admin view
    officer_ids = {r.onboarded_by_user_id for r in rows}
    officer_names: dict[uuid.UUID, str] = {}
    if officer_ids:
        officer_q = sql_select(User.id, User.name).where(User.id.in_(officer_ids))
        for oid, oname in (await session.execute(officer_q)).all():
            officer_names[oid] = oname

    items: list[dict] = []
    for r in rows:
        agg = aggregates.get(r.fee_plan_id, {})
        paid = int(agg.get("amount_paid", 0))
        balance = max(int(r.final_amount) - paid, 0)
        items.append(
            dict(
                user_id=r.user_id,
                name=r.student_name,
                email=r.student_email,
                phone=r.student_phone,
                status=r.student_status.value if hasattr(r.student_status, "value") else str(r.student_status),
                batch_id=r.batch_id,
                batch_name=r.batch_name,
                student_batch_id=r.student_batch_id,
                fee_plan_id=r.fee_plan_id,
                plan_type=r.plan_type,
                final_amount=int(r.final_amount),
                amount_paid=paid,
                balance_due=balance,
                next_due_date=agg.get("next_due_date"),
                is_overdue=r.fee_plan_id in overdue_set,
                onboarded_by_user_id=r.onboarded_by_user_id,
                onboarded_by_name=officer_names.get(r.onboarded_by_user_id),
                created_at=r.created_at,
            )
        )

    return items, int(total)


def _next_due_expr(model):
    """Coalesce expression: earliest unpaid installment due_date."""
    from sqlalchemy import case

    return case(
        (
            model.status.in_(
                [FeeInstallmentStatus.pending.value, FeeInstallmentStatus.partially_paid.value]
            ),
            model.due_date,
        ),
        else_=None,
    )


async def get_student_detail(
    session: AsyncSession,
    *,
    current_user: User,
    user_id: uuid.UUID,
) -> dict:
    """Detail view for a single onboarded student (officer scope enforced)."""
    from sqlalchemy.sql import select as sql_select

    base = (
        sql_select(FeePlan, Batch, User)
        .join(User, User.id == FeePlan.student_id)
        .join(Batch, Batch.id == FeePlan.batch_id)
        .where(
            User.id == user_id,
            User.deleted_at.is_(None),
            FeePlan.deleted_at.is_(None),
            FeePlan.institute_id == current_user.institute_id,
        )
    )
    if current_user.role == UserRole.admissions_officer:
        base = base.where(FeePlan.onboarded_by_user_id == current_user.id)

    rows = (await session.execute(base)).all()
    if not rows:
        raise AdmissionsError("Student not found")

    # Load installments for each plan
    plan_ids = [fp.id for fp, _, _ in rows]
    installments_q = sql_select(FeeInstallment).where(
        FeeInstallment.fee_plan_id.in_(plan_ids)
    ).order_by(FeeInstallment.fee_plan_id, FeeInstallment.sequence)
    inst_rows = (await session.execute(installments_q)).scalars().all()

    by_plan: dict[uuid.UUID, list[FeeInstallment]] = {}
    for inst in inst_rows:
        by_plan.setdefault(inst.fee_plan_id, []).append(inst)

    plans: list[dict] = []
    student: Optional[User] = None
    today = date.today()
    for fee_plan, batch, user in rows:
        student = user  # same on every row
        installments = by_plan.get(fee_plan.id, [])
        amount_paid = sum(i.amount_paid for i in installments)
        balance_due = max(fee_plan.final_amount - amount_paid, 0)
        next_due = next(
            (
                i.due_date for i in sorted(installments, key=lambda x: x.due_date)
                if i.status in (
                    FeeInstallmentStatus.pending.value,
                    FeeInstallmentStatus.partially_paid.value,
                )
            ),
            None,
        )
        is_overdue = any(
            i.due_date < today and i.status in (
                FeeInstallmentStatus.pending.value,
                FeeInstallmentStatus.partially_paid.value,
            )
            for i in installments
        )
        plans.append(
            dict(
                plan=fee_plan,
                batch=batch,
                installments=installments,
                amount_paid=amount_paid,
                balance_due=balance_due,
                next_due_date=next_due,
                is_overdue=is_overdue,
            )
        )

    return dict(student=student, plans=plans)

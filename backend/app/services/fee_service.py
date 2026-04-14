"""Core fee-ledger operations — payment recording, installment state transitions,
overdue detection, and expiry extension.

This module is the single source of truth for how a ``FeePayment`` affects its
``FeeInstallment`` and the surrounding ``FeePlan`` / ``StudentBatch`` rows.
Callers are routers or other services; we never talk to HTTP here.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.batch import StudentBatch
from app.models.fee import FeeInstallment, FeePayment, FeePlan
from app.models.enums import (
    FeeInstallmentStatus,
    FeePlanStatus,
    FeePlanType,
    UserRole,
)
from app.models.user import User
from app.schemas.fee import PaymentCreate

logger = logging.getLogger("ict_lms.fee_service")


class FeeError(ValueError):
    """Surface-level validation — router maps to HTTP 400."""


# ─── Payment recording ──────────────────────────────────────────────

async def record_payment(
    session: AsyncSession,
    *,
    actor: User,
    student: User,
    fee_plan: FeePlan,
    payload: PaymentCreate,
) -> FeePayment:
    """Record an offline payment. Updates installments + plan state + expiry.

    Ownership + institute checks are the caller's responsibility. By the time
    this runs we trust ``fee_plan`` is reachable from ``actor``.
    """
    if payload.amount <= 0:
        raise FeeError("Payment amount must be greater than zero")

    target_installment: Optional[FeeInstallment] = None
    if payload.fee_installment_id:
        inst = await session.get(FeeInstallment, payload.fee_installment_id)
        if inst is None or inst.fee_plan_id != fee_plan.id:
            raise FeeError("Installment does not belong to this fee plan")
        target_installment = inst
    else:
        # Auto-pick the earliest unpaid installment (common flow for one-time plans)
        target_installment = await _next_unpaid_installment(session, fee_plan.id)

    if target_installment is None:
        raise FeeError("No open installments on this plan")

    remaining = target_installment.amount_due - target_installment.amount_paid
    if payload.amount > remaining:
        raise FeeError(
            f"Payment of {payload.amount} exceeds remaining {remaining} on installment #{target_installment.sequence}"
        )

    # ── Update installment ──
    target_installment.amount_paid += payload.amount
    now = datetime.now(timezone.utc)
    if target_installment.amount_paid >= target_installment.amount_due:
        target_installment.status = FeeInstallmentStatus.paid.value
    else:
        target_installment.status = FeeInstallmentStatus.partially_paid.value
    target_installment.updated_at = now
    session.add(target_installment)

    # ── Create payment row ──
    payment = FeePayment(
        fee_plan_id=fee_plan.id,
        fee_installment_id=target_installment.id,
        institute_id=fee_plan.institute_id,
        amount=payload.amount,
        payment_date=payload.payment_date,
        payment_method=payload.payment_method,
        status="received",
        reference_number=payload.reference_number,
        recorded_by_user_id=actor.id,
        notes=payload.notes,
    )
    session.add(payment)
    await session.flush()  # so payment.id exists for receipt numbering

    # ── Assign receipt number (institute-scoped sequence) ──
    payment.receipt_number = await _next_receipt_number(session, fee_plan.institute_id)
    session.add(payment)

    # ── Extend expiry on monthly plan payment ──
    if fee_plan.plan_type == FeePlanType.monthly.value and target_installment.status == FeeInstallmentStatus.paid.value:
        await _extend_enrollment_expiry(session, fee_plan.student_batch_id, target_installment.due_date)

    # ── Mark plan complete when all installments paid ──
    if await _all_installments_paid(session, fee_plan.id):
        fee_plan.status = FeePlanStatus.completed.value
        fee_plan.updated_at = now
        session.add(fee_plan)

    # ── Activity log ──
    from app.services.activity_service import log_activity

    await log_activity(
        session,
        action="admissions.payment_recorded",
        entity_type="fee_payment",
        entity_id=payment.id,
        user_id=actor.id,
        institute_id=fee_plan.institute_id,
        details={
            "student_id": str(student.id),
            "fee_plan_id": str(fee_plan.id),
            "installment_id": str(target_installment.id),
            "installment_sequence": target_installment.sequence,
            "amount": payload.amount,
            "method": payload.payment_method,
            "reference": payload.reference_number,
            "receipt_number": payment.receipt_number,
        },
    )

    # ── Webhook events ──
    # Emitted pre-commit so they land in the same transaction as the payment.
    from app.services import webhook_event_service

    await webhook_event_service.queue_webhook_event(
        session,
        fee_plan.institute_id,
        "fee.payment_recorded",
        {
            "payment_id": str(payment.id),
            "fee_plan_id": str(fee_plan.id),
            "fee_installment_id": str(target_installment.id),
            "student_id": str(student.id),
            "batch_id": str(fee_plan.batch_id),
            "student_batch_id": str(fee_plan.student_batch_id),
            "amount": payload.amount,
            "currency": fee_plan.currency,
            "installment_sequence": target_installment.sequence,
            "installment_status": target_installment.status,
            "receipt_number": payment.receipt_number,
            "payment_method": payload.payment_method,
            "reference_number": payload.reference_number,
            "payment_date": payload.payment_date.isoformat() if payload.payment_date else None,
            "recorded_by_user_id": str(actor.id),
            "occurred_at": now.isoformat(),
        },
    )

    if fee_plan.status == FeePlanStatus.completed.value:
        await webhook_event_service.queue_webhook_event(
            session,
            fee_plan.institute_id,
            "fee.plan_completed",
            {
                "fee_plan_id": str(fee_plan.id),
                "student_id": str(student.id),
                "batch_id": str(fee_plan.batch_id),
                "student_batch_id": str(fee_plan.student_batch_id),
                "final_amount": fee_plan.final_amount,
                "currency": fee_plan.currency,
                "completed_at": now.isoformat(),
            },
        )

    await session.commit()
    await session.refresh(payment)
    return payment


async def _next_unpaid_installment(
    session: AsyncSession, fee_plan_id: uuid.UUID
) -> Optional[FeeInstallment]:
    result = await session.execute(
        select(FeeInstallment)
        .where(
            FeeInstallment.fee_plan_id == fee_plan_id,
            FeeInstallment.status.in_(
                [
                    FeeInstallmentStatus.pending.value,
                    FeeInstallmentStatus.partially_paid.value,
                    FeeInstallmentStatus.overdue.value,
                ]
            ),
        )
        .order_by(FeeInstallment.sequence.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _all_installments_paid(session: AsyncSession, fee_plan_id: uuid.UUID) -> bool:
    result = await session.execute(
        select(FeeInstallment)
        .where(
            FeeInstallment.fee_plan_id == fee_plan_id,
            FeeInstallment.status.notin_(
                [FeeInstallmentStatus.paid.value, FeeInstallmentStatus.waived.value]
            ),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is None


async def _extend_enrollment_expiry(
    session: AsyncSession, student_batch_id: uuid.UUID, from_date: date
) -> None:
    """Push ``extended_end_date`` out by one month from ``from_date`` (or current
    extended_end_date, whichever is later).
    """
    sb = await session.get(StudentBatch, student_batch_id)
    if sb is None:
        return
    candidate = _add_one_month(from_date)
    if sb.extended_end_date is None or candidate > sb.extended_end_date:
        sb.extended_end_date = candidate
        session.add(sb)


def _add_one_month(d: date) -> date:
    y = d.year + (d.month // 12)
    m = (d.month % 12) + 1
    day = min(d.day, 28)
    return date(y, m, day)


# ─── Receipt numbering ──────────────────────────────────────────────

async def _next_receipt_number(session: AsyncSession, institute_id: uuid.UUID) -> str:
    """Generate a per-institute sequential receipt number like ``RCP-2026-000123``."""
    from app.models.fee import ReceiptCounter

    year = date.today().year
    result = await session.execute(
        select(ReceiptCounter).where(ReceiptCounter.institute_id == institute_id)
    )
    counter = result.scalar_one_or_none()

    if counter is None:
        counter = ReceiptCounter(institute_id=institute_id, current_year=year, last_sequence=1)
        session.add(counter)
        await session.flush()
        seq = 1
    else:
        if counter.current_year != year:
            counter.current_year = year
            counter.last_sequence = 1
        else:
            counter.last_sequence += 1
        seq = counter.last_sequence
        session.add(counter)

    return f"RCP-{year}-{seq:06d}"


# ─── Overdue detection (used by soft-lock middleware) ───────────────

async def is_plan_overdue(session: AsyncSession, fee_plan_id: uuid.UUID) -> bool:
    """Any installment with due_date < today and not fully paid => overdue."""
    today = date.today()
    result = await session.execute(
        select(FeeInstallment)
        .where(
            FeeInstallment.fee_plan_id == fee_plan_id,
            FeeInstallment.due_date < today,
            FeeInstallment.status.in_(
                [
                    FeeInstallmentStatus.pending.value,
                    FeeInstallmentStatus.partially_paid.value,
                    FeeInstallmentStatus.overdue.value,
                ]
            ),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def has_overdue_fees_for_batch(
    session: AsyncSession, student_id: uuid.UUID, batch_id: uuid.UUID
) -> bool:
    """Does this student have any overdue fee installment for this batch?"""
    today = date.today()
    result = await session.execute(
        select(FeeInstallment)
        .join(FeePlan, FeePlan.id == FeeInstallment.fee_plan_id)
        .where(
            FeePlan.student_id == student_id,
            FeePlan.batch_id == batch_id,
            FeePlan.deleted_at.is_(None),
            FeeInstallment.due_date < today,
            FeeInstallment.status.in_(
                [
                    FeeInstallmentStatus.pending.value,
                    FeeInstallmentStatus.partially_paid.value,
                    FeeInstallmentStatus.overdue.value,
                ]
            ),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


# ─── Authorization helpers ──────────────────────────────────────────

async def load_fee_plan_for_actor(
    session: AsyncSession, *, actor: User, fee_plan_id: uuid.UUID
) -> FeePlan:
    """Fetch ``fee_plan_id`` only if the actor is allowed to operate on it.

    Admissions officers: only their own onboarded plans.
    Admins: all plans in their institute.
    """
    plan = await session.get(FeePlan, fee_plan_id)
    if plan is None or plan.deleted_at is not None:
        raise FeeError("Fee plan not found")
    if actor.institute_id != plan.institute_id:
        raise FeeError("Fee plan not found")
    if actor.role == UserRole.admissions_officer and plan.onboarded_by_user_id != actor.id:
        raise FeeError("Fee plan not found")
    return plan


async def load_payment_for_actor(
    session: AsyncSession, *, actor: User, payment_id: uuid.UUID
) -> FeePayment:
    """Fetch a payment only if the actor, the payment, the plan, and the
    institute all line up. Officers see their own plan's payments; admins see
    any payment inside their institute; students see payments tied to their
    own plans.
    """
    payment = await session.get(FeePayment, payment_id)
    if payment is None:
        raise FeeError("Payment not found")
    if actor.institute_id != payment.institute_id:
        raise FeeError("Payment not found")

    plan = await session.get(FeePlan, payment.fee_plan_id)
    if plan is None or plan.deleted_at is not None:
        raise FeeError("Payment not found")

    if actor.role == UserRole.admissions_officer:
        if plan.onboarded_by_user_id != actor.id:
            raise FeeError("Payment not found")
    elif actor.role == UserRole.student:
        if plan.student_id != actor.id:
            raise FeeError("Payment not found")

    return payment


async def build_receipt_content(
    session: AsyncSession,
    *,
    payment: FeePayment,
    verification_base_url: Optional[str] = None,
):
    """Assemble everything ``generate_receipt_pdf`` needs for ``payment``."""
    from sqlalchemy import func
    from app.models.batch import Batch
    from app.utils.receipt_pdf import ReceiptContent

    plan = await session.get(FeePlan, payment.fee_plan_id)
    student = await session.get(User, plan.student_id)
    batch = await session.get(Batch, plan.batch_id)

    # Running total paid on this plan (including this payment)
    total_paid_row = await session.execute(
        select(func.coalesce(func.sum(FeePayment.amount), 0)).where(
            FeePayment.fee_plan_id == plan.id,
            FeePayment.payment_date <= payment.payment_date,
        )
    )
    total_paid = int(total_paid_row.scalar_one() or 0)
    balance = max(int(plan.final_amount) - total_paid, 0)

    installment_label = None
    if payment.fee_installment_id:
        inst = await session.get(FeeInstallment, payment.fee_installment_id)
        if inst is not None:
            piece = inst.label or f"Installment {inst.sequence}"
            installment_label = f"{piece} · due {inst.due_date.strftime('%d %b %Y')}"

    plan_label_map = {
        "one_time": "One-time fee",
        "monthly": "Monthly plan",
        "installment": "Installment plan",
    }

    return ReceiptContent(
        receipt_number=payment.receipt_number or f"UNASSIGNED-{str(payment.id)[:8]}",
        issued_at=payment.payment_date,
        student_name=student.name,
        student_email=student.email,
        student_phone=student.phone,
        batch_name=batch.name if batch else "",
        plan_label=plan_label_map.get(plan.plan_type, plan.plan_type),
        installment_label=installment_label,
        amount=payment.amount,
        currency=plan.currency,
        payment_method=payment.payment_method,
        reference_number=payment.reference_number,
        notes=payment.notes,
        total_fee=plan.final_amount,
        total_paid_to_date=total_paid,
        balance_remaining=balance,
        verification_url=(
            f"{verification_base_url.rstrip('/')}/receipts/{payment.receipt_number}"
            if verification_base_url and payment.receipt_number
            else None
        ),
    )


async def load_fee_plan_for_student(
    session: AsyncSession, *, actor: User, student_id: uuid.UUID
) -> tuple[User, list[FeePlan]]:
    """Fetch all active plans for a student with ownership filter applied."""
    student = await session.get(User, student_id)
    if student is None or student.deleted_at is not None:
        raise FeeError("Student not found")
    if actor.institute_id != student.institute_id:
        raise FeeError("Student not found")

    q = select(FeePlan).where(
        FeePlan.student_id == student_id,
        FeePlan.deleted_at.is_(None),
        FeePlan.institute_id == actor.institute_id,
    )
    if actor.role == UserRole.admissions_officer:
        q = q.where(FeePlan.onboarded_by_user_id == actor.id)

    plans = (await session.execute(q)).scalars().all()
    if not plans:
        raise FeeError("Student not found")
    return student, list(plans)

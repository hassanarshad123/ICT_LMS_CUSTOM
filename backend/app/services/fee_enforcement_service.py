"""Frappe-driven overdue suspension enforcement.

Daily cron for each institute with frappe_enabled=true:

  1. ``enforce_overdue_suspensions(session, institute_id)``:
       pulls Frappe Sales Orders with overdue payment_schedule rows ->
       maps to the LMS student via FeePlan.student_id -> suspends the
       user (status=inactive, suspension_reason="overdue_fees"),
       bumps ``token_version`` (invalidates existing JWTs), and queues
       a suspension email. Idempotent: already-suspended users are
       skipped. Manual admin suspensions (suspension_reason NULL or
       any other value) are preserved.

  2. ``lift_suspensions_if_cleared(session, institute_id)``:
       finds users suspended with suspension_reason="overdue_fees"
       whose FeePlans' Frappe SOs no longer appear in the overdue set
       -> reactivates them (status=active, suspension_reason=None) and
       queues a reactivation email. Idempotent.

Non-Frappe institutes short-circuit via ``load_active_frappe_config``
returning None. Errors on any single row are swallowed so one bad
row never aborts the batch.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.enums import UserRole, UserStatus
from app.models.fee import FeePlan
from app.models.user import User
from app.services.frappe_client import FrappeClient, OverdueSalesOrder
from app.services.integration_service import load_active_frappe_config

logger = logging.getLogger("ict_lms.fee_enforcement")

SUSPENSION_REASON = "overdue_fees"


@dataclass
class EnforcementSummary:
    checked: int = 0
    newly_suspended: int = 0
    already_suspended: int = 0
    newly_reactivated: int = 0
    errors: int = 0


async def enforce_overdue_suspensions(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> EnforcementSummary:
    """Suspend students whose Frappe SO has an overdue payment_schedule row."""
    summary = EnforcementSummary()
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return summary

    try:
        client = FrappeClient(cfg)
        overdue = await client.list_overdue_sales_orders()
    except Exception:  # noqa: BLE001
        logger.exception("Overdue SO fetch failed for institute %s", institute_id)
        summary.errors += 1
        return summary

    summary.checked = len(overdue)

    for so in overdue:
        try:
            await _apply_suspension(session, institute_id, so, summary)
        except Exception:  # noqa: BLE001
            logger.exception(
                "Failed to apply suspension for SO %s (fee_plan %s)",
                so.name, so.fee_plan_id,
            )
            summary.errors += 1

    await session.commit()
    return summary


async def _apply_suspension(
    session: AsyncSession,
    institute_id: uuid.UUID,
    so: OverdueSalesOrder,
    summary: EnforcementSummary,
) -> None:
    if not so.fee_plan_id:
        return
    try:
        plan_id = uuid.UUID(so.fee_plan_id)
    except ValueError:
        return

    plan = await session.get(FeePlan, plan_id)
    if plan is None or plan.institute_id != institute_id:
        return

    student = await session.get(User, plan.student_id)
    if student is None or student.deleted_at is not None:
        return
    if student.role != UserRole.student:
        return

    if (
        student.status == UserStatus.inactive
        and student.suspension_reason == SUSPENSION_REASON
    ):
        summary.already_suspended += 1
        return

    if student.status != UserStatus.active:
        # Manually suspended / banned / pending -- don't touch.
        return

    student.status = UserStatus.inactive
    student.suspension_reason = SUSPENSION_REASON
    student.token_version = (student.token_version or 0) + 1
    session.add(student)
    summary.newly_suspended += 1

    await _log_suspend_activity(session, student, so)
    await _send_suspension_email(session, student, so)


async def lift_suspensions_if_cleared(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> EnforcementSummary:
    """Reactivate users the service previously auto-suspended."""
    summary = EnforcementSummary()
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return summary

    result = await session.execute(
        select(User).where(
            User.institute_id == institute_id,
            User.status == UserStatus.inactive,
            User.suspension_reason == SUSPENSION_REASON,
            User.deleted_at.is_(None),
        )
    )
    suspended = result.scalars().all()
    summary.checked = len(suspended)
    if not suspended:
        return summary

    try:
        client = FrappeClient(cfg)
        overdue = await client.list_overdue_sales_orders()
    except Exception:  # noqa: BLE001
        logger.exception("Overdue SO refetch failed for institute %s", institute_id)
        summary.errors += 1
        return summary

    still_overdue_plan_ids: set[uuid.UUID] = set()
    for so in overdue:
        try:
            still_overdue_plan_ids.add(uuid.UUID(so.fee_plan_id))
        except (ValueError, TypeError):
            continue

    for student in suspended:
        try:
            await _maybe_lift(session, student, still_overdue_plan_ids, summary)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to lift suspension for user %s", student.id)
            summary.errors += 1

    await session.commit()
    return summary


async def _maybe_lift(
    session: AsyncSession,
    student: User,
    still_overdue_plan_ids: set[uuid.UUID],
    summary: EnforcementSummary,
) -> None:
    plans_q = await session.execute(
        select(FeePlan.id).where(
            FeePlan.student_id == student.id,
            FeePlan.deleted_at.is_(None),
        )
    )
    student_plan_ids = {row[0] for row in plans_q.all()}
    if student_plan_ids & still_overdue_plan_ids:
        return

    student.status = UserStatus.active
    student.suspension_reason = None
    student.token_version = (student.token_version or 0) + 1
    session.add(student)
    summary.newly_reactivated += 1

    await _log_reactivate_activity(session, student)
    await _send_reactivation_email(session, student)


# ─── Side-effect helpers (activity log + email) ─────────────────────
# try/except-wrapped so a failure in logging or email never blocks the
# state change. Suspension is the important bit; notifications are
# best-effort.


async def _log_suspend_activity(
    session: AsyncSession, student: User, so: OverdueSalesOrder,
) -> None:
    try:
        from app.services.activity_service import log_activity
        await log_activity(
            session,
            action="admissions.student_auto_suspended",
            entity_type="user",
            entity_id=student.id,
            user_id=student.id,
            institute_id=student.institute_id,
            details={
                "reason": SUSPENSION_REASON,
                "frappe_sales_order": so.name,
                "grand_total": so.grand_total,
                "overdue_installments": [
                    {
                        "payment_term": o.payment_term,
                        "due_date": o.due_date,
                        "amount_due": o.amount_due,
                        "outstanding": o.outstanding,
                    }
                    for o in so.overdue_installments
                ],
            },
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to log auto-suspend activity for user %s", student.id)


async def _log_reactivate_activity(session: AsyncSession, student: User) -> None:
    try:
        from app.services.activity_service import log_activity
        await log_activity(
            session,
            action="admissions.student_auto_reactivated",
            entity_type="user",
            entity_id=student.id,
            user_id=student.id,
            institute_id=student.institute_id,
            details={"reason": SUSPENSION_REASON},
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to log auto-reactivate activity for user %s", student.id,
        )


async def _send_suspension_email(
    session: AsyncSession, student: User, so: OverdueSalesOrder,
) -> None:
    try:
        from app.utils.email_sender import send_email_background, should_send_email
        try:
            # Phase 5 adds these; import lazily so this module stays loadable
            # before they exist.
            from app.utils.email_templates import overdue_suspension_email  # type: ignore
        except ImportError:
            return
        if not await should_send_email(
            session, student.institute_id, student.id, "email_fee_overdue",
        ):
            return
        subject, html = overdue_suspension_email(
            student_name=student.name,
            institute_id=student.institute_id,
            overdue_rows=so.overdue_installments,
            grand_total=so.grand_total,
        )
        send_email_background(student.email, subject, html)
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to dispatch suspension email for user %s", student.id,
        )


async def _send_reactivation_email(session: AsyncSession, student: User) -> None:
    try:
        from app.utils.email_sender import send_email_background, should_send_email
        try:
            from app.utils.email_templates import overdue_reactivation_email  # type: ignore
        except ImportError:
            return
        if not await should_send_email(
            session, student.institute_id, student.id, "email_fee_overdue",
        ):
            return
        subject, html = overdue_reactivation_email(
            student_name=student.name,
            institute_id=student.institute_id,
        )
        send_email_background(student.email, subject, html)
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to dispatch reactivation email for user %s", student.id,
        )

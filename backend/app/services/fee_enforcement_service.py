"""Frappe-driven overdue suspension enforcement (SI-based, grace-aware).

Daily cron for each institute with frappe_enabled=true:

  1. ``enforce_overdue_suspensions(session, institute_id)``:
       pulls Frappe Sales Invoices whose status is NOT Paid / Partly
       Paid / Cancelled / Return / Credit Note Issued -> maps each to
       the LMS student via FeePlan.student_id. Skips any plan whose
       grace_period_ends_at is still in the future. Suspends the rest
       (status=inactive, suspension_reason="overdue_fees"), bumps
       token_version (invalidates existing JWTs), queues an email.
       Idempotent: already-suspended users are skipped. Manual admin
       suspensions (suspension_reason != "overdue_fees") are preserved.

  2. ``lift_suspensions_if_cleared(session, institute_id)``:
       finds users the service previously suspended and re-checks the
       unpaid-SI list. Any student whose FeePlans are no longer in the
       unpaid set gets reactivated (status=active, reason=None).
       Idempotent.

Non-Frappe institutes short-circuit via ``load_active_frappe_config``
returning None. Errors on any single row are swallowed so one bad
row never aborts the batch.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.enums import UserRole, UserStatus
from app.models.fee import FeePlan
from app.models.user import User
from app.services.frappe_client import FrappeClient, OverdueSalesOrder, UnpaidSalesInvoice
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
    """Suspend students whose Sales Invoice is still unpaid past the 72h grace."""
    summary = EnforcementSummary()
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return summary

    try:
        client = FrappeClient(cfg)
        unpaid = await client.list_unpaid_sales_invoices()
    except Exception:  # noqa: BLE001
        logger.exception("Unpaid SI fetch failed for institute %s", institute_id)
        summary.errors += 1
        return summary

    summary.checked = len(unpaid)
    now = datetime.now(timezone.utc)

    for si in unpaid:
        try:
            await _apply_suspension_from_si(session, institute_id, si, now, summary)
        except Exception:  # noqa: BLE001
            logger.exception(
                "Failed to apply SI-based suspension for SI %s (fee_plan %s)",
                si.name, si.fee_plan_id,
            )
            summary.errors += 1

    await session.commit()
    return summary


async def _apply_suspension_from_si(
    session: AsyncSession,
    institute_id: uuid.UUID,
    si: UnpaidSalesInvoice,
    now: datetime,
    summary: EnforcementSummary,
) -> None:
    if not si.fee_plan_id:
        return
    try:
        plan_id = uuid.UUID(si.fee_plan_id)
    except ValueError:
        return

    plan = await session.get(FeePlan, plan_id)
    if plan is None or plan.institute_id != institute_id:
        return

    # Honor the 72h grace window. NULL grace_period_ends_at is treated as
    # "elapsed" -- legacy plans that predate this column never had a grace.
    if plan.grace_period_ends_at is not None and plan.grace_period_ends_at > now:
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

    await _log_suspend_activity_si(session, student, si)
    await _send_suspension_email_si(session, student, si)


# Legacy SO-based helper retained one release so in-flight job imports don't
# break. Delete in the next release.
async def _apply_suspension(
    session: AsyncSession,
    institute_id: uuid.UUID,
    so: OverdueSalesOrder,
    summary: EnforcementSummary,
) -> None:  # pragma: no cover - superseded by _apply_suspension_from_si
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
        unpaid = await client.list_unpaid_sales_invoices()
    except Exception:  # noqa: BLE001
        logger.exception("Unpaid SI refetch failed for institute %s", institute_id)
        summary.errors += 1
        return summary

    still_unpaid_plan_ids: set[uuid.UUID] = set()
    for si in unpaid:
        try:
            still_unpaid_plan_ids.add(uuid.UUID(si.fee_plan_id))
        except (ValueError, TypeError):
            continue

    for student in suspended:
        try:
            await _maybe_lift(session, student, still_unpaid_plan_ids, summary)
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


async def _log_suspend_activity_si(
    session: AsyncSession, student: User, si: UnpaidSalesInvoice,
) -> None:
    """SI-based variant of the suspend activity log."""
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
                "frappe_sales_invoice": si.name,
                "outstanding_amount": si.outstanding_amount,
                "grand_total": si.grand_total,
                "si_status": si.status,
            },
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to log SI-based auto-suspend activity for user %s", student.id,
        )


async def _send_suspension_email_si(
    session: AsyncSession, student: User, si: UnpaidSalesInvoice,
) -> None:
    """SI-based variant of the suspension email. Reuses the existing
    overdue_suspension_email template by synthesizing a single-row
    overdue structure from the SI's outstanding amount."""
    try:
        from app.utils.email_sender import (
            build_login_url, get_institute_branding,
            send_email_background, should_send_email,
        )
        try:
            from app.utils.email_templates import overdue_suspension_email  # type: ignore
        except ImportError:
            return
        if not await should_send_email(
            session, student.institute_id, student.id, "email_fee_overdue",
        ):
            return
        branding = await get_institute_branding(session, student.institute_id)
        # Build a single-row overdue structure the existing template accepts
        # (it reads payment_term / due_date / outstanding via attribute access).
        overdue_rows = [type("Row", (), {
            "payment_term": "Invoice outstanding",
            "due_date": "",
            "amount_due": si.grand_total,
            "outstanding": si.outstanding_amount,
        })()]
        subject, html = overdue_suspension_email(
            student_name=student.name,
            overdue_rows=overdue_rows,
            grand_total=si.grand_total,
            currency="PKR",
            login_url=build_login_url(branding["slug"]),
            institute_name=branding["name"],
            logo_url=branding.get("logo_url"),
            accent_color=branding.get("accent_color", "#C5D86D"),
        )
        send_email_background(student.email, subject, html, from_name=branding["name"])
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to dispatch SI-based suspension email for user %s", student.id,
        )


# Legacy SO-based helpers retained one release for backward-compat imports.
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
        from app.utils.email_sender import (
            build_login_url,
            get_institute_branding,
            send_email_background,
            should_send_email,
        )
        try:
            from app.utils.email_templates import overdue_suspension_email  # type: ignore
        except ImportError:
            return
        if not await should_send_email(
            session, student.institute_id, student.id, "email_fee_overdue",
        ):
            return
        branding = await get_institute_branding(session, student.institute_id)
        subject, html = overdue_suspension_email(
            student_name=student.name,
            overdue_rows=so.overdue_installments,
            grand_total=so.grand_total,
            currency="PKR",
            login_url=build_login_url(branding["slug"]),
            institute_name=branding["name"],
            logo_url=branding.get("logo_url"),
            accent_color=branding.get("accent_color", "#C5D86D"),
        )
        send_email_background(student.email, subject, html, from_name=branding["name"])
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to dispatch suspension email for user %s", student.id,
        )


async def _send_reactivation_email(session: AsyncSession, student: User) -> None:
    try:
        from app.utils.email_sender import (
            build_login_url,
            get_institute_branding,
            send_email_background,
            should_send_email,
        )
        try:
            from app.utils.email_templates import overdue_reactivation_email  # type: ignore
        except ImportError:
            return
        if not await should_send_email(
            session, student.institute_id, student.id, "email_fee_overdue",
        ):
            return
        branding = await get_institute_branding(session, student.institute_id)
        subject, html = overdue_reactivation_email(
            student_name=student.name,
            login_url=build_login_url(branding["slug"]),
            institute_name=branding["name"],
            logo_url=branding.get("logo_url"),
            accent_color=branding.get("accent_color", "#C5D86D"),
        )
        send_email_background(student.email, subject, html, from_name=branding["name"])
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to dispatch reactivation email for user %s", student.id,
        )

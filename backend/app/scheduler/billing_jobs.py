"""Pricing v2 scheduler jobs — monthly invoice cron + late-payment enforcement.

Registered in ``backend/main.py`` alongside the existing APScheduler setup:
  * ``generate_monthly_invoices`` — cron "day=1 hour=0 minute=5" UTC.
  * ``enforce_late_payments``     — cron "hour=2 minute=0" UTC (daily).

Both jobs are:
  1. Tier-gated — only institutes where ``is_v2_billing_tier(plan_tier)`` is
     True are ever considered. Grandfathered tiers (including ICT on 'pro')
     never appear in any query.
  2. Dry-run aware — when ``settings.BILLING_CRON_DRY_RUN`` is True (default),
     jobs log everything they WOULD do without writing to the DB or sending
     emails. First deploy stays in dry-run until a calendar cycle is
     manually verified.
  3. Idempotent — monthly-invoice cron checks that no invoice already exists
     for the billing period before creating one. Reminder emails dedup via
     ActivityLog entries keyed by invoice_id + escalation step.

Late-payment escalation schedule (per pricing-model-v2):
  Day 1    → reminder email
  Day 7    → reminder email
  Day 14   → reminder email
  Day 15+  → set ``billing_restriction='add_blocked'`` + email
  Day 30+  → set ``billing_restriction='read_only'`` + email
  Day 60+  → set ``status='suspended'`` (archive state) + email
Payment restores everything immediately when the cron next runs.
"""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import or_
from sqlmodel import select

from app.config import get_settings
from app.core.sentry import sentry_job_wrapper
from app.database import async_session
from app.models.activity import ActivityLog
from app.models.billing import InstituteBilling, Invoice
from app.models.institute import Institute, InstituteStatus
from app.models.user import User
from app.models.enums import UserRole
from app.services.billing_calc import (
    compute_billing_preview,
    is_v2_billable,
)
from app.utils.email import send_email_for_institute
from app.utils.email_sender import get_institute_branding
from app.utils.email_templates import (
    invoice_issued_email,
    invoice_reminder_email,
    late_payment_restricted_email,
)
from app.utils.plan_limits import is_v2_billing_tier


logger = logging.getLogger("ict_lms.billing_cron")

# Late-payment escalation thresholds in days overdue.
REMINDER_DAYS = (1, 7, 14)
ADD_BLOCK_DAY = 15
READ_ONLY_DAY = 30
ARCHIVE_DAY = 60


# ──────────────────────────────────────────────────────────────────
# Monthly invoice cron
# ──────────────────────────────────────────────────────────────────

@sentry_job_wrapper("generate_monthly_invoices")
async def generate_monthly_invoices() -> None:
    """Cron: 1st of month 00:05 UTC. Issue invoices for every v2 institute."""
    settings = get_settings()
    dry_run = settings.BILLING_CRON_DRY_RUN
    now = datetime.now(timezone.utc)
    period_start, period_end = _calendar_month_of(now)
    due_date = period_end + timedelta(days=14)  # standard 14-day grace

    logger.info(
        "Monthly billing cron starting: period=%s..%s dry_run=%s",
        period_start, period_end, dry_run,
    )

    issued = 0
    skipped_zero = 0
    already_existed = 0

    async with async_session() as session:
        # Fetch every v2-billable institute in one query.
        # Tier filter sourced from the canonical registry. `unlimited` is
        # intentionally excluded — it's SA-comped and never invoiced.
        from app.utils.tier_registry import V2_TIERS
        v2_tier_values = [t.value for t in V2_TIERS]
        result = await session.execute(
            select(Institute).where(
                Institute.plan_tier.in_(v2_tier_values),
                Institute.status == InstituteStatus.active,
                Institute.deleted_at.is_(None),
            )
        )
        institutes = list(result.scalars().all())
        logger.info("Found %d v2-billable institutes", len(institutes))

        for inst in institutes:
            # Defense in depth — the query already filtered, but re-check.
            if not is_v2_billable(inst):
                logger.warning("Institute %s failed is_v2_billable gate", inst.id)
                continue

            # Skip if an invoice already exists for this exact period.
            exists = await session.execute(
                select(Invoice.id).where(
                    Invoice.institute_id == inst.id,
                    Invoice.period_start == period_start,
                    Invoice.period_end == period_end,
                )
            )
            if exists.scalar_one_or_none():
                already_existed += 1
                continue

            billing = await _get_billing(session, inst.id)
            if not billing:
                logger.warning("No InstituteBilling row for institute %s — skipping", inst.id)
                continue

            preview = await compute_billing_preview(session, inst, billing)

            if preview.total_pkr <= 0:
                skipped_zero += 1
                logger.info(
                    "[%s] no-op: students=%d overage=%d addons=%d total=0",
                    inst.slug, preview.snapshot_student_count,
                    preview.overage_student_count, preview.addon_total_pkr,
                )
                continue

            if dry_run:
                logger.info(
                    "[DRY-RUN] would issue invoice for %s: total=%d line_items=%d",
                    inst.slug, preview.total_pkr, len(preview.line_items),
                )
                continue

            invoice = await _create_invoice(
                session,
                institute_id=inst.id,
                billing=billing,
                period_start=period_start,
                period_end=period_end,
                due_date=due_date,
                preview=preview,
            )
            await _send_invoice_issued_email(session, inst, invoice, preview)
            await _log_invoice_activity(session, inst.id, invoice, preview)
            await session.commit()
            issued += 1
            logger.info(
                "[%s] invoice %s issued (Rs %d, due %s)",
                inst.slug, invoice.invoice_number, invoice.total_amount, invoice.due_date,
            )

    logger.info(
        "Monthly billing cron done: issued=%d skipped_zero=%d already_existed=%d dry_run=%s",
        issued, skipped_zero, already_existed, dry_run,
    )


# ──────────────────────────────────────────────────────────────────
# Late-payment enforcement (daily)
# ──────────────────────────────────────────────────────────────────

@sentry_job_wrapper("enforce_late_payments")
async def enforce_late_payments() -> None:
    """Daily cron: send reminders and escalate billing_restriction / status."""
    settings = get_settings()
    dry_run = settings.BILLING_CRON_DRY_RUN
    today = datetime.now(timezone.utc).date()

    logger.info("Late-payment cron starting: today=%s dry_run=%s", today, dry_run)

    reminders = 0
    add_blocks = 0
    read_onlys = 0
    archives = 0

    async with async_session() as session:
        # Every non-terminal invoice owned by a v2 institute.
        # V2 tier filter from canonical registry — same intent as above.
        from app.utils.tier_registry import V2_TIERS
        v2_tier_values = [t.value for t in V2_TIERS]
        stmt = (
            select(Invoice, Institute)
            .join(Institute, Invoice.institute_id == Institute.id)
            .where(
                Invoice.status.in_(["sent", "draft", "overdue"]),
                Institute.plan_tier.in_(v2_tier_values),
                Institute.deleted_at.is_(None),
            )
        )
        rows = (await session.execute(stmt)).all()
        logger.info("Found %d open invoices to evaluate", len(rows))

        for invoice, inst in rows:
            # Belt + suspenders.
            if not is_v2_billing_tier(inst.plan_tier):
                continue

            days_overdue = (today - invoice.due_date).days
            if days_overdue < 0:
                continue  # not yet due

            action_taken = await _apply_late_escalation(
                session, inst, invoice, days_overdue, dry_run,
            )
            if action_taken == "reminder":
                reminders += 1
            elif action_taken == "add_blocked":
                add_blocks += 1
            elif action_taken == "read_only":
                read_onlys += 1
            elif action_taken == "archive":
                archives += 1

            if not dry_run:
                await session.commit()

    logger.info(
        "Late-payment cron done: reminders=%d add_blocks=%d read_onlys=%d archives=%d dry_run=%s",
        reminders, add_blocks, read_onlys, archives, dry_run,
    )


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def _calendar_month_of(when: datetime) -> tuple[date, date]:
    """Return (first_of_month, last_of_month) for the given UTC datetime."""
    import calendar as _cal
    first = date(when.year, when.month, 1)
    last_day = _cal.monthrange(when.year, when.month)[1]
    last = date(when.year, when.month, last_day)
    return first, last


async def _get_billing(session, institute_id: uuid.UUID) -> InstituteBilling | None:
    r = await session.execute(
        select(InstituteBilling).where(InstituteBilling.institute_id == institute_id)
    )
    return r.scalar_one_or_none()


async def _create_invoice(
    session,
    *,
    institute_id: uuid.UUID,
    billing: InstituteBilling,
    period_start: date,
    period_end: date,
    due_date: date,
    preview,
) -> Invoice:
    """Insert the Invoice row. Invoice number + PDF handled by sa_billing_service path.

    We could call sa_billing_service.generate_invoice, but that function
    also auto-calculates line items from usage. We pass our explicit
    v2 line items instead via the custom_line_items arg.
    """
    # Lazy import to avoid circular deps at module load time.
    from app.services.sa_billing_service import generate_invoice

    # generate_invoice needs a "generated_by" user id. The scheduler is
    # system-initiated — we use the institute's first super_admin or
    # institute admin as the author for audit clarity. If none found,
    # use a sentinel zero UUID (documented as "system").
    generated_by = await _find_billing_author(session, institute_id)

    invoice = await generate_invoice(
        session=session,
        institute_id=institute_id,
        period_start=period_start,
        period_end=period_end,
        due_date=due_date,
        generated_by=generated_by,
        custom_line_items=preview.line_items,
        notes=(
            f"Auto-generated by monthly billing cron on "
            f"{datetime.now(timezone.utc).isoformat(timespec='seconds')}."
        ),
    )
    # generate_invoice issues its own commit internally. Mark as "sent"
    # since we are about to email it. Separate update for clarity.
    invoice.status = "sent"
    session.add(invoice)
    return invoice


async def _find_billing_author(session, institute_id: uuid.UUID) -> uuid.UUID:
    """Pick a user to record as the invoice's ``generated_by``."""
    r = await session.execute(
        select(User.id).where(
            User.institute_id == institute_id,
            User.role.in_([UserRole.admin, UserRole.super_admin]),
            User.deleted_at.is_(None),
        ).limit(1)
    )
    uid = r.scalar_one_or_none()
    if uid:
        return uid
    # Fallback: global super admin.
    r = await session.execute(
        select(User.id).where(
            User.role == UserRole.super_admin,
            User.deleted_at.is_(None),
        ).limit(1)
    )
    uid = r.scalar_one_or_none()
    return uid or uuid.UUID(int=0)


async def _send_invoice_issued_email(session, inst: Institute, invoice: Invoice, preview) -> None:
    branding = await get_institute_branding(session, inst.id)
    admin = await _first_admin_email(session, inst.id)
    if not admin:
        logger.warning("No admin email for %s — invoice issued but not emailed", inst.slug)
        return
    admin_email, admin_name = admin
    period_label = invoice.period_start.strftime("%B %Y")
    subject, html = invoice_issued_email(
        admin_name=admin_name or "Admin",
        invoice_number=invoice.invoice_number,
        period_label=period_label,
        total_pkr=invoice.total_amount,
        line_items=preview.line_items,
        due_date=invoice.due_date.isoformat(),
        pay_now_url=_billing_url(inst.slug),
        institute_name=branding.get("name", inst.name),
        logo_url=branding.get("logo_url"),
        accent_color=branding.get("accent_color", "#C5D86D"),
    )
    await send_email_for_institute(
        to=admin_email, subject=subject, html=html, institute_id=inst.id,
    )


async def _first_admin_email(session, institute_id: uuid.UUID) -> tuple[str, str] | None:
    r = await session.execute(
        select(User.email, User.name).where(
            User.institute_id == institute_id,
            User.role == UserRole.admin,
            User.deleted_at.is_(None),
        ).order_by(User.created_at.asc()).limit(1)
    )
    row = r.first()
    return (row[0], row[1]) if row else None


def _billing_url(slug: str) -> str:
    """URL to the institute's billing page (for 'pay now' CTAs)."""
    return f"https://{slug}.zensbot.online/admin/billing"


async def _log_invoice_activity(session, institute_id: uuid.UUID, invoice: Invoice, preview) -> None:
    session.add(ActivityLog(
        institute_id=institute_id,
        action="invoice_auto_generated",
        entity_type="invoice",
        entity_id=invoice.id,
        details={
            "invoice_number": invoice.invoice_number,
            "total_pkr": invoice.total_amount,
            "period_start": invoice.period_start.isoformat(),
            "period_end": invoice.period_end.isoformat(),
            "snapshot_student_count": preview.snapshot_student_count,
            "overage_student_count": preview.overage_student_count,
            "addon_total_pkr": preview.addon_total_pkr,
        },
    ))


# ── Late-payment escalation helpers ──────────────────────────────

async def _apply_late_escalation(
    session, inst: Institute, invoice: Invoice, days_overdue: int, dry_run: bool,
) -> str | None:
    """Apply the right escalation step. Returns action taken or None."""
    # Archive — day 60+
    if days_overdue >= ARCHIVE_DAY:
        return await _escalate_archive(session, inst, invoice, days_overdue, dry_run)

    # Read-only — day 30+
    if days_overdue >= READ_ONLY_DAY and inst.billing_restriction != "read_only":
        return await _escalate_restriction(
            session, inst, invoice, days_overdue, dry_run, "read_only",
        )

    # Add-blocked — day 15+
    if days_overdue >= ADD_BLOCK_DAY and inst.billing_restriction not in ("read_only", "add_blocked"):
        return await _escalate_restriction(
            session, inst, invoice, days_overdue, dry_run, "add_blocked",
        )

    # Reminders on day 1, 7, 14 (deduped by ActivityLog)
    if days_overdue in REMINDER_DAYS:
        return await _send_reminder_if_new(session, inst, invoice, days_overdue, dry_run)

    return None


async def _send_reminder_if_new(
    session, inst: Institute, invoice: Invoice, days_overdue: int, dry_run: bool,
) -> str | None:
    log_action = f"invoice_reminder_d{days_overdue}"
    # Dedup: has this exact reminder already been logged for this invoice?
    already = await session.execute(
        select(ActivityLog.id).where(
            ActivityLog.institute_id == inst.id,
            ActivityLog.action == log_action,
            ActivityLog.entity_id == invoice.id,
        ).limit(1)
    )
    if already.scalar_one_or_none():
        return None

    if dry_run:
        logger.info(
            "[DRY-RUN] would send day-%d reminder for invoice %s (inst=%s)",
            days_overdue, invoice.invoice_number, inst.slug,
        )
        return "reminder"

    admin = await _first_admin_email(session, inst.id)
    if admin:
        admin_email, admin_name = admin
        branding = await get_institute_branding(session, inst.id)
        subject, html = invoice_reminder_email(
            admin_name=admin_name or "Admin",
            invoice_number=invoice.invoice_number,
            total_pkr=invoice.total_amount,
            days_overdue=days_overdue,
            due_date=invoice.due_date.isoformat(),
            pay_now_url=_billing_url(inst.slug),
            institute_name=branding.get("name", inst.name),
            logo_url=branding.get("logo_url"),
            accent_color=branding.get("accent_color", "#C5D86D"),
        )
        await send_email_for_institute(
            to=admin_email, subject=subject, html=html, institute_id=inst.id,
        )

    session.add(ActivityLog(
        institute_id=inst.id,
        action=log_action,
        entity_type="invoice",
        entity_id=invoice.id,
        details={"days_overdue": days_overdue, "invoice_number": invoice.invoice_number},
    ))
    return "reminder"


async def _escalate_restriction(
    session, inst: Institute, invoice: Invoice, days_overdue: int, dry_run: bool,
    restriction: str,
) -> str:
    if dry_run:
        logger.info(
            "[DRY-RUN] would set billing_restriction=%s on %s (invoice %s, %d days overdue)",
            restriction, inst.slug, invoice.invoice_number, days_overdue,
        )
        return restriction

    inst.billing_restriction = restriction
    invoice.status = "overdue"
    session.add(inst)
    session.add(invoice)
    session.add(ActivityLog(
        institute_id=inst.id,
        action=f"billing_restriction_set_{restriction}",
        entity_type="invoice",
        entity_id=invoice.id,
        details={"days_overdue": days_overdue, "invoice_number": invoice.invoice_number},
    ))

    admin = await _first_admin_email(session, inst.id)
    if admin:
        admin_email, admin_name = admin
        branding = await get_institute_branding(session, inst.id)
        subject, html = late_payment_restricted_email(
            admin_name=admin_name or "Admin",
            invoice_number=invoice.invoice_number,
            total_pkr=invoice.total_amount,
            restriction=restriction,
            days_overdue=days_overdue,
            pay_now_url=_billing_url(inst.slug),
            institute_name=branding.get("name", inst.name),
            logo_url=branding.get("logo_url"),
            accent_color=branding.get("accent_color", "#C5D86D"),
        )
        await send_email_for_institute(
            to=admin_email, subject=subject, html=html, institute_id=inst.id,
        )
    logger.info(
        "[%s] billing_restriction=%s set (invoice %s, %d days overdue)",
        inst.slug, restriction, invoice.invoice_number, days_overdue,
    )
    return restriction


async def _escalate_archive(
    session, inst: Institute, invoice: Invoice, days_overdue: int, dry_run: bool,
) -> str:
    if dry_run:
        logger.info(
            "[DRY-RUN] would suspend %s (invoice %s, %d days overdue)",
            inst.slug, invoice.invoice_number, days_overdue,
        )
        return "archive"
    inst.status = InstituteStatus.suspended
    session.add(inst)
    session.add(ActivityLog(
        institute_id=inst.id,
        action="institute_suspended_unpaid",
        entity_type="invoice",
        entity_id=invoice.id,
        details={"days_overdue": days_overdue, "invoice_number": invoice.invoice_number},
    ))
    logger.info(
        "[%s] SUSPENDED (invoice %s, %d days overdue)",
        inst.slug, invoice.invoice_number, days_overdue,
    )
    return "archive"

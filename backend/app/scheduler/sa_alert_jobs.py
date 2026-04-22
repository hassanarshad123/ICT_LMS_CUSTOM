from __future__ import annotations

import logging
from datetime import date, datetime, timezone, timedelta

from sqlalchemy import func, select

from app.database import async_session
from app.models.institute import Institute, InstituteUsage
from app.models.billing import Invoice
from app.models.system_job import SystemJob
from app.models.error_log import ErrorLog
from app.services import sa_alert_service

logger = logging.getLogger(__name__)


async def check_sa_alert_conditions() -> None:
    async with async_session() as session:
        try:
            await _check_quota_warnings(session)
            await _check_overdue_invoices(session)
            await _check_job_failures(session)
            await _check_error_rate_spike(session)
            await session.commit()
        except Exception:
            logger.exception("SA alert check failed")
            await session.rollback()


async def _check_quota_warnings(session) -> None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await session.execute(
        select(Institute, InstituteUsage)
        .join(InstituteUsage, InstituteUsage.institute_id == Institute.id)
        .where(Institute.deleted_at.is_(None), Institute.status == "active")
    )
    for inst, usage in result.all():
        if inst.max_users and inst.max_users > 0:
            pct = (usage.current_users / inst.max_users) * 100
            if pct > 90:
                await sa_alert_service.create_alert(
                    session,
                    alert_type="quota_warning_90",
                    severity="critical",
                    title=f"{inst.name}: users at {pct:.0f}%",
                    message=f"{inst.name} ({inst.slug}) has reached {pct:.0f}% of user quota ({usage.current_users}/{inst.max_users}).",
                    entity_type="institute",
                    entity_id=inst.id,
                    link=f"/sa/institutes/{inst.id}",
                    dedup_key=f"quota_warning_90:{inst.id}:users:{today}",
                )
            elif pct > 80:
                await sa_alert_service.create_alert(
                    session,
                    alert_type="quota_warning_80",
                    severity="warning",
                    title=f"{inst.name}: users at {pct:.0f}%",
                    message=f"{inst.name} ({inst.slug}) has reached {pct:.0f}% of user quota ({usage.current_users}/{inst.max_users}).",
                    entity_type="institute",
                    entity_id=inst.id,
                    link=f"/sa/institutes/{inst.id}",
                    dedup_key=f"quota_warning_80:{inst.id}:users:{today}",
                )


async def _check_overdue_invoices(session) -> None:
    today = date.today()
    result = await session.execute(
        select(Invoice).where(Invoice.status == "sent", Invoice.due_date < today)
    )
    for invoice in result.scalars().all():
        await sa_alert_service.create_alert(
            session,
            alert_type="invoice_overdue",
            severity="warning",
            title=f"Invoice {invoice.invoice_number} overdue",
            message=f"Invoice {invoice.invoice_number} was due on {invoice.due_date.isoformat()}.",
            entity_type="invoice",
            entity_id=invoice.id,
            link="/sa/billing",
            dedup_key=f"invoice_overdue:{invoice.id}",
        )


async def _check_job_failures(session) -> None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await session.execute(
        select(SystemJob).where(SystemJob.last_status == "failure")
    )
    for job in result.scalars().all():
        await sa_alert_service.create_alert(
            session,
            alert_type="job_failure",
            severity="warning",
            title=f"Job failed: {job.name}",
            message=f"Scheduler job '{job.name}' failed. Error: {(job.last_error or 'unknown')[:200]}",
            entity_type="job",
            link="/sa/health",
            dedup_key=f"job_failure:{job.name}:{today}",
        )


async def _check_error_rate_spike(session) -> None:
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)

    current_hour = (await session.execute(
        select(func.count(ErrorLog.id)).where(ErrorLog.created_at >= hour_ago)
    )).scalar() or 0

    last_24h = (await session.execute(
        select(func.count(ErrorLog.id)).where(ErrorLog.created_at >= day_ago)
    )).scalar() or 0

    avg_hourly = last_24h / 24.0

    if current_hour >= 10 and avg_hourly > 0 and current_hour > 3 * avg_hourly:
        hour_key = now.strftime("%Y-%m-%d-%H")
        await sa_alert_service.create_alert(
            session,
            alert_type="error_rate_spike",
            severity="warning",
            title=f"Error rate spike: {current_hour} errors in last hour",
            message=f"Detected {current_hour} errors in the last hour vs {avg_hourly:.1f} avg/hour.",
            entity_type="system",
            link="/sa/monitoring",
            dedup_key=f"error_rate_spike:{hour_key}",
        )

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sa_alert import SAAlert, SAAlertPreference

SA_ALERT_TYPES = {
    "quota_warning_80": {"label": "Quota Warning (80%)", "category": "quota", "default_severity": "warning"},
    "quota_warning_90": {"label": "Quota Critical (90%)", "category": "quota", "default_severity": "critical"},
    "invoice_overdue": {"label": "Invoice Overdue", "category": "billing", "default_severity": "warning"},
    "payment_received": {"label": "Payment Received", "category": "billing", "default_severity": "info"},
    "billing_escalation_15": {"label": "Billing Escalation (Day 15)", "category": "billing", "default_severity": "warning"},
    "billing_escalation_30": {"label": "Billing Escalation (Day 30)", "category": "billing", "default_severity": "critical"},
    "billing_escalation_60": {"label": "Billing Escalation (Day 60)", "category": "billing", "default_severity": "critical"},
    "job_failure": {"label": "Scheduler Job Failure", "category": "system", "default_severity": "warning"},
    "db_latency_high": {"label": "DB Latency High", "category": "system", "default_severity": "critical"},
    "redis_down": {"label": "Redis Unavailable", "category": "system", "default_severity": "critical"},
    "error_rate_spike": {"label": "Error Rate Spike", "category": "system", "default_severity": "warning"},
}


async def create_alert(
    session: AsyncSession,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[uuid.UUID] = None,
    link: Optional[str] = None,
    dedup_key: Optional[str] = None,
) -> SAAlert | None:
    if dedup_key:
        existing = await session.execute(
            select(SAAlert).where(SAAlert.dedup_key == dedup_key)
        )
        if existing.scalar_one_or_none():
            return None

    alert = SAAlert(
        alert_type=alert_type,
        severity=severity,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        link=link,
        dedup_key=dedup_key,
    )
    session.add(alert)
    await session.flush()
    return alert


async def list_alerts(
    session: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    per_page: int = 20,
    alert_type: Optional[str] = None,
    unread_only: bool = False,
) -> tuple[list[SAAlert], int]:
    muted_result = await session.execute(
        select(SAAlertPreference.alert_type).where(
            SAAlertPreference.user_id == user_id,
            SAAlertPreference.muted.is_(True),
        )
    )
    muted_types = [r[0] for r in muted_result.all()]

    query = select(SAAlert)
    count_query = select(func.count(SAAlert.id))

    if muted_types:
        query = query.where(SAAlert.alert_type.notin_(muted_types))
        count_query = count_query.where(SAAlert.alert_type.notin_(muted_types))
    if alert_type:
        query = query.where(SAAlert.alert_type == alert_type)
        count_query = count_query.where(SAAlert.alert_type == alert_type)
    if unread_only:
        query = query.where(SAAlert.read.is_(False))
        count_query = count_query.where(SAAlert.read.is_(False))

    total = (await session.execute(count_query)).scalar() or 0
    alerts = (
        await session.execute(
            query.order_by(SAAlert.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).scalars().all()

    return list(alerts), total


async def get_unread_count(session: AsyncSession, user_id: uuid.UUID) -> int:
    muted_result = await session.execute(
        select(SAAlertPreference.alert_type).where(
            SAAlertPreference.user_id == user_id,
            SAAlertPreference.muted.is_(True),
        )
    )
    muted_types = [r[0] for r in muted_result.all()]

    query = select(func.count(SAAlert.id)).where(SAAlert.read.is_(False))
    if muted_types:
        query = query.where(SAAlert.alert_type.notin_(muted_types))

    return (await session.execute(query)).scalar() or 0


async def mark_as_read(session: AsyncSession, alert_id: uuid.UUID) -> SAAlert | None:
    result = await session.execute(select(SAAlert).where(SAAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert:
        alert.read = True
        session.add(alert)
        await session.flush()
    return alert


async def mark_all_read(session: AsyncSession) -> int:
    result = await session.execute(
        update(SAAlert).where(SAAlert.read.is_(False)).values(read=True)
    )
    await session.flush()
    return result.rowcount


async def get_preferences(session: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    result = await session.execute(
        select(SAAlertPreference).where(SAAlertPreference.user_id == user_id)
    )
    prefs = {p.alert_type: p.muted for p in result.scalars().all()}

    return [
        {
            "alert_type": atype,
            "label": info["label"],
            "category": info["category"],
            "muted": prefs.get(atype, False),
        }
        for atype, info in SA_ALERT_TYPES.items()
    ]


async def update_preference(
    session: AsyncSession, user_id: uuid.UUID, alert_type: str, muted: bool
) -> None:
    result = await session.execute(
        select(SAAlertPreference).where(
            SAAlertPreference.user_id == user_id,
            SAAlertPreference.alert_type == alert_type,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.muted = muted
        session.add(pref)
    else:
        session.add(SAAlertPreference(user_id=user_id, alert_type=alert_type, muted=muted))
    await session.flush()

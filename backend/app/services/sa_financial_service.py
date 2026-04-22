from __future__ import annotations

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict

from sqlalchemy import func, select, extract, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.institute import Institute, InstituteUsage
from app.models.billing import InstituteBilling, Invoice, Payment
from app.models.activity import ActivityLog
from app.utils.tier_registry import V2_TIERS, TIER_LABELS, is_v2_billing_tier


async def calculate_mrr(session: AsyncSession) -> dict:
    result = await session.execute(
        select(InstituteBilling, Institute)
        .join(Institute, InstituteBilling.institute_id == Institute.id)
        .where(
            Institute.deleted_at.is_(None),
            Institute.status == "active",
            Institute.plan_tier.in_([t.value for t in V2_TIERS]),
        )
    )

    total_mrr = 0
    by_tier: dict[str, int] = {}

    for billing, inst in result.all():
        monthly = billing.base_amount
        if billing.billing_cycle == "quarterly":
            monthly = billing.base_amount // 3
        elif billing.billing_cycle == "yearly":
            monthly = billing.base_amount // 12

        total_mrr += monthly
        tier_key = inst.plan_tier if isinstance(inst.plan_tier, str) else inst.plan_tier.value
        by_tier[tier_key] = by_tier.get(tier_key, 0) + monthly

    trend = await _mrr_trend(session)

    return {"total_mrr": total_mrr, "by_tier": by_tier, "trend": trend}


async def _mrr_trend(session: AsyncSession) -> list[dict]:
    now = datetime.now(timezone.utc)
    trend = []

    for months_ago in range(5, -1, -1):
        month_date = (now.replace(day=1) - timedelta(days=months_ago * 30)).replace(day=1)
        month_str = month_date.strftime("%Y-%m")

        payments_result = await session.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                extract("year", Payment.created_at) == month_date.year,
                extract("month", Payment.created_at) == month_date.month,
                Payment.status == "received",
            )
        )
        amount = payments_result.scalar() or 0
        trend.append({"month": month_str, "mrr": amount})

    return trend


async def calculate_churn(session: AsyncSession, period_days: int = 30) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)

    total_active_result = await session.execute(
        select(func.count(Institute.id)).where(
            Institute.deleted_at.is_(None),
            Institute.status == "active",
        )
    )
    total_active = total_active_result.scalar() or 0

    churned_result = await session.execute(
        select(ActivityLog, Institute)
        .join(Institute, ActivityLog.entity_id == Institute.id)
        .where(
            ActivityLog.action.in_(["institute_suspended", "institute_tier_changed"]),
            ActivityLog.created_at >= cutoff,
        )
        .order_by(ActivityLog.created_at.desc())
    )

    seen_ids: set[str] = set()
    churned: list[dict] = []
    for log, inst in churned_result.all():
        inst_id = str(inst.id)
        if inst_id in seen_ids:
            continue
        seen_ids.add(inst_id)
        churned.append({
            "id": inst_id,
            "name": inst.name,
            "slug": inst.slug,
            "previous_tier": (log.details or {}).get("previous_tier"),
            "event_type": log.action,
            "event_date": log.created_at.isoformat() if log.created_at else None,
        })

    churned_count = len(churned)
    denominator = total_active + churned_count
    churn_rate = (churned_count / denominator * 100) if denominator > 0 else 0

    return {
        "churn_rate_pct": round(churn_rate, 1),
        "churned_count": churned_count,
        "total_active": total_active,
        "churned_institutes": churned,
    }


async def get_at_risk_accounts(session: AsyncSession) -> dict:
    today = date.today()
    cutoff_14d = today - timedelta(days=14)

    overdue_result = await session.execute(
        select(Invoice.institute_id, func.count(Invoice.id).label("overdue_count"))
        .where(Invoice.status == "sent", Invoice.due_date < cutoff_14d)
        .group_by(Invoice.institute_id)
    )
    overdue_map: dict[str, int] = {str(r[0]): r[1] for r in overdue_result.all()}

    quota_result = await session.execute(
        select(Institute, InstituteUsage)
        .join(InstituteUsage, InstituteUsage.institute_id == Institute.id)
        .where(Institute.deleted_at.is_(None), Institute.status == "active")
    )

    at_risk: list[dict] = []
    for inst, usage in quota_result.all():
        reasons: list[str] = []
        score = 0

        inst_id = str(inst.id)
        if inst_id in overdue_map:
            reasons.append(f"{overdue_map[inst_id]} overdue invoice(s) >14 days")
            score += 40 + min(overdue_map[inst_id] * 10, 30)

        if inst.max_users and inst.max_users > 0:
            pct = (usage.current_users / inst.max_users) * 100
            if pct > 90:
                reasons.append(f"User quota at {pct:.0f}%")
                score += 30

        if not reasons:
            continue

        tier_val = inst.plan_tier if isinstance(inst.plan_tier, str) else inst.plan_tier.value
        at_risk.append({
            "id": inst_id,
            "name": inst.name,
            "slug": inst.slug,
            "plan_tier": tier_val,
            "risk_score": min(score, 100),
            "reasons": reasons,
        })

    at_risk.sort(key=lambda x: x["risk_score"], reverse=True)
    return {"accounts": at_risk[:20]}


async def calculate_ltv(session: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)

    result = await session.execute(
        select(Institute, InstituteBilling)
        .join(InstituteBilling, InstituteBilling.institute_id == Institute.id)
        .where(
            Institute.deleted_at.is_(None),
            Institute.plan_tier.in_([t.value for t in V2_TIERS]),
        )
    )

    tier_data: dict[str, list[dict]] = defaultdict(list)
    for inst, billing in result.all():
        monthly = billing.base_amount
        if billing.billing_cycle == "quarterly":
            monthly = billing.base_amount // 3
        elif billing.billing_cycle == "yearly":
            monthly = billing.base_amount // 12

        tenure_months = max(
            (now - inst.created_at).days / 30.0 if inst.created_at else 1, 1
        )
        tier_key = inst.plan_tier if isinstance(inst.plan_tier, str) else inst.plan_tier.value
        tier_data[tier_key].append({"monthly": monthly, "tenure": tenure_months})

    by_tier: list[dict] = []
    for tier, entries in tier_data.items():
        avg_monthly = sum(e["monthly"] for e in entries) // len(entries) if entries else 0
        avg_tenure = sum(e["tenure"] for e in entries) / len(entries) if entries else 0
        by_tier.append({
            "tier": tier,
            "avg_monthly_revenue": avg_monthly,
            "avg_tenure_months": round(avg_tenure, 1),
            "ltv": int(avg_monthly * avg_tenure),
        })

    return {"by_tier": by_tier}


async def revenue_forecast(session: AsyncSession, months: int = 3) -> dict:
    now = datetime.now(timezone.utc)
    monthly_totals: list[int] = []

    for months_ago in range(6, 0, -1):
        month_date = (now.replace(day=1) - timedelta(days=months_ago * 30)).replace(day=1)
        result = await session.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                extract("year", Payment.created_at) == month_date.year,
                extract("month", Payment.created_at) == month_date.month,
                Payment.status == "received",
            )
        )
        monthly_totals.append(result.scalar() or 0)

    non_zero = [t for t in monthly_totals if t > 0]
    avg = sum(non_zero) // len(non_zero) if non_zero else 0

    if len(non_zero) >= 2:
        growth = (non_zero[-1] - non_zero[0]) / max(len(non_zero) - 1, 1)
    else:
        growth = 0

    forecast: list[dict] = []
    for i in range(1, months + 1):
        month_date = (now.replace(day=1) + timedelta(days=i * 31)).replace(day=1)
        projected = max(int(avg + growth * i), 0)
        forecast.append({
            "month": month_date.strftime("%Y-%m"),
            "projected": projected,
        })

    return {"forecast": forecast}

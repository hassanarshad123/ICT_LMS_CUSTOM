"""SA Resource Management — cost tracking, usage trends, and quota alerts."""
import uuid
from datetime import date, datetime, timezone, timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


def _parse_month(month_str: Optional[str]) -> date:
    if not month_str:
        today = datetime.now(timezone.utc).date()
        return today.replace(day=1)
    try:
        return date.fromisoformat(month_str + "-01") if len(month_str) == 7 else date.fromisoformat(month_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM.")


@router.get("/resources/costs/summary")
async def get_cost_summary(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    month: Optional[str] = Query(default=None, description="YYYY-MM"),
):
    from app.services.cost_service import get_monthly_cost_summary
    from app.models.billing import Invoice

    target = _parse_month(month)
    summary = await get_monthly_cost_summary(session, target)

    # Get total revenue for the month from paid invoices
    next_month = (target.replace(day=28) + timedelta(days=4)).replace(day=1)
    rev_r = await session.execute(
        select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
            Invoice.status == "paid",
            Invoice.period_start >= target,
            Invoice.period_start < next_month,
        )
    )
    revenue_pkr = float(rev_r.scalar_one() or 0)

    summary["total_revenue_pkr"] = round(revenue_pkr, 2)
    summary["profit_margin_pkr"] = round(revenue_pkr - summary["total_pkr"], 2)
    summary["profit_margin_pct"] = (
        round((revenue_pkr - summary["total_pkr"]) / revenue_pkr * 100, 1)
        if revenue_pkr > 0 else 0.0
    )
    return summary


@router.get("/resources/costs/by-institute")
async def get_costs_by_institute(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    month: Optional[str] = Query(default=None, description="YYYY-MM"),
):
    from app.services.cost_service import get_institute_cost_breakdown
    from app.models.billing import Invoice
    from app.models.institute import Institute

    target = _parse_month(month)
    items = await get_institute_cost_breakdown(session, target)

    next_month = (target.replace(day=28) + timedelta(days=4)).replace(day=1)

    for item in items:
        iid = uuid.UUID(item["institute_id"])
        rev_r = await session.execute(
            select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
                Invoice.institute_id == iid,
                Invoice.status == "paid",
                Invoice.period_start >= target,
                Invoice.period_start < next_month,
            )
        )
        revenue = float(rev_r.scalar_one() or 0)
        item["revenue_pkr"] = round(revenue, 2)
        item["margin_pkr"] = round(revenue - item["cost_pkr"], 2)
        item["margin_pct"] = (
            round((revenue - item["cost_pkr"]) / revenue * 100, 1)
            if revenue > 0 else 0.0
        )

    return items


@router.post("/resources/costs/manual")
async def submit_manual_cost(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    body: "ManualCostInput",
):
    from app.schemas.sa_resources import ManualCostInput
    from app.services.cost_service import upsert_platform_cost

    cost = await upsert_platform_cost(
        session, body.month, body.service,
        body.amount_usd, body.amount_pkr, source="manual",
    )
    return {"status": "ok", "id": str(cost.id)}


# Fix forward reference
from app.schemas.sa_resources import ManualCostInput
submit_manual_cost.__annotations__["body"] = ManualCostInput


@router.get("/resources/costs/manual")
async def list_manual_costs(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    month: Optional[str] = Query(default=None, description="YYYY-MM"),
):
    from app.models.platform_cost import PlatformCost

    target = _parse_month(month)
    result = await session.execute(
        select(PlatformCost).where(
            PlatformCost.month == target,
        ).order_by(PlatformCost.service)
    )
    costs = result.scalars().all()
    return [
        {
            "id": str(c.id), "month": c.month.isoformat(),
            "service": c.service, "amount_usd": c.amount_usd,
            "amount_pkr": c.amount_pkr, "source": c.source,
        }
        for c in costs
    ]


@router.get("/resources/usage-trends/platform")
async def get_platform_usage_trends(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    days: int = Query(default=30, ge=7, le=365),
):
    from app.models.institute import PlatformSnapshot

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=days)
    result = await session.execute(
        select(PlatformSnapshot).where(
            PlatformSnapshot.snapshot_date >= cutoff,
        ).order_by(PlatformSnapshot.snapshot_date)
    )
    snapshots = result.scalars().all()
    return {
        "institute_id": None,
        "data_points": [
            {
                "date": s.snapshot_date.isoformat(),
                "users": s.total_users,
                "students": s.total_students,
                "storage_gb": round(s.total_storage_bytes / (1024 ** 3), 3),
                "video_gb": round(s.total_video_bytes / (1024 ** 3), 3),
                "courses": s.total_courses,
                "lectures": s.total_lectures,
            }
            for s in snapshots
        ],
    }


@router.get("/resources/usage-trends/{institute_id}")
async def get_institute_usage_trends(
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    days: int = Query(default=30, ge=7, le=365),
):
    from app.models.institute import UsageSnapshot

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=days)
    result = await session.execute(
        select(UsageSnapshot).where(
            UsageSnapshot.institute_id == institute_id,
            UsageSnapshot.snapshot_date >= cutoff,
        ).order_by(UsageSnapshot.snapshot_date)
    )
    snapshots = result.scalars().all()
    return {
        "institute_id": str(institute_id),
        "data_points": [
            {
                "date": s.snapshot_date.isoformat(),
                "users": s.users_count,
                "students": s.students_count,
                "storage_gb": round(s.storage_bytes / (1024 ** 3), 3),
                "video_gb": round(s.video_bytes / (1024 ** 3), 3),
                "courses": s.courses_count,
                "lectures": s.lectures_count,
            }
            for s in snapshots
        ],
    }


@router.get("/resources/alerts")
async def get_quota_alerts(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.institute import Institute, InstituteUsage
    from app.models.enums import UserRole

    result = await session.execute(
        select(Institute, InstituteUsage).outerjoin(
            InstituteUsage, InstituteUsage.institute_id == Institute.id,
        ).where(Institute.deleted_at.is_(None))
    )
    rows = result.all()

    alerts = []
    for inst, usage in rows:
        if not usage:
            continue

        checks = []

        if inst.max_users and inst.max_users > 0:
            checks.append(("users", usage.current_users, inst.max_users))

        if inst.max_students and inst.max_students > 0:
            from sqlmodel import select as _sel
            from app.models.user import User
            sr = await session.execute(
                _sel(func.count(User.id)).where(
                    User.institute_id == inst.id,
                    User.role == UserRole.student,
                    User.deleted_at.is_(None),
                )
            )
            student_count = sr.scalar_one() or 0
            checks.append(("students", student_count, inst.max_students))

        if inst.max_storage_gb and inst.max_storage_gb > 0:
            current_gb = usage.current_storage_bytes / (1024 ** 3)
            checks.append(("storage", round(current_gb, 3), inst.max_storage_gb))

        if inst.max_video_gb and inst.max_video_gb > 0:
            current_gb = usage.current_video_bytes / (1024 ** 3)
            checks.append(("video", round(current_gb, 3), inst.max_video_gb))

        for resource, current, limit in checks:
            pct = (current / limit * 100) if limit > 0 else 0
            if pct >= 80:
                severity = "exceeded" if pct >= 100 else ("critical" if pct >= 90 else "warning")
                alerts.append({
                    "institute_id": str(inst.id),
                    "institute_name": inst.name,
                    "resource": resource,
                    "current": current,
                    "limit": limit,
                    "usage_pct": round(pct, 1),
                    "severity": severity,
                })

    alerts.sort(key=lambda a: -a["usage_pct"])
    return alerts


@router.post("/resources/recalculate")
async def trigger_recalculation(sa: SA):
    """Trigger manual usage recalculation for all institutes."""
    from app.scheduler.jobs import recalculate_all_usage
    await recalculate_all_usage()
    return {"status": "ok", "message": "Usage recalculation completed"}


@router.post("/resources/costs/fetch")
async def fetch_external_costs(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    month: Optional[str] = Query(default=None, description="YYYY-MM"),
):
    """Fetch costs from AWS and Bunny APIs for a given month."""
    from app.services.cost_service import try_fetch_aws_costs, try_fetch_bunny_costs, calculate_cost_attribution

    target = _parse_month(month)
    results = {
        "aws": await try_fetch_aws_costs(session, target),
        "bunny": await try_fetch_bunny_costs(session, target),
    }
    attribution_count = await calculate_cost_attribution(session, target)
    results["attributions_calculated"] = attribution_count
    return results

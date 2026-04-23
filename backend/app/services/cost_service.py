"""Platform cost tracking and per-institute cost attribution."""
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.institute import Institute, InstituteUsage, UsageSnapshot
from app.models.platform_cost import PlatformCost, InstituteCostAttribution

logger = logging.getLogger(__name__)

SERVICES = ("s3", "rds", "ec2", "bunny", "redis", "vercel", "zoom", "other")

# Attribution method per service
_STORAGE_WEIGHTED = {"s3"}
_VIDEO_WEIGHTED = {"bunny"}
_USER_WEIGHTED = {"rds", "ec2"}
_EQUAL_SPLIT = {"redis", "vercel"}
_ZOOM_WEIGHTED = {"zoom"}


async def upsert_platform_cost(
    session: AsyncSession,
    month: date,
    service: str,
    amount_usd: float,
    amount_pkr: float,
    source: str = "manual",
    raw_data: Optional[dict] = None,
) -> PlatformCost:
    stmt = pg_insert(PlatformCost).values(
        id=uuid.uuid4(),
        month=month,
        service=service,
        amount_usd=amount_usd,
        amount_pkr=amount_pkr,
        source=source,
        raw_data=raw_data,
        updated_at=datetime.now(timezone.utc),
    ).on_conflict_do_update(
        constraint="uq_platform_cost_month_service",
        set_={
            "amount_usd": amount_usd,
            "amount_pkr": amount_pkr,
            "source": source,
            "raw_data": raw_data,
            "updated_at": datetime.now(timezone.utc),
        },
    )
    await session.execute(stmt)
    await session.commit()

    result = await session.execute(
        select(PlatformCost).where(
            PlatformCost.month == month, PlatformCost.service == service,
        )
    )
    return result.scalar_one()


async def get_costs_for_month(
    session: AsyncSession, month: date,
) -> list[PlatformCost]:
    result = await session.execute(
        select(PlatformCost).where(PlatformCost.month == month).order_by(PlatformCost.service)
    )
    return list(result.scalars().all())


async def get_monthly_cost_summary(
    session: AsyncSession, month: date,
) -> dict:
    costs = await get_costs_for_month(session, month)
    total_usd = sum(c.amount_usd for c in costs)
    total_pkr = sum(c.amount_pkr for c in costs)
    by_service = [
        {
            "service": c.service,
            "amount_usd": round(c.amount_usd, 2),
            "amount_pkr": round(c.amount_pkr, 2),
            "source": c.source,
        }
        for c in costs
    ]
    return {
        "month": month.isoformat(),
        "total_usd": round(total_usd, 2),
        "total_pkr": round(total_pkr, 2),
        "by_service": by_service,
    }


async def calculate_cost_attribution(
    session: AsyncSession, month: date,
) -> int:
    """Calculate per-institute cost attribution for a given month.

    Uses usage data to proportionally split each service's cost.
    Returns the number of attribution rows created/updated.
    """
    costs = await get_costs_for_month(session, month)
    if not costs:
        return 0

    # Get all active institutes with usage
    inst_result = await session.execute(
        select(Institute.id).where(Institute.deleted_at.is_(None))
    )
    institute_ids = [row[0] for row in inst_result.all()]
    if not institute_ids:
        return 0

    # Gather usage metrics for each institute
    usage_map: dict[uuid.UUID, dict] = {}
    for iid in institute_ids:
        usage_r = await session.execute(
            select(InstituteUsage).where(InstituteUsage.institute_id == iid)
        )
        usage = usage_r.scalar_one_or_none()
        if not usage:
            usage_map[iid] = {"storage": 0, "video": 0, "users": 0, "zoom_minutes": 0}
            continue

        # Get zoom minutes from latest snapshot for this month
        snap_r = await session.execute(
            select(UsageSnapshot.zoom_total_minutes).where(
                UsageSnapshot.institute_id == iid,
                UsageSnapshot.snapshot_date >= month,
            ).order_by(UsageSnapshot.snapshot_date.desc()).limit(1)
        )
        zoom_minutes = (snap_r.scalar_one_or_none() or 0)

        usage_map[iid] = {
            "storage": usage.current_storage_bytes,
            "video": usage.current_video_bytes,
            "users": usage.current_users,
            "zoom_minutes": zoom_minutes,
        }

    # Compute totals
    total_storage = sum(u["storage"] for u in usage_map.values()) or 1
    total_video = sum(u["video"] for u in usage_map.values()) or 1
    total_users = sum(u["users"] for u in usage_map.values()) or 1
    total_zoom = sum(u["zoom_minutes"] for u in usage_map.values()) or 1
    active_count = len(institute_ids) or 1

    count = 0
    for cost in costs:
        for iid in institute_ids:
            u = usage_map[iid]

            if cost.service in _STORAGE_WEIGHTED:
                ratio = u["storage"] / total_storage
            elif cost.service in _VIDEO_WEIGHTED:
                ratio = u["video"] / total_video
            elif cost.service in _USER_WEIGHTED:
                ratio = u["users"] / total_users
            elif cost.service in _ZOOM_WEIGHTED:
                ratio = u["zoom_minutes"] / total_zoom
            else:
                ratio = 1.0 / active_count

            stmt = pg_insert(InstituteCostAttribution).values(
                id=uuid.uuid4(),
                institute_id=iid,
                month=month,
                service=cost.service,
                amount_usd=round(cost.amount_usd * ratio, 4),
                amount_pkr=round(cost.amount_pkr * ratio, 4),
                usage_ratio=round(ratio, 6),
            ).on_conflict_do_update(
                constraint="uq_cost_attr_inst_month_svc",
                set_={
                    "amount_usd": round(cost.amount_usd * ratio, 4),
                    "amount_pkr": round(cost.amount_pkr * ratio, 4),
                    "usage_ratio": round(ratio, 6),
                },
            )
            await session.execute(stmt)
            count += 1

    await session.commit()
    logger.info(
        "Cost attribution for %s: %d rows across %d institutes",
        month.isoformat(), count, len(institute_ids),
    )
    return count


async def get_institute_cost_breakdown(
    session: AsyncSession, month: date, institute_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """Get cost breakdown for one or all institutes."""
    stmt = select(
        InstituteCostAttribution.institute_id,
        Institute.name,
        Institute.plan_tier,
        func.sum(InstituteCostAttribution.amount_usd).label("total_usd"),
        func.sum(InstituteCostAttribution.amount_pkr).label("total_pkr"),
    ).join(
        Institute, Institute.id == InstituteCostAttribution.institute_id,
    ).where(
        InstituteCostAttribution.month == month,
    ).group_by(
        InstituteCostAttribution.institute_id, Institute.name, Institute.plan_tier,
    ).order_by(func.sum(InstituteCostAttribution.amount_pkr).desc())

    if institute_id:
        stmt = stmt.where(InstituteCostAttribution.institute_id == institute_id)

    result = await session.execute(stmt)
    rows = result.all()

    items = []
    for row in rows:
        # Get per-service detail
        detail_r = await session.execute(
            select(InstituteCostAttribution).where(
                InstituteCostAttribution.institute_id == row[0],
                InstituteCostAttribution.month == month,
            )
        )
        by_service = [
            {
                "service": a.service,
                "amount_usd": round(a.amount_usd, 2),
                "amount_pkr": round(a.amount_pkr, 2),
                "usage_ratio": round(a.usage_ratio, 4),
            }
            for a in detail_r.scalars().all()
        ]

        items.append({
            "institute_id": str(row[0]),
            "institute_name": row[1],
            "plan_tier": row[2].value if hasattr(row[2], "value") else str(row[2]),
            "cost_usd": round(row[3] or 0, 2),
            "cost_pkr": round(row[4] or 0, 2),
            "by_service": by_service,
        })

    return items


async def try_fetch_aws_costs(session: AsyncSession, month: date) -> bool:
    """Attempt to fetch AWS costs via Cost Explorer API.

    Returns True if costs were fetched and saved. Requires boto3 and
    appropriate IAM permissions (ce:GetCostAndUsage).
    """
    try:
        import boto3
    except ImportError:
        logger.info("boto3 not available — skipping AWS cost fetch")
        return False

    from app.config import get_settings
    settings = get_settings()
    if not settings.AWS_ACCESS_KEY_ID:
        logger.info("AWS credentials not configured — skipping cost fetch")
        return False

    try:
        client = boto3.client(
            "ce",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

        # First day of target month → first day of next month
        start = month.replace(day=1)
        if month.month == 12:
            end = month.replace(year=month.year + 1, month=1, day=1)
        else:
            end = month.replace(month=month.month + 1, day=1)

        response = client.get_cost_and_usage(
            TimePeriod={"Start": start.isoformat(), "End": end.isoformat()},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

        service_map = {
            "Amazon Simple Storage Service": "s3",
            "Amazon Relational Database Service": "rds",
            "Amazon Elastic Compute Cloud - Compute": "ec2",
            "Amazon ElastiCache": "redis",
        }

        for group in response.get("ResultsByTime", [{}])[0].get("Groups", []):
            aws_service = group["Keys"][0]
            mapped = service_map.get(aws_service)
            if not mapped:
                continue
            amount_usd = float(group["Metrics"]["UnblendedCost"]["Amount"])
            await upsert_platform_cost(
                session, month, mapped, amount_usd,
                amount_pkr=round(amount_usd * 280, 2),
                source="api",
                raw_data={"aws_service": aws_service, "raw": group},
            )

        logger.info("Fetched AWS costs for %s", month.isoformat())
        return True
    except Exception as e:
        logger.error("AWS cost fetch failed for %s: %s", month.isoformat(), e)
        return False


async def try_fetch_bunny_costs(session: AsyncSession, month: date) -> bool:
    """Attempt to fetch Bunny.net storage/bandwidth stats.

    Bunny Stream library API provides storage used; bandwidth stats need
    the account-level API key. Falls back gracefully if not available.
    """
    from app.config import get_settings
    import httpx

    settings = get_settings()
    if not settings.BUNNY_API_KEY or not settings.BUNNY_LIBRARY_ID:
        return False

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://video.bunnycdn.com/library/{settings.BUNNY_LIBRARY_ID}",
                headers={"AccessKey": settings.BUNNY_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
            storage_bytes = data.get("StorageUsage", 0)
            traffic_bytes = data.get("TrafficUsage", 0)

            # Bunny pricing: ~$0.01/GB storage, ~$0.01/GB bandwidth (approximate)
            storage_gb = storage_bytes / (1024 ** 3)
            traffic_gb = traffic_bytes / (1024 ** 3)
            estimated_usd = round(storage_gb * 0.01 + traffic_gb * 0.01, 2)

            await upsert_platform_cost(
                session, month, "bunny", estimated_usd,
                amount_pkr=round(estimated_usd * 280, 2),
                source="api",
                raw_data={
                    "storage_bytes": storage_bytes,
                    "traffic_bytes": traffic_bytes,
                    "storage_gb": round(storage_gb, 2),
                    "traffic_gb": round(traffic_gb, 2),
                },
            )
            logger.info("Fetched Bunny costs for %s", month.isoformat())
            return True
    except Exception as e:
        logger.error("Bunny cost fetch failed: %s", e)
        return False

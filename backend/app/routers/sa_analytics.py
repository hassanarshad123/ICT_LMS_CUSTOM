from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.schemas.sa_analytics import (
    PlatformOverview,
    GrowthTrendResponse,
    PlanDistributionResponse,
    TopInstituteItem,
    QuotaUtilizationItem,
)
from app.services import sa_analytics_service

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


@router.get("/overview", response_model=PlatformOverview)
async def get_overview(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: int = Query(default=30, ge=7, le=365),
):
    data = await sa_analytics_service.get_platform_overview(session, period)
    return PlatformOverview(**data)


@router.get("/growth-trends", response_model=GrowthTrendResponse)
async def get_growth_trends(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: int = Query(default=30, ge=7, le=365),
):
    data = await sa_analytics_service.get_growth_trends(session, period)
    return GrowthTrendResponse(**data)


@router.get("/plan-distribution", response_model=PlanDistributionResponse)
async def get_plan_distribution(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_analytics_service.get_plan_distribution(session)
    return PlanDistributionResponse(**data)


@router.get("/top-institutes", response_model=list[TopInstituteItem])
async def get_top_institutes(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    metric: str = Query(default="users", pattern="^(users|storage|video|courses|certificates)$"),
    limit: int = Query(default=5, ge=1, le=20),
):
    data = await sa_analytics_service.get_top_institutes(session, metric, limit)
    return [TopInstituteItem(**item) for item in data]


@router.get("/quota-utilization", response_model=list[QuotaUtilizationItem])
async def get_quota_utilization(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_analytics_service.get_quota_utilization(session)
    return [QuotaUtilizationItem(**item) for item in data]

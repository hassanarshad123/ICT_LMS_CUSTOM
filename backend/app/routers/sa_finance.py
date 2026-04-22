from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.schemas.sa_finance import (
    MRRResponse,
    ChurnResponse,
    AtRiskResponse,
    LTVResponse,
    ForecastResponse,
)
from app.services import sa_financial_service

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


@router.get("/finance/mrr", response_model=MRRResponse)
async def get_mrr(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await sa_financial_service.calculate_mrr(session)


@router.get("/finance/churn", response_model=ChurnResponse)
async def get_churn(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: int = Query(30, ge=7, le=365),
):
    return await sa_financial_service.calculate_churn(session, period)


@router.get("/finance/at-risk", response_model=AtRiskResponse)
async def get_at_risk(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await sa_financial_service.get_at_risk_accounts(session)


@router.get("/finance/ltv", response_model=LTVResponse)
async def get_ltv(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await sa_financial_service.calculate_ltv(session)


@router.get("/finance/forecast", response_model=ForecastResponse)
async def get_forecast(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    months: int = Query(3, ge=1, le=12),
):
    return await sa_financial_service.revenue_forecast(session, months)

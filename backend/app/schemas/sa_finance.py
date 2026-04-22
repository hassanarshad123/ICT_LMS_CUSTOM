from pydantic import BaseModel


class MRRTrend(BaseModel):
    month: str
    mrr: int


class MRRResponse(BaseModel):
    total_mrr: int
    by_tier: dict[str, int]
    trend: list[MRRTrend]


class ChurnedInstitute(BaseModel):
    id: str
    name: str
    slug: str
    previous_tier: str | None = None
    event_type: str
    event_date: str | None = None


class ChurnResponse(BaseModel):
    churn_rate_pct: float
    churned_count: int
    total_active: int
    churned_institutes: list[ChurnedInstitute]


class AtRiskItem(BaseModel):
    id: str
    name: str
    slug: str
    plan_tier: str
    risk_score: int
    reasons: list[str]


class AtRiskResponse(BaseModel):
    accounts: list[AtRiskItem]


class LTVItem(BaseModel):
    tier: str
    avg_monthly_revenue: int
    avg_tenure_months: float
    ltv: int


class LTVResponse(BaseModel):
    by_tier: list[LTVItem]


class ForecastPoint(BaseModel):
    month: str
    projected: int


class ForecastResponse(BaseModel):
    forecast: list[ForecastPoint]

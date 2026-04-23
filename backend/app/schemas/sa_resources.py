import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class ServiceCost(BaseModel):
    service: str
    amount_usd: float
    amount_pkr: float
    source: Optional[str] = None
    usage_ratio: Optional[float] = None


class PlatformCostSummary(BaseModel):
    month: str
    total_usd: float
    total_pkr: float
    by_service: list[ServiceCost]
    total_revenue_pkr: float = 0.0
    profit_margin_pkr: float = 0.0
    profit_margin_pct: float = 0.0


class InstituteCostBreakdown(BaseModel):
    institute_id: str
    institute_name: str
    plan_tier: str
    revenue_pkr: float = 0.0
    cost_usd: float = 0.0
    cost_pkr: float = 0.0
    margin_pkr: float = 0.0
    margin_pct: float = 0.0
    by_service: list[ServiceCost] = []


class UsageTrendPoint(BaseModel):
    date: str
    users: int = 0
    students: int = 0
    storage_gb: float = 0.0
    video_gb: float = 0.0
    courses: int = 0
    lectures: int = 0


class UsageTrend(BaseModel):
    institute_id: Optional[str] = None
    data_points: list[UsageTrendPoint]


class QuotaAlert(BaseModel):
    institute_id: str
    institute_name: str
    resource: str
    current: float
    limit: float
    usage_pct: float
    severity: str


class ManualCostInput(BaseModel):
    service: str = Field(..., pattern="^(s3|rds|ec2|bunny|redis|vercel|zoom|other)$")
    month: date
    amount_usd: float = Field(..., ge=0)
    amount_pkr: float = Field(..., ge=0)


class ManualCostOut(BaseModel):
    id: str
    month: str
    service: str
    amount_usd: float
    amount_pkr: float
    source: str

    class Config:
        from_attributes = True

from typing import Optional
from pydantic import BaseModel


class TrendPoint(BaseModel):
    date: str
    count: int


class PlatformOverview(BaseModel):
    total_users: int
    total_users_prev: int
    total_courses: int
    total_courses_prev: int
    total_batches: int
    total_batches_prev: int
    total_certificates: int
    total_certificates_prev: int
    total_lectures: int
    total_storage_gb: float
    total_video_gb: float
    total_institutes: int
    active_institutes: int
    suspended_institutes: int
    trial_institutes: int


class GrowthTrendResponse(BaseModel):
    new_users: list[TrendPoint]
    new_institutes: list[TrendPoint]


class PlanDistributionResponse(BaseModel):
    free: int = 0
    basic: int = 0
    pro: int = 0
    enterprise: int = 0


class TopInstituteItem(BaseModel):
    institute_id: str
    name: str
    slug: str
    plan_tier: str
    value: float


class QuotaUtilizationItem(BaseModel):
    institute_id: str
    name: str
    slug: str
    users_used_pct: float
    storage_used_pct: float
    video_used_pct: float
    highest_pct: float

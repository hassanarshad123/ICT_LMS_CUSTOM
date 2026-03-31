import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SAErrorLogOut(BaseModel):
    id: uuid.UUID
    level: str
    message: str
    traceback: Optional[str] = None
    request_id: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    status_code: Optional[int] = None
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    source: str
    resolved: bool
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[uuid.UUID] = None
    extra: Optional[dict] = None
    institute_id: Optional[uuid.UUID] = None
    institute_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ErrorByInstitute(BaseModel):
    institute_id: str
    name: str
    count: int


class ErrorTrendPoint(BaseModel):
    date: str
    critical: int
    error: int
    warning: int
    total: int


class CrossInstituteErrorStats(BaseModel):
    total_errors_24h: int
    unresolved_count: int
    error_trend: list[ErrorTrendPoint]
    top_error_institutes: list[ErrorByInstitute]
    errors_by_source: dict[str, int]
    errors_by_level: dict[str, int]


class JobStatusItem(BaseModel):
    name: str
    description: str
    frequency: str
    status: str


class VideoPipelineStatus(BaseModel):
    pending: int
    processing: int
    ready: int
    failed: int


class WebhookStatsItem(BaseModel):
    institute_id: str
    institute_name: str
    total_24h: int
    failed_24h: int


class WebhookDeliveryStats(BaseModel):
    total_24h: int
    success_24h: int
    failed_24h: int
    pending: int
    by_institute: list[WebhookStatsItem]


class SystemHealthResponse(BaseModel):
    db_status: str
    db_latency_ms: float
    redis_status: str
    redis_memory_mb: float
    redis_hit_rate: float
    redis_total_keys: int
    jobs: list[JobStatusItem]
    video_pipeline: VideoPipelineStatus
    webhook_stats: WebhookDeliveryStats

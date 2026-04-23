import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ErrorLogOut(BaseModel):
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
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ErrorsByHourOut(BaseModel):
    hour: str
    count: int


class TopPathOut(BaseModel):
    path: str
    count: int


class ErrorStatsResponse(BaseModel):
    total_errors_24h: int
    unresolved_count: int
    errors_by_hour: list[ErrorsByHourOut]
    top_paths: list[TopPathOut]
    errors_by_source: dict[str, int]
    errors_by_level: dict[str, int]


class ClientErrorReport(BaseModel):
    message: str
    stack: Optional[str] = None
    url: Optional[str] = None
    component: Optional[str] = None
    extra: Optional[dict] = None


class ResolveRequest(BaseModel):
    resolved: bool = True
    notes: Optional[str] = None

from typing import Generic, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    total: int
    page: int
    per_page: int
    total_pages: int


class ErrorResponse(BaseModel):
    detail: str


class MessageResponse(BaseModel):
    detail: str


class StatusResponse(BaseModel):
    status: str


class CountResponse(BaseModel):
    count: int


class DownloadResponse(BaseModel):
    download_url: str


class UploadResponse(BaseModel):
    url: str


class CacheStatsResponse(BaseModel):
    redis_connected: bool
    memory_used_mb: float = 0.0
    memory_max_mb: float = 0.0
    connected_clients: int = 0
    total_keys: int = 0
    hits: int = 0
    misses: int = 0
    hit_rate_percent: float = 0.0
    evictions: int = 0
    message: Optional[str] = None
    error: Optional[str] = None

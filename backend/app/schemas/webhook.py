import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class WebhookCreate(BaseModel):
    url: str
    events: list[str]
    description: Optional[str] = None

    @field_validator("url")
    @classmethod
    def url_must_be_https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Webhook URL must start with https://")
        return v


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    events: Optional[list[str]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("url")
    @classmethod
    def url_must_be_https(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith("https://"):
            raise ValueError("Webhook URL must start with https://")
        return v


class WebhookOut(BaseModel):
    id: uuid.UUID
    url: str
    description: Optional[str] = None
    events: list[str]
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WebhookTestResult(BaseModel):
    success: bool
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    delivery_id: uuid.UUID


class WebhookDeliveryOut(BaseModel):
    id: uuid.UUID
    event_type: str
    status: str
    status_code: Optional[int] = None
    attempt_count: int
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

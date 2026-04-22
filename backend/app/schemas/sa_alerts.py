import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SAAlertOut(BaseModel):
    id: uuid.UUID
    alert_type: str
    severity: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    link: Optional[str] = None
    read: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SAAlertCountResponse(BaseModel):
    count: int


class SAAlertPreferenceOut(BaseModel):
    alert_type: str
    label: str
    category: str
    muted: bool


class SAAlertPreferenceUpdate(BaseModel):
    muted: bool

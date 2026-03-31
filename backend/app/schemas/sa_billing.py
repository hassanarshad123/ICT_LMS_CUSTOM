import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class BillingConfigOut(BaseModel):
    institute_id: uuid.UUID
    institute_name: str
    base_amount: int
    currency: str
    billing_cycle: str
    extra_user_rate: int
    extra_storage_rate: int
    extra_video_rate: int
    notes: Optional[str] = None


class BillingConfigUpdate(BaseModel):
    base_amount: Optional[int] = None
    billing_cycle: Optional[str] = None
    extra_user_rate: Optional[int] = None
    extra_storage_rate: Optional[int] = None
    extra_video_rate: Optional[int] = None
    notes: Optional[str] = None


class InvoiceLineItem(BaseModel):
    description: str
    quantity: float
    unit_price: int
    amount: int


class InvoiceGenerateRequest(BaseModel):
    institute_id: uuid.UUID
    period_start: date
    period_end: date
    due_date: date


class InvoiceOut(BaseModel):
    id: uuid.UUID
    institute_id: uuid.UUID
    institute_name: Optional[str] = None
    invoice_number: str
    period_start: date
    period_end: date
    base_amount: int
    line_items: list[dict]
    total_amount: int
    status: str
    due_date: date
    generated_by: uuid.UUID
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InvoiceStatusUpdate(BaseModel):
    status: str


class PaymentRecordRequest(BaseModel):
    institute_id: uuid.UUID
    amount: int
    payment_date: datetime
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    invoice_id: Optional[uuid.UUID] = None


class PaymentOut(BaseModel):
    id: uuid.UUID
    institute_id: uuid.UUID
    institute_name: Optional[str] = None
    invoice_id: Optional[uuid.UUID] = None
    amount: int
    payment_date: Optional[datetime] = None
    payment_method: str
    status: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    recorded_by: uuid.UUID
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RevenueDashboard(BaseModel):
    total_collected: int
    total_outstanding: int
    revenue_by_plan: dict[str, int]
    monthly_trend: list[dict]


class SAAnnouncementCreate(BaseModel):
    title: str
    message: str
    target_institute_ids: list[uuid.UUID] = []


class SAAnnouncementOut(BaseModel):
    id: uuid.UUID
    title: str
    message: str
    target_institute_ids: list
    sent_by: uuid.UUID
    sent_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    delivery_count: int = 0

    model_config = {"from_attributes": True}

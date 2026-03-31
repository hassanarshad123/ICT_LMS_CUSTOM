import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, Integer, String, Date
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP, JSONB, ARRAY


class BillingCycle(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class PaymentMethod(str, enum.Enum):
    bank_transfer = "bank_transfer"
    cheque = "cheque"
    cash = "cash"
    online = "online"


class PaymentStatus(str, enum.Enum):
    received = "received"
    verified = "verified"
    reversed = "reversed"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class InstituteBilling(SQLModel, table=True):
    __tablename__ = "institute_billing"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, unique=True)
    )
    base_amount: int = Field(default=0)
    currency: str = Field(default="PKR")
    billing_cycle: str = Field(default="monthly")
    extra_user_rate: int = Field(default=0)
    extra_storage_rate: int = Field(default=0)
    extra_video_rate: int = Field(default=0)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )
    updated_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )


class Invoice(SQLModel, table=True):
    __tablename__ = "invoices"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    invoice_number: str = Field(sa_column=Column(String(20), nullable=False, unique=True))
    period_start: date = Field(sa_column=Column(Date, nullable=False))
    period_end: date = Field(sa_column=Column(Date, nullable=False))
    base_amount: int = Field(default=0)
    line_items: list = Field(default=[], sa_column=Column(JSONB, nullable=False, server_default="[]"))
    total_amount: int = Field(default=0)
    status: str = Field(default="draft")
    discount_type: Optional[str] = Field(default=None)
    discount_value: Optional[int] = Field(default=None)
    discount_amount: Optional[int] = Field(default=None)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    pdf_path: Optional[str] = Field(default=None)
    due_date: date = Field(sa_column=Column(Date, nullable=False))
    generated_by: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    created_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )
    updated_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )


class Payment(SQLModel, table=True):
    __tablename__ = "payments"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    invoice_id: Optional[uuid.UUID] = Field(
        default=None, sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    amount: int = Field(default=0)
    payment_date: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False)
    )
    payment_method: str = Field(default="bank_transfer")
    status: str = Field(default="received")
    reference_number: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    recorded_by: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    created_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )
    updated_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )


class SANotification(SQLModel, table=True):
    __tablename__ = "sa_notifications"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str
    message: str = Field(sa_column=Column(Text, nullable=False))
    target_institute_ids: list = Field(
        default=[], sa_column=Column(ARRAY(PG_UUID(as_uuid=True)), nullable=False, server_default="{}")
    )
    sent_by: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    created_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )


class InvoiceCounter(SQLModel, table=True):
    __tablename__ = "invoice_counter"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    current_year: int
    last_sequence: int = Field(default=0)

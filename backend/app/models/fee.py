"""Student fee plans, installments, and payments for the Admissions Officer portal.

Each StudentBatch enrollment can have at most one active FeePlan. The plan holds
the top-level amount + discount and lifecycle status. Each FeeInstallment is a
dated demand for money; FeePayment is an actual money-received event linked to
one installment (and also to the plan for faster aggregation).
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, Integer, String, Date, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP


class FeePlan(SQLModel, table=True):
    __tablename__ = "fee_plans"
    __table_args__ = (
        Index("ix_fee_plans_student_batch_id", "student_batch_id"),
        Index("ix_fee_plans_student_id", "student_id"),
        Index("ix_fee_plans_onboarded_by", "onboarded_by_user_id"),
        Index("ix_fee_plans_institute_id", "institute_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    student_batch_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("student_batches.id"), nullable=False)
    )
    student_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    )
    batch_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False)
    )
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False)
    )

    plan_type: str = Field(sa_column=Column(String(20), nullable=False))
    total_amount: int = Field(default=0, nullable=False)
    discount_type: Optional[str] = Field(default=None, sa_column=Column(String(10), nullable=True))
    discount_value: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True))
    final_amount: int = Field(default=0, nullable=False)
    currency: str = Field(default="PKR", sa_column=Column(String(8), nullable=False, server_default="PKR"))

    billing_day_of_month: Optional[int] = Field(
        default=None, sa_column=Column(Integer, nullable=True),
    )

    onboarded_by_user_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    )
    status: str = Field(default="active", sa_column=Column(String(20), nullable=False, server_default="active"))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    created_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )
    updated_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )
    deleted_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
    )


class FeeInstallment(SQLModel, table=True):
    __tablename__ = "fee_installments"
    __table_args__ = (
        Index("ix_fee_installments_plan_id", "fee_plan_id"),
        Index("ix_fee_installments_due_date", "due_date"),
        Index("ix_fee_installments_status_due", "status", "due_date"),
        Index("ix_fee_installments_institute_id", "institute_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    fee_plan_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("fee_plans.id"), nullable=False)
    )
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False)
    )

    sequence: int = Field(nullable=False)
    amount_due: int = Field(default=0, nullable=False)
    amount_paid: int = Field(default=0, nullable=False)
    due_date: date = Field(sa_column=Column(Date, nullable=False))
    status: str = Field(default="pending", sa_column=Column(String(20), nullable=False, server_default="pending"))
    label: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True))

    created_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )
    updated_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )


class FeePayment(SQLModel, table=True):
    __tablename__ = "fee_payments"
    __table_args__ = (
        Index("ix_fee_payments_plan_id", "fee_plan_id"),
        Index("ix_fee_payments_installment_id", "fee_installment_id"),
        Index("ix_fee_payments_institute_date", "institute_id", "payment_date"),
        Index("ix_fee_payments_recorded_by", "recorded_by_user_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    fee_plan_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("fee_plans.id"), nullable=False)
    )
    fee_installment_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("fee_installments.id"), nullable=True),
    )
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False)
    )

    amount: int = Field(default=0, nullable=False)
    payment_date: datetime = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False)
    )
    payment_method: str = Field(
        default="cash", sa_column=Column(String(20), nullable=False, server_default="cash")
    )
    status: str = Field(
        default="received", sa_column=Column(String(20), nullable=False, server_default="received")
    )
    reference_number: Optional[str] = Field(
        default=None, sa_column=Column(String(100), nullable=True)
    )
    receipt_number: Optional[str] = Field(
        default=None, sa_column=Column(String(40), nullable=True, unique=True)
    )
    recorded_by_user_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    )
    notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    created_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )
    updated_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )


class ReceiptCounter(SQLModel, table=True):
    """Per-institute sequential receipt numbering.

    Mirrors ``invoice_counter`` but scoped to receipts for student payments.
    """
    __tablename__ = "receipt_counter"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, unique=True)
    )
    current_year: int = Field(nullable=False)
    last_sequence: int = Field(default=0, nullable=False)
    updated_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )

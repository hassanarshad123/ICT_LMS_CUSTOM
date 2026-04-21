"""Pydantic schemas for the Admissions Officer fee lifecycle.

Kept deliberately simple: API uses kebab-case enum values while storage uses
snake_case. Conversion handled via the shared ``transformers`` utility at
router boundaries.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class InstallmentDraft(BaseModel):
    """Single installment supplied by the officer at enrollment time."""
    sequence: int = Field(ge=1)
    amount_due: int = Field(ge=0)
    due_date: date
    label: Optional[str] = None


class FeePlanCreate(BaseModel):
    plan_type: str
    total_amount: int = Field(ge=0)
    discount_type: Optional[str] = None
    discount_value: Optional[int] = Field(default=None, ge=0)
    currency: str = "PKR"

    billing_day_of_month: Optional[int] = Field(default=None, ge=1, le=28)
    monthly_installments: Optional[int] = Field(default=None, ge=1, le=60)
    first_due_date: Optional[date] = None
    installments: Optional[list[InstallmentDraft]] = None
    notes: Optional[str] = None

    # Optional Frappe linkage -- when provided, the onboarding sync posts a
    # Sales Order to the institute ERP with these as Item code and Payment Terms.
    frappe_item_code: Optional[str] = Field(default=None, max_length=140)
    frappe_payment_terms_template: Optional[str] = Field(default=None, max_length=140)

    @field_validator("plan_type")
    @classmethod
    def _validate_plan_type(cls, v: str) -> str:
        allowed = {"one-time", "monthly", "installment", "one_time"}
        if v not in allowed:
            raise ValueError(f"plan_type must be one of {sorted(allowed)}")
        # Normalise kebab-case and legacy one_time
        return v.replace("-", "_")

    @field_validator("discount_type")
    @classmethod
    def _validate_discount_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v not in ("percent", "flat"):
            raise ValueError("discount_type must be 'percent' or 'flat'")
        return v


class InstallmentOut(BaseModel):
    id: uuid.UUID
    sequence: int
    amount_due: int
    amount_paid: int
    due_date: date
    status: str
    label: Optional[str] = None


class FeePlanOut(BaseModel):
    id: uuid.UUID
    student_batch_id: uuid.UUID
    student_id: uuid.UUID
    batch_id: uuid.UUID

    plan_type: str
    total_amount: int
    discount_type: Optional[str] = None
    discount_value: Optional[int] = None
    final_amount: int
    currency: str
    billing_day_of_month: Optional[int] = None

    onboarded_by_user_id: uuid.UUID
    status: str
    notes: Optional[str] = None
    created_at: datetime

    installments: list[InstallmentOut] = []
    amount_paid: int = 0
    balance_due: int = 0
    next_due_date: Optional[date] = None
    is_overdue: bool = False
    erp_si_status: Optional[str] = None
    frappe_sales_invoice_name: Optional[str] = None


class PaymentCreate(BaseModel):
    fee_installment_id: Optional[uuid.UUID] = None
    amount: int = Field(ge=1)
    payment_date: datetime
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    # S3 object key from POST /admissions/payment-proof/upload — persisted on
    # the FeePayment row so the Frappe sync can regenerate a signed view URL
    # for the Sales Order's custom_zensbot_payment_proof_url field.
    payment_proof_object_key: Optional[str] = Field(default=None, max_length=1024)

    @field_validator("payment_method")
    @classmethod
    def _validate_method(cls, v: str) -> str:
        allowed = {"bank_transfer", "jazzcash", "easypaisa", "cheque", "cash", "online"}
        # Accept kebab-case from API side
        normalized = v.replace("-", "_")
        if normalized not in allowed:
            raise ValueError(f"payment_method must be one of {sorted(allowed)}")
        return normalized


class OnboardStudentRequest(BaseModel):
    """All the data an admissions officer collects to onboard a paying student."""
    # Student identity
    name: str
    email: str
    phone: Optional[str] = None

    # Enrollment target
    batch_id: uuid.UUID

    # Fee plan
    fee_plan: FeePlanCreate

    # Optional notes stored on the fee plan
    notes: Optional[str] = None

    # Optional initial payment recorded at onboarding time (bank transfer
    # screenshot, cash slip, etc.). The object_key must have been returned
    # by POST /admissions/payment-proof/upload-url and the file uploaded.
    payment_proof_object_key: Optional[str] = Field(default=None, max_length=1024)
    initial_payment_amount: Optional[int] = Field(default=None, ge=0)


class StudentUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class AddEnrollmentRequest(BaseModel):
    batch_id: uuid.UUID
    fee_plan: FeePlanCreate
    notes: Optional[str] = None
    payment_proof_object_key: Optional[str] = Field(default=None, max_length=1024)
    initial_payment_amount: Optional[int] = Field(default=None, ge=0)


class OnboardStudentResponse(BaseModel):
    user_id: uuid.UUID
    student_batch_id: uuid.UUID
    fee_plan_id: uuid.UUID
    # Empty string when the onboarded email matched an existing student — no
    # new credentials are generated, we simply enrolled them in the new batch.
    temporary_password: str
    email: str
    final_amount: int
    currency: str
    installment_count: int
    # False when onboarding reused an existing student account.
    is_new_user: bool = True


class AdmissionsStudentListItem(BaseModel):
    """Row shown in the officer's student roster."""
    user_id: uuid.UUID
    name: str
    email: str
    phone: Optional[str] = None
    status: str
    batch_id: uuid.UUID
    batch_name: str
    student_batch_id: uuid.UUID

    fee_plan_id: uuid.UUID
    plan_type: str
    final_amount: int
    amount_paid: int
    balance_due: int
    next_due_date: Optional[date] = None
    is_overdue: bool

    onboarded_by_user_id: uuid.UUID
    onboarded_by_name: Optional[str] = None
    created_at: datetime


class PaymentOut(BaseModel):
    id: uuid.UUID
    fee_plan_id: uuid.UUID
    fee_installment_id: Optional[uuid.UUID] = None
    amount: int
    payment_date: datetime
    payment_method: str
    status: str
    reference_number: Optional[str] = None
    receipt_number: Optional[str] = None
    recorded_by_user_id: uuid.UUID
    notes: Optional[str] = None
    created_at: datetime
    erp_status: str = "pending"
    frappe_payment_entry_name: Optional[str] = None

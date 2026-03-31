import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.sa_billing import (
    BillingConfigOut, BillingConfigUpdate,
    InvoiceGenerateRequest, InvoiceOut, InvoiceStatusUpdate,
    PaymentRecordRequest, PaymentOut,
    RevenueDashboard,
    SAAnnouncementCreate, SAAnnouncementOut,
)
from app.services import sa_billing_service, sa_notification_service

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


# ── Billing Config ──────────────────────────────────────────────

@router.get("/billing/{institute_id}", response_model=BillingConfigOut)
async def get_billing_config(
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_billing_service.get_billing_config(session, institute_id)
    return BillingConfigOut(**data)


@router.put("/billing/{institute_id}", response_model=BillingConfigOut)
async def update_billing_config(
    institute_id: uuid.UUID,
    body: BillingConfigUpdate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    updates = body.model_dump(exclude_none=True)
    data = await sa_billing_service.update_billing_config(session, institute_id, updates)
    return BillingConfigOut(**data)


# ── Invoices ────────────────────────────────────────────────────

@router.post("/invoices/generate", response_model=InvoiceOut)
async def generate_invoice(
    body: InvoiceGenerateRequest,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        invoice = await sa_billing_service.generate_invoice(
            session, body.institute_id, body.period_start, body.period_end,
            body.due_date, sa.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return InvoiceOut.model_validate(invoice)


@router.get("/invoices", response_model=PaginatedResponse[InvoiceOut])
async def list_invoices(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    institute_id: Optional[str] = None,
    status: Optional[str] = None,
):
    iid = uuid.UUID(institute_id) if institute_id else None
    items, total = await sa_billing_service.list_invoices(
        session, iid, status, page, per_page,
    )
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[InvoiceOut(**i) for i in items],
        total=total, page=page, per_page=per_page, total_pages=total_pages,
    )


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.billing import Invoice
    inv = await session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceOut.model_validate(inv)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice_status(
    invoice_id: uuid.UUID,
    body: InvoiceStatusUpdate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.billing import Invoice
    from datetime import datetime, timezone

    inv = await session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv.status = body.status
    inv.updated_at = datetime.now(timezone.utc)
    session.add(inv)
    await session.commit()
    await session.refresh(inv)
    return InvoiceOut.model_validate(inv)


# ── Payments ────────────────────────────────────────────────────

@router.post("/payments", response_model=PaymentOut)
async def record_payment(
    body: PaymentRecordRequest,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    payment = await sa_billing_service.record_payment(
        session, body.institute_id, body.amount, body.payment_date,
        body.payment_method, sa.id, body.reference_number, body.notes,
        body.invoice_id,
    )
    return PaymentOut.model_validate(payment)


@router.get("/payments", response_model=PaginatedResponse[PaymentOut])
async def list_payments(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    institute_id: Optional[str] = None,
):
    iid = uuid.UUID(institute_id) if institute_id else None
    items, total = await sa_billing_service.list_payments(
        session, iid, page, per_page,
    )
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[PaymentOut(**i) for i in items],
        total=total, page=page, per_page=per_page, total_pages=total_pages,
    )


# ── Revenue Dashboard ──────────────────────────────────────────

@router.get("/revenue", response_model=RevenueDashboard)
async def get_revenue(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_billing_service.get_revenue_dashboard(session)
    return RevenueDashboard(**data)


# ── SA Announcements ───────────────────────────────────────────

@router.post("/announcements", response_model=SAAnnouncementOut)
async def create_announcement(
    body: SAAnnouncementCreate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    notif = await sa_notification_service.send_sa_announcement(
        session, body.title, body.message, body.target_institute_ids, sa.id,
    )
    return SAAnnouncementOut.model_validate(notif)


@router.get("/announcements", response_model=PaginatedResponse[SAAnnouncementOut])
async def list_announcements(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    items, total = await sa_notification_service.list_sa_announcements(
        session, page, per_page,
    )
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[SAAnnouncementOut(**i) for i in items],
        total=total, page=page, per_page=per_page, total_pages=total_pages,
    )

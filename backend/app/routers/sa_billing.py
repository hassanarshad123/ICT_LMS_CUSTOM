import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.models.institute import Institute
from app.schemas.common import PaginatedResponse
from app.schemas.sa_billing import (
    BillingConfigOut, BillingConfigUpdate,
    InvoicePreviewRequest, InvoicePreviewResponse,
    InvoiceGenerateRequest, InvoiceOut, InvoiceStatusUpdate,
    PaymentRecordRequest, PaymentOut,
    RevenueDashboard,
    SAAnnouncementCreate, SAAnnouncementOut,
)
from app.services import sa_billing_service, sa_notification_service, sa_settings_service
from app.schemas.sa_settings import (
    SAProfileOut, SAProfileUpdate, SALogoUpload,
    SAPaymentMethodsOut, SAPaymentMethodsUpdate,
)

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


# ── SA Settings ─────────────────────────────────────────────────

@router.get("/settings/profile", response_model=SAProfileOut)
async def get_sa_profile(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_settings_service.get_sa_profile(session)
    return SAProfileOut(**data)


@router.put("/settings/profile", response_model=SAProfileOut)
async def update_sa_profile(
    body: SAProfileUpdate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    updates = body.model_dump(exclude_none=True)
    data = await sa_settings_service.update_sa_profile(session, updates)
    return SAProfileOut(**data)


@router.post("/settings/logo", response_model=SAProfileOut)
async def upload_sa_logo(
    body: SALogoUpload,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_settings_service.update_sa_logo(session, body.logo)
    return SAProfileOut(**data)


@router.get("/settings/payment-methods", response_model=SAPaymentMethodsOut)
async def get_payment_methods(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    methods = await sa_settings_service.get_payment_methods(session)
    return SAPaymentMethodsOut(methods=methods)


@router.put("/settings/payment-methods", response_model=SAPaymentMethodsOut)
async def update_payment_methods(
    body: SAPaymentMethodsUpdate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    methods = await sa_settings_service.update_payment_methods(
        session, [m.model_dump() for m in body.methods]
    )
    return SAPaymentMethodsOut(methods=methods)


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

@router.post("/invoices/preview", response_model=InvoicePreviewResponse)
async def preview_invoice(
    body: InvoicePreviewRequest,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        data = await sa_billing_service.preview_invoice_data(
            session, body.institute_id, body.period_start, body.period_end,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return InvoicePreviewResponse(**data)


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
            custom_line_items=body.custom_line_items,
            discount_type=body.discount_type,
            discount_value=body.discount_value,
            notes=body.notes,
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


@router.get("/invoices/{invoice_id}/download")
async def download_invoice(
    invoice_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.billing import Invoice
    from app.utils.s3 import generate_download_url

    inv = await session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not inv.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not generated yet")

    url = generate_download_url(inv.pdf_path, f"{inv.invoice_number}.pdf")
    return {"download_url": url}


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


# ── Public Invoice Verification (no auth) ──────────────────────

@router.get("/invoice/verify/{invoice_number}")
async def verify_invoice(
    invoice_number: str,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.billing import Invoice
    from sqlmodel import select as sel

    r = await session.execute(
        sel(Invoice).where(Invoice.invoice_number == invoice_number)
    )
    inv = r.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    inst = await session.get(Institute, inv.institute_id) if inv.institute_id else None
    return {
        "invoice_number": inv.invoice_number,
        "institute_name": inst.name if inst else "Unknown",
        "total_amount": inv.total_amount,
        "status": inv.status,
        "period_start": inv.period_start.isoformat() if inv.period_start else None,
        "period_end": inv.period_end.isoformat() if inv.period_end else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }


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

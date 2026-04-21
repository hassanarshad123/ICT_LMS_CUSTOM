import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.models.institute import Institute
from app.utils.rate_limit import limiter
from app.utils.audit import log_sa_action
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
    await log_sa_action(session, sa.id, "sa_profile_updated", "settings", details=updates)
    await session.commit()
    return SAProfileOut(**data)


@router.post("/settings/logo", response_model=SAProfileOut)
async def upload_sa_logo(
    body: SALogoUpload,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await sa_settings_service.update_sa_logo(session, body.logo)
    await log_sa_action(session, sa.id, "sa_logo_uploaded", "settings")
    await session.commit()
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
    await log_sa_action(session, sa.id, "payment_methods_updated", "settings", details={"count": len(body.methods)})
    await session.commit()
    return SAPaymentMethodsOut(methods=methods)


# ── Billing Config ──────────────────────────────────────────────

@router.get("/billing/{institute_id}", response_model=BillingConfigOut)
async def get_billing_config(
    institute_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        data = await sa_billing_service.get_billing_config(session, institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return BillingConfigOut(**data)


@router.put("/billing/{institute_id}", response_model=BillingConfigOut)
async def update_billing_config(
    institute_id: uuid.UUID,
    body: BillingConfigUpdate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    updates = body.model_dump(exclude_none=True)
    try:
        data = await sa_billing_service.update_billing_config(session, institute_id, updates)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await log_sa_action(session, sa.id, "billing_config_updated", "institute", institute_id, institute_id=institute_id, details=updates)
    await session.commit()

    # Invalidate dashboard cache so the admin sees fresh billing figures.
    try:
        from app.core.cache import cache
        await cache.invalidate_dashboard(str(institute_id))
    except Exception:
        pass

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
@limiter.limit("10/minute")
async def generate_invoice(
    request: Request,
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
    await log_sa_action(session, sa.id, "invoice_generated", "invoice", invoice.id, institute_id=body.institute_id, details={"invoice_number": invoice.invoice_number, "total_amount": invoice.total_amount})
    await session.commit()
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
    old_status = inv.status
    inv.status = body.status
    inv.updated_at = datetime.now(timezone.utc)
    session.add(inv)
    await log_sa_action(session, sa.id, "invoice_status_changed", "invoice", invoice_id, institute_id=inv.institute_id, details={"from": old_status, "to": body.status})
    await session.commit()
    await session.refresh(inv)
    return InvoiceOut.model_validate(inv)


@router.get("/invoices/{invoice_id}/download")
async def download_invoice(
    invoice_id: uuid.UUID,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from fastapi.responses import StreamingResponse
    import io

    try:
        pdf_bytes, filename = await sa_billing_service.generate_invoice_pdf_bytes(
            session, invoice_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Payments ────────────────────────────────────────────────────

@router.post("/payments", response_model=PaymentOut)
@limiter.limit("10/minute")
async def record_payment(
    request: Request,
    body: PaymentRecordRequest,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        payment = await sa_billing_service.record_payment(
            session, body.institute_id, body.amount, body.payment_date,
            body.payment_method, sa.id, body.reference_number, body.notes,
            body.invoice_id,
        )
    except ValueError as e:
        # e.g. invoice missing, institute mismatch, would overpay.
        raise HTTPException(status_code=400, detail=str(e))
    await log_sa_action(session, sa.id, "payment_recorded", "payment", payment.id, institute_id=body.institute_id, details={"amount": body.amount, "method": body.payment_method})
    await session.commit()
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
@limiter.limit("10/minute")
async def verify_invoice(
    request: Request,
    invoice_number: str,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Public endpoint for invoice verification. Returns minimal data only."""
    from app.models.billing import Invoice
    from sqlmodel import select as sel

    r = await session.execute(
        sel(Invoice).where(Invoice.invoice_number == invoice_number)
    )
    inv = r.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Only expose verification status — no financial data, no institute names
    return {
        "invoice_number": inv.invoice_number,
        "valid": True,
        "status": inv.status,
    }


# ── SA Announcements ───────────────────────────────────────────

@router.post("/announcements", response_model=SAAnnouncementOut)
@limiter.limit("5/minute")
async def create_announcement(
    request: Request,
    body: SAAnnouncementCreate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    notif = await sa_notification_service.send_sa_announcement(
        session, body.title, body.message, body.target_institute_ids, sa.id,
    )
    await log_sa_action(session, sa.id, "sa_announcement_sent", "announcement", notif.id, details={"title": body.title, "target_count": len(body.target_institute_ids) or "all"})
    await session.commit()
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

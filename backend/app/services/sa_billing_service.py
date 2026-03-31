import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlmodel import select, func

from app.models.billing import (
    InstituteBilling, Invoice, Payment, InvoiceCounter,
)
from app.models.institute import Institute


async def get_or_create_billing(
    session: AsyncSession, institute_id: uuid.UUID
) -> InstituteBilling:
    r = await session.execute(
        select(InstituteBilling).where(InstituteBilling.institute_id == institute_id)
    )
    billing = r.scalar_one_or_none()
    if not billing:
        billing = InstituteBilling(institute_id=institute_id)
        session.add(billing)
        await session.flush()
    return billing


async def get_billing_config(
    session: AsyncSession, institute_id: uuid.UUID
) -> dict:
    billing = await get_or_create_billing(session, institute_id)
    inst = await session.get(Institute, institute_id)
    return {
        "institute_id": str(institute_id),
        "institute_name": inst.name if inst else "Unknown",
        "base_amount": billing.base_amount,
        "currency": billing.currency,
        "billing_cycle": billing.billing_cycle,
        "extra_user_rate": billing.extra_user_rate,
        "extra_storage_rate": billing.extra_storage_rate,
        "extra_video_rate": billing.extra_video_rate,
        "notes": billing.notes,
    }


async def update_billing_config(
    session: AsyncSession, institute_id: uuid.UUID, updates: dict
) -> dict:
    billing = await get_or_create_billing(session, institute_id)
    for key, value in updates.items():
        if value is not None and hasattr(billing, key):
            setattr(billing, key, value)
    billing.updated_at = datetime.now(timezone.utc)
    session.add(billing)
    await session.commit()
    return await get_billing_config(session, institute_id)


async def _next_invoice_number(session: AsyncSession) -> str:
    """Generate next invoice number using FOR UPDATE lock (like CertificateCounter)."""
    year = datetime.now(timezone.utc).year

    r = await session.execute(
        select(InvoiceCounter)
        .where(InvoiceCounter.current_year == year)
        .with_for_update()
    )
    counter = r.scalar_one_or_none()

    if not counter:
        counter = InvoiceCounter(current_year=year, last_sequence=0)
        session.add(counter)
        await session.flush()

    counter.last_sequence += 1
    session.add(counter)
    return f"INV-{year}-{counter.last_sequence:05d}"


async def _auto_calculate_line_items(
    session: AsyncSession, institute_id: uuid.UUID
) -> tuple[list[dict], "Institute", "InstituteBilling"]:
    """Calculate line items from billing config and current usage."""
    billing = await get_or_create_billing(session, institute_id)
    inst = await session.get(Institute, institute_id)
    if not inst:
        raise ValueError("Institute not found")

    r = await session.execute(text("""
        SELECT COALESCE(current_users, 0),
               COALESCE(current_storage_bytes, 0),
               COALESCE(current_video_bytes, 0)
        FROM institute_usage
        WHERE institute_id = :iid
    """), {"iid": str(institute_id)})
    usage = r.one_or_none()
    current_users = usage[0] if usage else 0
    current_storage_gb = (usage[1] / (1024 ** 3)) if usage else 0
    current_video_gb = (usage[2] / (1024 ** 3)) if usage else 0

    line_items = []

    if billing.base_amount > 0:
        line_items.append({
            "description": f"Base plan fee ({billing.billing_cycle})",
            "quantity": 1,
            "unit_price": billing.base_amount,
            "amount": billing.base_amount,
        })

    extra_users = max(0, current_users - inst.max_users)
    if extra_users > 0 and billing.extra_user_rate > 0:
        line_items.append({
            "description": f"Extra users ({extra_users} beyond {inst.max_users} limit)",
            "quantity": extra_users,
            "unit_price": billing.extra_user_rate,
            "amount": extra_users * billing.extra_user_rate,
        })

    extra_storage = max(0, round(current_storage_gb - inst.max_storage_gb, 2))
    if extra_storage > 0 and billing.extra_storage_rate > 0:
        amt = int(extra_storage * billing.extra_storage_rate)
        line_items.append({
            "description": f"Extra storage ({extra_storage:.2f} GB beyond {inst.max_storage_gb} GB)",
            "quantity": round(extra_storage, 2),
            "unit_price": billing.extra_storage_rate,
            "amount": amt,
        })

    extra_video = max(0, round(current_video_gb - inst.max_video_gb, 2))
    if extra_video > 0 and billing.extra_video_rate > 0:
        amt = int(extra_video * billing.extra_video_rate)
        line_items.append({
            "description": f"Extra video ({extra_video:.2f} GB beyond {inst.max_video_gb} GB)",
            "quantity": round(extra_video, 2),
            "unit_price": billing.extra_video_rate,
            "amount": amt,
        })

    return line_items, inst, billing


async def preview_invoice_data(
    session: AsyncSession,
    institute_id: uuid.UUID,
    period_start: date,
    period_end: date,
) -> dict:
    """Preview auto-calculated line items WITHOUT creating a record."""
    line_items, inst, billing = await _auto_calculate_line_items(session, institute_id)
    subtotal = sum(item["amount"] for item in line_items)
    return {
        "institute_name": inst.name,
        "institute_email": inst.contact_email,
        "line_items": line_items,
        "subtotal": subtotal,
    }


async def generate_invoice(
    session: AsyncSession,
    institute_id: uuid.UUID,
    period_start: date,
    period_end: date,
    due_date: date,
    generated_by: uuid.UUID,
    custom_line_items: list[dict] | None = None,
    discount_type: str | None = None,
    discount_value: int | None = None,
    notes: str | None = None,
) -> Invoice:
    """Generate invoice with optional custom line items, discount, and notes.
    Also generates PDF and uploads to S3.
    """
    import logging
    logger = logging.getLogger("ict_lms.billing")

    auto_items, inst, billing = await _auto_calculate_line_items(session, institute_id)
    line_items = custom_line_items if custom_line_items else auto_items
    subtotal = sum(item["amount"] for item in line_items)

    # Calculate discount
    discount_amount = 0
    if discount_type and discount_value:
        if discount_type == "percentage":
            discount_amount = int(subtotal * discount_value / 100)
        else:  # flat
            discount_amount = min(discount_value, subtotal)

    total_amount = max(0, subtotal - discount_amount)
    invoice_number = await _next_invoice_number(session)

    invoice = Invoice(
        institute_id=institute_id,
        invoice_number=invoice_number,
        period_start=period_start,
        period_end=period_end,
        base_amount=billing.base_amount,
        line_items=line_items,
        total_amount=total_amount,
        discount_type=discount_type,
        discount_value=discount_value,
        discount_amount=discount_amount if discount_amount > 0 else None,
        notes=notes,
        status="draft",
        due_date=due_date,
        generated_by=generated_by,
    )
    session.add(invoice)
    await session.commit()
    await session.refresh(invoice)
    return invoice


async def generate_invoice_pdf_bytes(
    session: AsyncSession,
    invoice_id: uuid.UUID,
) -> tuple[bytes, str]:
    """Generate PDF bytes for an invoice. Returns (pdf_bytes, filename)."""
    from app.utils.invoice_pdf import generate_invoice_pdf, InvoiceDesign
    from app.services.sa_settings_service import get_sa_profile, get_payment_methods

    inv = await session.get(Invoice, invoice_id)
    if not inv:
        raise ValueError("Invoice not found")

    inst = await session.get(Institute, inv.institute_id)
    if not inst:
        raise ValueError("Institute not found")

    profile = await get_sa_profile(session)
    payment_methods = await get_payment_methods(session)

    design = InvoiceDesign(
        company_name=profile.get("company_name", ""),
        company_email=profile.get("company_email", ""),
        company_phone=profile.get("company_phone", ""),
        company_address=profile.get("company_address", ""),
        company_logo=profile.get("company_logo") or None,
        payment_methods=payment_methods,
    )

    discount_label = None
    if inv.discount_amount and inv.discount_amount > 0:
        if inv.discount_type == "percentage":
            discount_label = f"Discount ({inv.discount_value}%)"
        else:
            discount_label = "Discount"

    subtotal = sum(item.get("amount", 0) for item in (inv.line_items or []))

    pdf_bytes = generate_invoice_pdf(
        design=design,
        invoice_number=inv.invoice_number,
        institute_name=inst.name,
        institute_email=inst.contact_email,
        period_start=inv.period_start.isoformat(),
        period_end=inv.period_end.isoformat(),
        due_date=inv.due_date.isoformat(),
        line_items=inv.line_items or [],
        subtotal=subtotal,
        discount_label=discount_label,
        discount_amount=inv.discount_amount or 0,
        total_amount=inv.total_amount,
        notes=inv.notes,
        verification_url=f"https://zensbot.online/invoice/verify/{inv.invoice_number}",
    )

    # Best-effort S3 upload (non-blocking)
    try:
        from app.utils.s3 import _get_client as get_s3_client
        from app.config import get_settings
        settings = get_settings()
        if settings.AWS_ACCESS_KEY_ID:
            s3 = get_s3_client()
            object_key = f"invoices/{inv.invoice_number}.pdf"
            s3.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=object_key,
                Body=pdf_bytes,
                ContentType="application/pdf",
            )
            inv.pdf_path = object_key
            session.add(inv)
            await session.commit()
    except Exception:
        pass  # S3 is optional — PDF is returned directly

    filename = f"{inv.invoice_number}.pdf"
    return pdf_bytes, filename


async def list_invoices(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    params: dict = {}
    where_clauses = []

    if institute_id:
        where_clauses.append("inv.institute_id = :iid")
        params["iid"] = str(institute_id)
    if status:
        where_clauses.append("inv.status = :status")
        params["status"] = status

    where_sql = (" AND " + " AND ".join(where_clauses)) if where_clauses else ""

    r = await session.execute(
        text(f"SELECT COUNT(*) FROM invoices inv WHERE 1=1{where_sql}"), params
    )
    total = r.scalar() or 0

    offset = (page - 1) * per_page
    params["lim"] = per_page
    params["off"] = offset

    r = await session.execute(text(f"""
        SELECT inv.id, inv.institute_id, i.name, inv.invoice_number,
               inv.period_start, inv.period_end, inv.base_amount,
               inv.line_items, inv.total_amount, inv.status, inv.due_date,
               inv.generated_by, inv.created_at
        FROM invoices inv
        LEFT JOIN institutes i ON i.id = inv.institute_id
        WHERE 1=1{where_sql}
        ORDER BY inv.created_at DESC
        LIMIT :lim OFFSET :off
    """), params)

    items = []
    for row in r.all():
        items.append({
            "id": str(row[0]),
            "institute_id": str(row[1]),
            "institute_name": row[2],
            "invoice_number": row[3],
            "period_start": row[4].isoformat() if row[4] else None,
            "period_end": row[5].isoformat() if row[5] else None,
            "base_amount": row[6],
            "line_items": row[7] or [],
            "total_amount": row[8],
            "status": row[9],
            "due_date": row[10].isoformat() if row[10] else None,
            "generated_by": str(row[11]),
            "created_at": row[12].isoformat() if row[12] else None,
        })

    return items, total


async def record_payment(
    session: AsyncSession,
    institute_id: uuid.UUID,
    amount: int,
    payment_date: datetime,
    payment_method: str,
    recorded_by: uuid.UUID,
    reference_number: Optional[str] = None,
    notes: Optional[str] = None,
    invoice_id: Optional[uuid.UUID] = None,
) -> Payment:
    payment = Payment(
        institute_id=institute_id,
        invoice_id=invoice_id,
        amount=amount,
        payment_date=payment_date,
        payment_method=payment_method,
        status="received",
        reference_number=reference_number,
        notes=notes,
        recorded_by=recorded_by,
    )
    session.add(payment)

    # If linked to invoice and amount covers it, mark as paid
    if invoice_id:
        inv = await session.get(Invoice, invoice_id)
        if inv and amount >= inv.total_amount:
            inv.status = "paid"
            inv.updated_at = datetime.now(timezone.utc)
            session.add(inv)

    await session.commit()
    await session.refresh(payment)
    return payment


async def list_payments(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    params: dict = {}
    inst_clause = ""
    if institute_id:
        inst_clause = " AND p.institute_id = :iid"
        params["iid"] = str(institute_id)

    r = await session.execute(
        text(f"SELECT COUNT(*) FROM payments p WHERE 1=1{inst_clause}"), params
    )
    total = r.scalar() or 0

    offset = (page - 1) * per_page
    params["lim"] = per_page
    params["off"] = offset

    r = await session.execute(text(f"""
        SELECT p.id, p.institute_id, i.name, p.invoice_id, p.amount,
               p.payment_date, p.payment_method, p.status, p.reference_number,
               p.notes, p.recorded_by, p.created_at
        FROM payments p
        LEFT JOIN institutes i ON i.id = p.institute_id
        WHERE 1=1{inst_clause}
        ORDER BY p.created_at DESC
        LIMIT :lim OFFSET :off
    """), params)

    items = []
    for row in r.all():
        items.append({
            "id": str(row[0]),
            "institute_id": str(row[1]),
            "institute_name": row[2],
            "invoice_id": str(row[3]) if row[3] else None,
            "amount": row[4],
            "payment_date": row[5].isoformat() if row[5] else None,
            "payment_method": row[6],
            "status": row[7],
            "reference_number": row[8],
            "notes": row[9],
            "recorded_by": str(row[10]),
            "created_at": row[11].isoformat() if row[11] else None,
        })

    return items, total


async def get_revenue_dashboard(session: AsyncSession) -> dict:
    # Total collected (verified payments)
    r = await session.execute(text("""
        SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status IN ('received', 'verified')
    """))
    total_collected = r.scalar() or 0

    # Total outstanding (unpaid/overdue invoices)
    r = await session.execute(text("""
        SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status IN ('sent', 'overdue')
    """))
    total_outstanding = r.scalar() or 0

    # Revenue by plan tier
    r = await session.execute(text("""
        SELECT i.plan_tier, COALESCE(SUM(p.amount), 0)
        FROM payments p
        JOIN institutes i ON i.id = p.institute_id
        WHERE p.status IN ('received', 'verified')
        GROUP BY i.plan_tier
    """))
    revenue_by_plan = {"free": 0, "basic": 0, "pro": 0, "enterprise": 0}
    for row in r.all():
        revenue_by_plan[row[0]] = row[1]

    # Monthly trend (last 12 months)
    r = await session.execute(text("""
        SELECT to_char(payment_date, 'YYYY-MM') AS month,
               SUM(amount) AS total
        FROM payments
        WHERE status IN ('received', 'verified')
          AND payment_date >= NOW() - INTERVAL '12 months'
        GROUP BY month
        ORDER BY month
    """))
    monthly_trend = [{"month": row[0], "amount": row[1]} for row in r.all()]

    return {
        "total_collected": total_collected,
        "total_outstanding": total_outstanding,
        "revenue_by_plan": revenue_by_plan,
        "monthly_trend": monthly_trend,
    }

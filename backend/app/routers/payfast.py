import uuid
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.models.billing import Invoice, InstituteBilling
from app.services.payfast import get_access_token, build_checkout_payload, POST_TRANSACTION_PATH
from app.utils.audit import log_sa_action

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


@router.post("/payfast/checkout/{invoice_id}")
async def initiate_checkout(
    invoice_id: str,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    if not settings.PAYFAST_ENABLED:
        raise HTTPException(status_code=503, detail="PayFast is not enabled")

    result = await session.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == "paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")

    billing_result = await session.execute(
        select(InstituteBilling).where(InstituteBilling.institute_id == invoice.institute_id)
    )
    billing = billing_result.scalar_one_or_none()
    if not billing or not billing.payfast_enabled:
        raise HTTPException(status_code=400, detail="PayFast not enabled for this institute")

    basket_id = f"INV-{invoice.invoice_number}"
    invoice.basket_id = basket_id
    session.add(invoice)

    token_response = await get_access_token(
        merchant_id=settings.PAYFAST_MERCHANT_ID,
        secured_key=settings.PAYFAST_SECURED_KEY,
        amount_minor=invoice.total_amount * 100,
        basket_id=basket_id,
        base_url=settings.PAYFAST_BASE_URL,
    )

    payload = build_checkout_payload(
        invoice=invoice,
        admin=sa,
        token=token_response.token,
        return_url=settings.PAYFAST_RETURN_URL,
        cancel_url=settings.PAYFAST_CANCEL_URL,
        checkout_url=settings.PAYFAST_CHECKOUT_URL,
        merchant_id=settings.PAYFAST_MERCHANT_ID,
        merchant_name=settings.PAYFAST_MERCHANT_NAME,
    )

    action_url = f"{settings.PAYFAST_BASE_URL}{POST_TRANSACTION_PATH}"

    await log_sa_action(session, sa.id, "payfast_checkout_initiated", "invoice", invoice.id, {
        "invoice_number": invoice.invoice_number,
        "amount": invoice.total_amount,
        "basket_id": basket_id,
    })
    await session.commit()

    return {
        "action_url": action_url,
        "fields": payload,
        "basket_id": basket_id,
    }

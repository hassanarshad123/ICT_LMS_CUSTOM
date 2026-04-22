import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from sqlalchemy import select

from app.config import get_settings
from app.database import async_session
from app.models.billing import Invoice, Payment
from app.models.institute import Institute
from app.services.payfast import verify_ipn, IpnPayload, SUCCESS_ERR_CODE
from app.services import sa_alert_service

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


@router.post("/webhooks/payfast")
async def payfast_ipn(request: Request):
    """PayFast IPN callback — no auth (PayFast POSTs here). Always returns 200."""
    try:
        form = await request.form()
        data = dict(form)

        ipn = IpnPayload(
            transaction_id=data.get("transaction_id"),
            basket_id=data.get("basket_id"),
            err_code=data.get("err_code"),
            err_msg=data.get("err_msg"),
            validation_hash=data.get("validation_hash"),
            raw=data,
        )

        if not verify_ipn(data, settings.PAYFAST_SECURED_KEY, settings.PAYFAST_MERCHANT_ID):
            logger.warning("PayFast IPN signature verification failed: %s", data)
            return {"status": "signature_invalid"}

        async with async_session() as session:
            result = await session.execute(
                select(Invoice).where(Invoice.basket_id == ipn.basket_id)
            )
            invoice = result.scalar_one_or_none()

            if not invoice:
                logger.warning("PayFast IPN: no invoice for basket_id=%s", ipn.basket_id)
                return {"status": "invoice_not_found"}

            if ipn.err_code == SUCCESS_ERR_CODE:
                invoice.status = "paid"
                invoice.payfast_transaction_id = ipn.transaction_id
                session.add(invoice)

                payment = Payment(
                    institute_id=invoice.institute_id,
                    invoice_id=invoice.id,
                    amount=invoice.total_amount,
                    payment_date=datetime.now(timezone.utc),
                    payment_method="online",
                    status="received",
                    reference_number=ipn.transaction_id,
                    notes=f"PayFast auto-payment. basket_id={ipn.basket_id}",
                    recorded_by=invoice.generated_by,
                )
                session.add(payment)

                inst_result = await session.execute(
                    select(Institute).where(Institute.id == invoice.institute_id)
                )
                inst = inst_result.scalar_one_or_none()
                if inst and inst.billing_restriction:
                    inst.billing_restriction = None
                    session.add(inst)

                await sa_alert_service.create_alert(
                    session,
                    alert_type="payment_received",
                    severity="info",
                    title=f"Payment received: {invoice.invoice_number}",
                    message=f"PayFast payment of PKR {invoice.total_amount} received for invoice {invoice.invoice_number}.",
                    entity_type="invoice",
                    entity_id=invoice.id,
                    link="/sa/billing",
                    dedup_key=f"payment_received:{invoice.id}",
                )

                await session.commit()
                logger.info("PayFast payment recorded for invoice %s", invoice.invoice_number)
                return {"status": "success"}
            else:
                logger.warning(
                    "PayFast IPN error for basket_id=%s: err_code=%s err_msg=%s",
                    ipn.basket_id, ipn.err_code, ipn.err_msg,
                )
                await sa_alert_service.create_alert(
                    session,
                    alert_type="payment_received",
                    severity="warning",
                    title=f"Payment failed: {invoice.invoice_number}",
                    message=f"PayFast payment failed for invoice {invoice.invoice_number}. Error: {ipn.err_msg or ipn.err_code}",
                    entity_type="invoice",
                    entity_id=invoice.id,
                    link="/sa/billing",
                    dedup_key=f"payment_failed:{invoice.id}:{ipn.err_code}",
                )
                await session.commit()
                return {"status": "payment_failed"}

    except Exception:
        logger.exception("PayFast IPN processing error")
        return {"status": "error"}

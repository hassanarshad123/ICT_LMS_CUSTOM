"""Webhook event service: queue events and dispatch deliveries with retries."""
import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.api_integration import WebhookEndpoint, WebhookDelivery
from app.utils.encryption import decrypt

logger = logging.getLogger("ict_lms.webhooks")

# Exponential backoff intervals: 1min, 5min, 30min, 2hr, 12hr
RETRY_INTERVALS = [
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=30),
    timedelta(hours=2),
    timedelta(hours=12),
]
MAX_ATTEMPTS = len(RETRY_INTERVALS) + 1  # 6 total (1 initial + 5 retries)


async def queue_webhook_event(
    session: AsyncSession,
    institute_id: uuid.UUID,
    event_type: str,
    data: dict,
) -> None:
    """Create pending WebhookDelivery records for all matching active webhooks.

    The caller is responsible for committing the transaction.
    """
    result = await session.execute(
        select(WebhookEndpoint).where(
            WebhookEndpoint.institute_id == institute_id,
            WebhookEndpoint.is_active.is_(True),
            WebhookEndpoint.deleted_at.is_(None),
        )
    )
    webhooks = result.scalars().all()

    now = datetime.now(timezone.utc)
    payload = {
        "event": event_type,
        "timestamp": now.isoformat(),
        "data": data,
    }

    for wh in webhooks:
        if event_type not in (wh.events or []):
            continue

        delivery = WebhookDelivery(
            webhook_endpoint_id=wh.id,
            event_type=event_type,
            payload=payload,
            status="pending",
            next_retry_at=now,  # eligible for immediate pickup
            institute_id=institute_id,
        )
        session.add(delivery)

    await session.flush()


def _sign_payload(secret: str, timestamp: str, body: str) -> str:
    """Generate HMAC-SHA256 signature."""
    message = f"{timestamp}.{body}"
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


async def _deliver_one(
    session: AsyncSession,
    delivery: WebhookDelivery,
    webhook: WebhookEndpoint,
) -> bool:
    """Attempt to deliver a single webhook event. Returns True on success."""
    body = json.dumps(delivery.payload)

    # Decrypt signing secret
    try:
        raw_secret = decrypt(webhook.secret)
    except Exception:
        logger.error("Failed to decrypt webhook secret for endpoint %s", webhook.id)
        delivery.status = "failed"
        delivery.response_body = "Internal error: failed to decrypt signing secret"
        delivery.completed_at = datetime.now(timezone.utc)
        session.add(delivery)
        return False

    timestamp = str(int(time.time()))
    signature = _sign_payload(raw_secret, timestamp, body)

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-Event": delivery.event_type,
        "X-Webhook-Delivery-Id": str(delivery.id),
        "User-Agent": "ICT-LMS-Webhook/1.0",
    }

    now = datetime.now(timezone.utc)
    delivery.attempt_count += 1
    delivery.last_attempted_at = now

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                webhook.url, content=body, headers=headers, timeout=10.0,
            )
        delivery.status_code = resp.status_code
        delivery.response_body = resp.text[:2000] if resp.text else None

        if 200 <= resp.status_code < 300:
            delivery.status = "success"
            delivery.completed_at = now
            delivery.next_retry_at = None
            session.add(delivery)
            return True

    except httpx.TimeoutException:
        delivery.response_body = "Request timed out after 10 seconds"
    except Exception as e:
        delivery.response_body = str(e)[:2000]

    # Failed — schedule retry or mark as failed
    if delivery.attempt_count < MAX_ATTEMPTS:
        retry_index = delivery.attempt_count - 1  # 0-based into RETRY_INTERVALS
        if retry_index < len(RETRY_INTERVALS):
            delivery.next_retry_at = now + RETRY_INTERVALS[retry_index]
        else:
            delivery.next_retry_at = now + RETRY_INTERVALS[-1]
        delivery.status = "retrying"
    else:
        delivery.status = "failed"
        delivery.completed_at = now
        delivery.next_retry_at = None

    session.add(delivery)
    return False


async def process_pending_deliveries(session: AsyncSession, batch_size: int = 50) -> int:
    """Process pending/retrying deliveries that are due. Returns count processed."""
    now = datetime.now(timezone.utc)

    result = await session.execute(
        select(WebhookDelivery).where(
            WebhookDelivery.status.in_(["pending", "retrying"]),
            WebhookDelivery.next_retry_at <= now,
        )
        .order_by(WebhookDelivery.next_retry_at)
        .limit(batch_size)
    )
    deliveries = result.scalars().all()

    if not deliveries:
        return 0

    # Batch-fetch all referenced webhook endpoints
    endpoint_ids = list({d.webhook_endpoint_id for d in deliveries})
    ep_result = await session.execute(
        select(WebhookEndpoint).where(WebhookEndpoint.id.in_(endpoint_ids))
    )
    endpoint_map = {ep.id: ep for ep in ep_result.scalars().all()}

    processed = 0
    for delivery in deliveries:
        webhook = endpoint_map.get(delivery.webhook_endpoint_id)
        if not webhook or not webhook.is_active or webhook.deleted_at:
            # Webhook was deleted or deactivated — mark delivery as failed
            delivery.status = "failed"
            delivery.completed_at = datetime.now(timezone.utc)
            delivery.response_body = "Webhook endpoint deactivated or deleted"
            delivery.next_retry_at = None
            session.add(delivery)
            processed += 1
            continue

        await _deliver_one(session, delivery, webhook)
        processed += 1

    await session.commit()
    return processed

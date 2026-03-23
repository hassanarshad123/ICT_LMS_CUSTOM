import hashlib
import hmac
import math
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.api_integration import WebhookEndpoint, WebhookDelivery
from app.utils.encryption import encrypt, decrypt


ALLOWED_WEBHOOK_EVENTS = [
    # Student lifecycle
    "user.created",
    "user.updated",
    "user.deactivated",
    "user.deleted",
    # Enrollment
    "enrollment.created",
    "enrollment.removed",
    # Certificates & progress
    "certificate.requested",
    "certificate.approved",
    "certificate.issued",
    "certificate.revoked",
    "lecture.progress_updated",
    # Classes & attendance
    "class.scheduled",
    "class.started",
    "class.ended",
    "attendance.recorded",
    "recording.ready",
]


async def create_webhook(
    session: AsyncSession,
    institute_id: uuid.UUID,
    url: str,
    events: list[str],
    created_by: uuid.UUID,
    description: Optional[str] = None,
) -> WebhookEndpoint:
    """Create a new webhook endpoint."""
    from app.utils.url_validation import validate_webhook_url
    validate_webhook_url(url)

    invalid = [e for e in events if e not in ALLOWED_WEBHOOK_EVENTS]
    if invalid:
        raise ValueError(f"Invalid webhook events: {', '.join(invalid)}")

    # Generate and encrypt HMAC signing secret
    raw_secret = secrets.token_urlsafe(32)
    encrypted_secret = encrypt(raw_secret)

    webhook = WebhookEndpoint(
        institute_id=institute_id,
        url=url,
        description=description,
        secret=encrypted_secret,
        events=events,
        created_by=created_by,
    )
    session.add(webhook)
    await session.commit()
    await session.refresh(webhook)
    return webhook


async def list_webhooks(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> list[WebhookEndpoint]:
    """List all non-deleted webhooks for an institute."""
    result = await session.execute(
        select(WebhookEndpoint).where(
            WebhookEndpoint.institute_id == institute_id,
            WebhookEndpoint.deleted_at.is_(None),
        ).order_by(WebhookEndpoint.created_at.desc())
    )
    return list(result.scalars().all())


async def get_webhook(
    session: AsyncSession,
    webhook_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> Optional[WebhookEndpoint]:
    """Get a single webhook by ID."""
    result = await session.execute(
        select(WebhookEndpoint).where(
            WebhookEndpoint.id == webhook_id,
            WebhookEndpoint.institute_id == institute_id,
            WebhookEndpoint.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def update_webhook(
    session: AsyncSession,
    webhook_id: uuid.UUID,
    institute_id: uuid.UUID,
    **fields,
) -> WebhookEndpoint:
    """Update webhook fields."""
    webhook = await get_webhook(session, webhook_id, institute_id)
    if not webhook:
        raise ValueError("Webhook not found")

    if "url" in fields and fields["url"] is not None:
        from app.utils.url_validation import validate_webhook_url
        validate_webhook_url(fields["url"])

    if "events" in fields and fields["events"] is not None:
        invalid = [e for e in fields["events"] if e not in ALLOWED_WEBHOOK_EVENTS]
        if invalid:
            raise ValueError(f"Invalid webhook events: {', '.join(invalid)}")

    for key, value in fields.items():
        if value is not None and hasattr(webhook, key):
            setattr(webhook, key, value)

    webhook.updated_at = datetime.now(timezone.utc)
    session.add(webhook)
    await session.commit()
    await session.refresh(webhook)
    return webhook


async def delete_webhook(
    session: AsyncSession,
    webhook_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> None:
    """Soft delete a webhook."""
    webhook = await get_webhook(session, webhook_id, institute_id)
    if not webhook:
        raise ValueError("Webhook not found")

    webhook.deleted_at = datetime.now(timezone.utc)
    webhook.is_active = False
    session.add(webhook)
    await session.commit()


def _sign_payload(secret: str, timestamp: str, body: str) -> str:
    """Generate HMAC-SHA256 signature."""
    message = f"{timestamp}.{body}"
    return hmac.new(
        secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()


async def test_webhook(
    session: AsyncSession,
    webhook_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> dict:
    """Send a test event to a webhook endpoint."""
    webhook = await get_webhook(session, webhook_id, institute_id)
    if not webhook:
        raise ValueError("Webhook not found")

    # Build test payload
    delivery_id = uuid.uuid4()
    event_type = "webhook.test"
    payload = {
        "event": event_type,
        "delivery_id": str(delivery_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "message": "This is a test webhook delivery from ICT LMS.",
        },
    }

    import json
    body = json.dumps(payload)

    # Sign
    raw_secret = decrypt(webhook.secret)
    timestamp = str(int(time.time()))
    signature = _sign_payload(raw_secret, timestamp, body)

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-Event": event_type,
        "X-Webhook-Delivery-Id": str(delivery_id),
        "User-Agent": "ICT-LMS-Webhook/1.0",
    }

    # Send
    success = False
    status_code = None
    response_body = None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(webhook.url, content=body, headers=headers, timeout=10.0)
            status_code = resp.status_code
            response_body = resp.text[:2000]
            success = 200 <= resp.status_code < 300
    except httpx.TimeoutException:
        response_body = "Request timed out after 10 seconds"
    except Exception as e:
        response_body = str(e)[:2000]

    # Record delivery
    delivery = WebhookDelivery(
        id=delivery_id,
        webhook_endpoint_id=webhook.id,
        event_type=event_type,
        payload=payload,
        status="success" if success else "failed",
        status_code=status_code,
        response_body=response_body,
        attempt_count=1,
        last_attempted_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        institute_id=institute_id,
    )
    session.add(delivery)
    await session.commit()

    return {
        "success": success,
        "status_code": status_code,
        "response_body": response_body,
        "delivery_id": delivery_id,
    }


async def get_deliveries(
    session: AsyncSession,
    webhook_id: uuid.UUID,
    institute_id: uuid.UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[WebhookDelivery], int]:
    """Get paginated delivery log for a webhook."""
    base = select(WebhookDelivery).where(
        WebhookDelivery.webhook_endpoint_id == webhook_id,
        WebhookDelivery.institute_id == institute_id,
    )
    count_q = select(func.count()).select_from(WebhookDelivery).where(
        WebhookDelivery.webhook_endpoint_id == webhook_id,
        WebhookDelivery.institute_id == institute_id,
    )

    result = await session.execute(count_q)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    result = await session.execute(
        base.order_by(WebhookDelivery.created_at.desc()).offset(offset).limit(per_page)
    )
    deliveries = list(result.scalars().all())

    return deliveries, total

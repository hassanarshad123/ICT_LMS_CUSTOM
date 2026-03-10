"""Phase 1 skeleton: queue webhook events as pending deliveries.

Phase 2 will add the async HTTP dispatch engine with retries.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.api_integration import WebhookEndpoint, WebhookDelivery


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
            institute_id=institute_id,
        )
        session.add(delivery)

    await session.flush()

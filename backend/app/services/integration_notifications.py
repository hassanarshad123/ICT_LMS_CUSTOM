"""Tier 3: notify institute admins when Frappe sync events go wrong.

Fires an in-app notification (bell icon badge) for every institute admin
when an outbound sync task fails after all retries. Deliberately
rate-limited via Redis: one notification per institute per 30 minutes,
so a run of correlated failures (e.g. Frappe down for an hour) doesn't
turn into 200 bell-icon dings.

Inbound inbound failures (Frappe → LMS) don't fire from here — Frappe's
own webhook retry policy handles those, and the LMS sync log captures them
for the admin dashboard.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.user import User

logger = logging.getLogger("ict_lms.integration_notifications")

NOTIFICATION_TYPE = "integration_sync_failure"
COALESCE_KEY_FMT = "integration:notify:sync_failure:{institute_id}"
COALESCE_TTL_SECONDS = 30 * 60  # 30 minutes


async def notify_sync_failure(
    session: AsyncSession,
    *,
    institute_id: uuid.UUID,
    event_type: str,
    error_message: str,
) -> None:
    """Create notifications for all admins of ``institute_id`` when a Frappe
    sync task terminally fails. Coalesces via Redis to avoid notification
    floods during sustained outages.
    """
    from app.core.cache import cache
    from app.services import notification_service

    # Coalesce: if we've already notified this institute in the last window,
    # skip — the sync-health dashboard still shows the full picture.
    key = COALESCE_KEY_FMT.format(institute_id=institute_id)
    if await cache.get(key) is not None:
        logger.info(
            "Sync failure notification coalesced for institute=%s event=%s",
            institute_id, event_type,
        )
        return
    await cache.set(key, "1", ttl=COALESCE_TTL_SECONDS)

    # Target: all admins of the institute (not course-creators, teachers, etc.)
    result = await session.execute(
        select(User.id).where(
            User.institute_id == institute_id,
            User.role == "admin",
            User.status == "active",
        )
    )
    admin_ids = [row[0] for row in result.all()]
    if not admin_ids:
        logger.warning("No active admins for institute=%s — skipping notification", institute_id)
        return

    friendly_event = event_type.replace("fee.", "").replace("_", " ")
    truncated_error = (error_message or "")[:160]
    title = "Frappe sync failed"
    message = (
        f"A {friendly_event} sync to your Frappe failed after retries. "
        f"Reason: {truncated_error}. Open the Sync Health tab to retry manually."
    )

    await notification_service.create_bulk_notifications(
        session,
        user_ids=admin_ids,
        type=NOTIFICATION_TYPE,
        title=title,
        message=message,
        link="/integrations?tab=sync-health",
        institute_id=institute_id,
    )
    logger.info(
        "Sync failure notification fanned out to %d admins of institute=%s",
        len(admin_ids), institute_id,
    )

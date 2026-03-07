"""Scheduled jobs for the ICT LMS."""
import logging
from datetime import datetime, timezone, timedelta

from app.database import async_session

logger = logging.getLogger("ict_lms.scheduler")


async def cleanup_expired_sessions():
    """Deactivate expired sessions (hourly)."""
    from sqlmodel import select
    from app.models.other import UserSession

    async with async_session() as session:
        result = await session.execute(
            select(UserSession).where(
                UserSession.is_active.is_(True),
                UserSession.expires_at < datetime.now(timezone.utc),
            )
        )
        expired = result.scalars().all()
        for s in expired:
            s.is_active = False
            session.add(s)
        if expired:
            await session.commit()
            logger.info("Cleaned up %d expired sessions", len(expired))


async def send_zoom_reminders():
    """Send reminders for upcoming Zoom classes (every 10 minutes)."""
    from sqlmodel import select
    from app.models.zoom import ZoomClass
    from app.models.enums import ZoomClassStatus

    now = datetime.now(timezone.utc)
    reminder_window = now + timedelta(minutes=15)

    async with async_session() as session:
        result = await session.execute(
            select(ZoomClass).where(
                ZoomClass.status == ZoomClassStatus.upcoming,
                ZoomClass.reminder_sent.is_(False),
                ZoomClass.deleted_at.is_(None),
            )
        )
        classes = result.scalars().all()
        for zc in classes:
            scheduled_dt = datetime.combine(zc.scheduled_date, zc.scheduled_time)
            if scheduled_dt <= reminder_window.replace(tzinfo=None):
                zc.reminder_sent = True
                session.add(zc)
                logger.info("Marked reminder sent for class %s", zc.title)

        await session.commit()

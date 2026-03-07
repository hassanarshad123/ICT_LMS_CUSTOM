import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.other import ActivityLog


async def log_activity(
    session: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
    )
    session.add(entry)
    await session.flush()

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog


async def log_activity(
    session: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
    impersonated_by: Optional[uuid.UUID] = None,
) -> None:
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
        institute_id=institute_id,
        impersonated_by=impersonated_by,
    )
    session.add(entry)
    await session.flush()

"""Centralized audit logging utility for SA operations.

Provides a single function for creating ActivityLog entries so all SA
operations log consistently with the same fields and format.
"""

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog


async def log_sa_action(
    session: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    institute_id: Optional[uuid.UUID] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Create an ActivityLog entry for an SA operation.

    Call this BEFORE session.commit() so it's part of the same transaction.
    The caller is responsible for committing.
    """
    log = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        institute_id=institute_id,
        details=details or {},
        ip_address=ip_address,
    )
    session.add(log)

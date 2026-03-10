import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.api_integration import ApiKey


async def create_api_key(
    session: AsyncSession,
    institute_id: uuid.UUID,
    name: str,
    created_by: uuid.UUID,
    expires_at: Optional[datetime] = None,
) -> tuple[ApiKey, str]:
    """Create a new API key. Returns (ApiKey, plaintext_key). The plaintext key is shown once only."""
    # Check limit: max 5 active keys per institute
    result = await session.execute(
        select(func.count()).select_from(ApiKey).where(
            ApiKey.institute_id == institute_id,
            ApiKey.is_active.is_(True),
        )
    )
    count = result.scalar() or 0
    if count >= 5:
        raise ValueError("Maximum of 5 active API keys per institute reached")

    # Generate key
    raw = secrets.token_hex(32)
    full_key = f"ict_pk_{raw}"
    key_prefix = full_key[:12]
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()

    api_key = ApiKey(
        institute_id=institute_id,
        name=name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        created_by=created_by,
        expires_at=expires_at,
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    return api_key, full_key


async def list_api_keys(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> list[ApiKey]:
    """List all API keys for an institute."""
    result = await session.execute(
        select(ApiKey)
        .where(ApiKey.institute_id == institute_id)
        .order_by(ApiKey.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_api_key(
    session: AsyncSession,
    key_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> ApiKey:
    """Revoke an API key."""
    result = await session.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.institute_id == institute_id,
        )
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise ValueError("API key not found")

    api_key.is_active = False
    api_key.revoked_at = datetime.now(timezone.utc)
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)
    return api_key

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.api_integration import ApiKey
from app.models.institute import Institute, InstituteStatus


@dataclass
class ApiKeyContext:
    institute_id: uuid.UUID
    api_key_id: uuid.UUID
    institute: Institute
    scopes: list[str]


async def get_api_key_context(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApiKeyContext:
    """Authenticate requests via X-API-Key header."""
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )

    # Hash and lookup
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    result = await session.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
    )
    db_key = result.scalar_one_or_none()

    if not db_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
        )

    # Check expiry
    if db_key.expires_at and db_key.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired",
        )

    # Load institute and check status (same logic as auth.py lines 50-66)
    institute = await session.get(Institute, db_key.institute_id)
    if not institute:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Institute not found",
        )

    if institute.status == InstituteStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute account is suspended",
        )

    if institute.expires_at and institute.expires_at < datetime.now(timezone.utc):
        institute.status = InstituteStatus.suspended
        session.add(institute)
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute subscription has expired",
        )

    # Update last_used_at
    db_key.last_used_at = datetime.now(timezone.utc)
    session.add(db_key)
    await session.flush()

    return ApiKeyContext(
        institute_id=db_key.institute_id,
        api_key_id=db_key.id,
        institute=institute,
        scopes=db_key.scopes or ["read"],
    )


def require_scope(*required_scopes: str):
    """Dependency factory that checks the API key has at least one of the required scopes."""
    async def _check(auth: ApiKeyContext = Depends(get_api_key_context)) -> ApiKeyContext:
        if not any(s in auth.scopes for s in required_scopes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API key lacks required scope. Needs one of: {', '.join(required_scopes)}",
            )
        return auth
    return _check


def api_key_rate_key(request: Request) -> str:
    """Rate limit key function that extracts API key prefix."""
    api_key = request.headers.get("X-API-Key", "")
    return api_key[:12] if api_key else "anonymous"


PublicAuth = Annotated[ApiKeyContext, Depends(get_api_key_context)]

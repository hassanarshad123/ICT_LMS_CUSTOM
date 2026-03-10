import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.user import User
from app.models.enums import UserStatus
from app.utils.security import decode_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    """Extract and validate the JWT access token, return the User."""
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await session.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    # Set Sentry user context for all subsequent error reports in this request
    try:
        import sentry_sdk
        sentry_sdk.set_user({
            "id": str(user.id),
            "email": user.email,
            "username": user.name,
            "role": user.role.value,
        })
    except Exception:
        pass

    return user


def require_roles(*roles: str):
    """FastAPI dependency factory: restrict endpoint to specific roles.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])
        async def admin_endpoint(): ...

    Or inject the user:
        async def endpoint(user: User = Depends(require_roles("admin", "course_creator"))): ...
    """

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' not authorized. Required: {', '.join(roles)}",
            )
        return current_user

    return role_checker

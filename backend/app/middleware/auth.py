import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.user import User
from app.models.institute import Institute, InstituteStatus
from app.models.enums import UserStatus, UserRole
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

    # Check institute suspension/expiry (skip for super_admin who has no institute)
    if user.role != UserRole.super_admin and user.institute_id is not None:
        institute = await session.get(Institute, user.institute_id)
        if institute:
            if institute.status == InstituteStatus.suspended:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Institute account is suspended",
                )
            if institute.expires_at and institute.expires_at < datetime.now(timezone.utc):
                # Auto-suspend the institute
                institute.status = InstituteStatus.suspended
                session.add(institute)
                await session.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Institute subscription has expired",
                )

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
    """FastAPI dependency factory: restrict endpoint to specific roles."""

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


def get_institute_slug_from_header(request: Request) -> str | None:
    """Read X-Institute-Slug header for public endpoints."""
    return request.headers.get("X-Institute-Slug")


# Role type annotations for dependency injection
SA = Annotated[User, Depends(require_roles("super_admin"))]
Admin = Annotated[User, Depends(require_roles("admin"))]
CC = Annotated[User, Depends(require_roles("course_creator"))]

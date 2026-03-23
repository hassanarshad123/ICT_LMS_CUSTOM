from typing import Annotated
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.schemas.auth import (
    LoginRequest, LoginResponse, RefreshRequest, TokenResponse, RefreshResponse,
    UserBrief, ChangePasswordRequest, LogoutAllResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.config import get_settings
from app.services.auth_service import authenticate_user, refresh_access_token, logout, logout_all
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.institute import Institute
from app.models.batch import StudentBatch, Batch
from app.models.enums import UserRole
from app.utils.security import verify_password, hash_password, create_password_reset_token, create_access_token, create_refresh_token, decode_token
from app.utils.rate_limit import limiter

router = APIRouter()

# Handoff JTI replay prevention is now DB-backed via UserSession.device_info
# (see exchange_handoff below)


async def _build_user_brief(session: AsyncSession, user: User) -> UserBrief:
    batch_ids = []
    batch_names = []
    if user.role == UserRole.student:
        result = await session.execute(
            select(StudentBatch.batch_id, Batch.name)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(
                StudentBatch.student_id == user.id,
                StudentBatch.removed_at.is_(None),
                Batch.deleted_at.is_(None),
            )
        )
        for row in result.all():
            batch_ids.append(str(row[0]))
            batch_names.append(row[1])

    # Resolve institute slug if user belongs to an institute
    institute_slug = None
    if user.institute_id is not None:
        institute = await session.get(Institute, user.institute_id)
        if institute:
            institute_slug = institute.slug

    return UserBrief(
        id=user.id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        role=user.role.value,
        status=user.status.value,
        avatar_url=user.avatar_url,
        batch_ids=batch_ids,
        batch_names=batch_names,
        institute_id=user.institute_id,
        institute_slug=institute_slug,
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_institute_slug: Optional[str] = Header(default=None, alias="X-Institute-Slug"),
):
    # Resolve institute by slug if header is provided
    institute_id = None
    if x_institute_slug:
        result = await session.execute(
            select(Institute).where(
                Institute.slug == x_institute_slug,
                Institute.deleted_at.is_(None),
            )
        )
        institute = result.scalar_one_or_none()
        if not institute:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Institute '{x_institute_slug}' not found",
            )
        institute_id = institute.id

    try:
        user, access_token, refresh_token = await authenticate_user(
            session=session,
            email=body.email,
            password=body.password,
            device_info=body.device_info,
            ip_address=request.client.host if request.client else None,
            institute_id=institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    user_brief = await _build_user_brief(session, user)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_brief,
    )


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("10/minute")
async def refresh(
    request: Request,
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        access_token, refresh_token = await refresh_access_token(session, body.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return RefreshResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout")
async def logout_endpoint(
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await logout(session, body.refresh_token)
    return {"detail": "Logged out successfully"}


@router.post("/logout-all", response_model=LogoutAllResponse)
async def logout_all_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    count = await logout_all(session, current_user.id)
    return LogoutAllResponse(
        detail="All sessions terminated",
        sessions_terminated=count,
    )


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(body.new_password)
    session.add(current_user)
    await session.flush()  # Persist password change within this transaction before logout_all

    # Logout all devices after password change (logout_all increments token_version — Fix 1)
    count = await logout_all(session, current_user.id)

    return {"detail": "Password changed successfully"}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_institute_slug: Optional[str] = Header(default=None, alias="X-Institute-Slug"),
):
    """Request a password reset link. Always returns 200 to prevent email enumeration."""
    settings = get_settings()

    # Resolve institute by slug (same pattern as login)
    institute_id = None
    if x_institute_slug:
        result = await session.execute(
            select(Institute).where(
                Institute.slug == x_institute_slug,
                Institute.deleted_at.is_(None),
            )
        )
        institute = result.scalar_one_or_none()
        if institute:
            institute_id = institute.id

    # Look up user
    query = select(User).where(User.email == body.email, User.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(User.institute_id == institute_id)
    else:
        query = query.where(User.institute_id.is_(None))

    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if user:
        token = create_password_reset_token(user.id, user.token_version)
        # Use tenant-specific domain when slug is provided (Fix 4)
        if x_institute_slug and settings.FRONTEND_BASE_DOMAIN:
            reset_url = f"https://{x_institute_slug}.{settings.FRONTEND_BASE_DOMAIN}/reset-password?token={token}"
        else:
            reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        try:
            from app.utils.email import send_password_reset
            send_password_reset(user.email, user.name, reset_url)
        except Exception:
            pass  # Don't leak email sending errors

    return {"detail": "If an account exists with that email, we've sent a password reset link."}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Reset password using a token from the forgot-password email."""
    payload = decode_token(body.token)
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Reset link has expired or is invalid")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Reset link has expired or is invalid")

    result = await session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Reset link has expired or is invalid")

    # Reject replayed tokens: token_version must match current value
    if payload.get("tv") is not None and payload.get("tv") != user.token_version:
        raise HTTPException(status_code=400, detail="Reset link has expired or is invalid")

    user.hashed_password = hash_password(body.new_password)
    session.add(user)
    # logout_all increments token_version to revoke outstanding access tokens (Fix 1)
    await logout_all(session, user.id)

    return {"detail": "Password has been reset successfully"}


@router.get("/me", response_model=UserBrief)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await _build_user_brief(session, current_user)


@router.post("/handoff-token")
async def create_handoff(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create a one-time handoff token for cross-domain redirect."""
    from app.utils.security import create_handoff_token

    # Resolve institute slug
    institute_slug = None
    if current_user.institute_id:
        institute = await session.get(Institute, current_user.institute_id)
        if institute:
            institute_slug = institute.slug

    if not institute_slug:
        raise HTTPException(status_code=400, detail="User has no associated institute")

    token = create_handoff_token(current_user.id, institute_slug)
    return {
        "handoff_token": token,
        "expires_in": 60,
        "institute_slug": institute_slug,
    }


@router.post("/exchange-handoff")
@limiter.limit("10/minute")
async def exchange_handoff(
    request: Request,
    body: dict,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Exchange a handoff token for real auth tokens (single-use)."""
    token = body.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    payload = decode_token(token)
    if not payload or payload.get("type") != "handoff":
        raise HTTPException(status_code=400, detail="Invalid or expired handoff token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid handoff token")

    # Enforce single-use via DB-backed JTI tracking (survives restarts and multi-worker)
    from app.models.session import UserSession
    import hashlib
    from datetime import datetime, timedelta, timezone

    jti = payload.get("jti")
    if jti:
        existing = await session.execute(
            select(UserSession.id).where(UserSession.device_info == f"handoff:{jti}")
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Invalid or expired handoff token")

    result = await session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid handoff token")

    # Validate slug matches user's institute (prevent cross-institute token exchange)
    token_slug = payload.get("slug")
    if token_slug and user.institute_id:
        institute = await session.get(Institute, user.institute_id)
        if not institute or institute.slug != token_slug:
            raise HTTPException(status_code=400, detail="Invalid handoff token")

    # Create fresh tokens
    access_token = create_access_token(user.id, user.role.value, user.token_version)
    refresh_token, token_id = create_refresh_token(user.id)

    # Create session record (store JTI in device_info for replay prevention)
    hashed_token_id = hashlib.sha256(token_id.encode()).hexdigest()
    device_info_value = f"handoff:{jti}" if jti else "Signup handoff"
    user_session = UserSession(
        user_id=user.id,
        session_token=hashed_token_id,
        device_info=device_info_value,
        ip_address=request.client.host if request.client else None,
        is_active=True,
        logged_in_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        institute_id=user.institute_id,
    )
    session.add(user_session)
    await session.commit()

    user_brief = await _build_user_brief(session, user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_brief.model_dump(),
    }

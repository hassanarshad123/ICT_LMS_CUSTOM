from typing import Annotated
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func
from datetime import date as date_type

from app.database import get_session
from app.schemas.auth import (
    LoginRequest, LoginResponse, RefreshRequest, TokenResponse, RefreshResponse,
    UserBrief, ChangePasswordRequest, LogoutAllResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.schemas.common import MessageResponse
from app.config import get_settings
from app.services.auth_service import (
    authenticate_user,
    refresh_access_token,
    logout,
    logout_all,
    DeviceLimitRequiresApproval,
)
from app.services import device_request_service
from app.services.device_request_service import DeviceRequestError
from app.schemas.device_request import (
    DeviceRequestCreate,
    DeviceRequestCreateResponse,
)
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.institute import Institute
from app.models.batch import StudentBatch, Batch
from app.models.enums import UserRole
from app.utils.security import verify_password, hash_password, create_password_reset_token, create_access_token, create_refresh_token, decode_token
from app.utils.rate_limit import limiter
import uuid

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
                StudentBatch.is_active.is_(True),
                Batch.deleted_at.is_(None),
                func.coalesce(StudentBatch.extended_end_date, Batch.end_date) >= date_type.today(),
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
        email_verified=user.email_verified,
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("15/minute")
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
    except DeviceLimitRequiresApproval as exc:
        # Credentials were valid but the institute is in hard mode and this
        # user is not exempt. Surface a structured 403 so the frontend can
        # swap to the "request access" prompt instead of a generic error.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "device_limit_requires_approval",
                "message": "You have reached your device limit. Request access from an admin.",
                "user_id": str(exc.user.id),
            },
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


@router.post("/logout", response_model=MessageResponse)
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


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Fetch user from DB — hashed_password is not available in cached user objects
    from sqlmodel import select as _select
    result = await session.execute(
        _select(User).where(User.id == current_user.id, User.deleted_at.is_(None))
    )
    db_user = result.scalar_one_or_none()
    if not db_user or not db_user.hashed_password:
        raise HTTPException(status_code=400, detail="Unable to verify current password. Please contact your administrator.")

    if not verify_password(body.current_password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    db_user.hashed_password = hash_password(body.new_password)
    session.add(db_user)
    await session.flush()

    # Logout all devices after password change (logout_all increments token_version)
    count = await logout_all(session, current_user.id)

    return {"detail": "Password changed successfully"}


@router.post("/forgot-password", response_model=MessageResponse)
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

    # Look up user (case-insensitive email)
    forgot_email = body.email.strip().lower()
    query = select(User).where(func.lower(User.email) == forgot_email, User.deleted_at.is_(None))
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
            if user.institute_id:
                from app.utils.email_sender import send_templated_email
                await send_templated_email(
                    session=session, institute_id=user.institute_id, user_id=user.id,
                    email_type="email_password_reset", template_key="password_reset", to=user.email,
                    variables={
                        "user_name": user.name,
                        "reset_url": reset_url,
                    },
                )
            else:
                from app.utils.email import send_password_reset
                send_password_reset(user.email, user.name, reset_url)
        except Exception:
            pass  # Don't leak email sending errors

    return {"detail": "If an account exists with that email, we've sent a password reset link."}


@router.post("/reset-password", response_model=MessageResponse)
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


# ── Email Verification ─────────────────────────────────────────

@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    body: dict,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Verify email address via token from verification email."""
    from app.utils.security import decode_token, create_handoff_token
    from app.models.enums import UserStatus

    token = body.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    payload = decode_token(token)
    if not payload or payload.get("type") != "email_verify":
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")

    user_id = payload.get("sub")
    token_email = payload.get("email")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid token")

    result = await session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Reject replayed tokens: token_version must match current value
    if payload.get("tv") is not None and payload.get("tv") != user.token_version:
        raise HTTPException(status_code=400, detail="Verification link is no longer valid")

    if user.email_verified:
        # Already verified — still return handoff so user can proceed
        pass
    else:
        user.email_verified = True
        # Reactivate if deactivated by the 24h expiry job
        if user.status == UserStatus.inactive:
            user.status = UserStatus.active
        session.add(user)
        await session.commit()

    # Create handoff token for subdomain redirect
    inst_result = await session.execute(
        select(Institute.slug).where(Institute.id == user.institute_id)
    )
    institute_slug = inst_result.scalar_one_or_none() or ""

    handoff_token = create_handoff_token(user.id, institute_slug)
    return {
        "detail": "Email verified successfully",
        "handoff_token": handoff_token,
        "institute_slug": institute_slug,
    }


@router.post("/resend-verification")
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    body: dict,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Resend email verification link. Rate limited to 3/hour."""
    from app.utils.security import create_email_verification_token

    email_addr = (body.get("email") or "").strip().lower()
    if not email_addr:
        raise HTTPException(status_code=400, detail="Email is required")

    settings = get_settings()

    # Find unverified user — don't reveal if email exists
    result = await session.execute(
        select(User).where(
            User.email == email_addr,
            User.email_verified == False,  # noqa: E712
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()

    if user:
        token = create_email_verification_token(user.id, user.email, user.token_version)
        verify_url = f"{settings.FRONTEND_URL or 'https://zensbot.online'}/verify-email?token={token}"

        if user.institute_id:
            try:
                from app.utils.email_sender import send_templated_email
                await send_templated_email(
                    session=session, institute_id=user.institute_id, user_id=user.id,
                    email_type="email_verification", template_key="email_verification", to=user.email,
                    variables={
                        "user_name": user.name,
                        "verification_url": verify_url,
                    },
                )
            except Exception:
                pass  # Don't reveal delivery failure
        else:
            # No institute context — fall back to direct send
            try:
                from app.utils.email import send_email
                from app.utils.email_templates import email_verification_email
                subject, html = email_verification_email(
                    user_name=user.name,
                    verification_url=verify_url,
                )
                send_email(to=user.email, subject=subject, html=html)
            except Exception:
                pass  # Don't reveal delivery failure

    # Always return success (prevents email enumeration)
    return {"detail": "If that email exists and is unverified, a new verification link has been sent."}


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
    if not jti:
        raise HTTPException(status_code=400, detail="Invalid handoff token")

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
    device_info_value = f"handoff:{jti}"
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


# ───────────────────────────── Device limit request flow ────────────────────


@router.post("/device-request", response_model=DeviceRequestCreateResponse)
@limiter.limit("10/hour")
async def create_device_request(
    request: Request,
    body: DeviceRequestCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_institute_slug: Optional[str] = Header(default=None, alias="X-Institute-Slug"),
):
    """Create a device-limit approval request for a user at their hard cap.

    This is called by the login page AFTER /login returns a 403 with
    ``code=device_limit_requires_approval``. We re-validate the credentials
    here so a stolen ``user_id`` alone isn't enough to spam admins.
    """
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

    device_info_header = request.headers.get("user-agent")

    try:
        request_row, polling_token = await device_request_service.create_request(
            session,
            email=body.email,
            password=body.password,
            device_info=device_info_header,
            ip_address=request.client.host if request.client else None,
            institute_id=institute_id,
        )
    except DeviceRequestError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        )

    return DeviceRequestCreateResponse(
        request_id=request_row.id,
        polling_token=polling_token,
    )


@router.get("/device-request/{request_id}/status")
@limiter.limit("30/minute")
async def get_device_request_status(
    request: Request,
    request_id: uuid.UUID,
    polling_token: str,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Poll for the status of a pending device-limit request.

    On the first poll after admin approval this mints the tokens for the
    waiting device and flips status to ``consumed`` so they cannot be
    redeemed again. Protected by a dedicated rate limit.
    """
    try:
        payload = await device_request_service.get_request_status(
            session,
            request_id=request_id,
            polling_token=polling_token,
        )
    except DeviceRequestError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        )
    return payload


@router.post("/impersonation-handover/{handover_id}")
@limiter.limit("20/minute")
async def redeem_impersonation_handover(
    request: Request,
    handover_id: str,
):
    """Redeem a single-use impersonation handover id for the JWT.

    Part of the Phase 4 impersonation hardening: the SA impersonate
    endpoint issues a handover id (stored in Redis) instead of the
    raw token in a URL. The target subdomain's callback page POSTs
    the handover id to this endpoint to exchange it for the JWT
    before the 60-second TTL expires.

    Security properties:
      - Single-use: the Redis key is deleted on first read.
      - Short-lived: 60 seconds.
      - Possession of a valid id is the authorization — no auth
        header required (that's the point: the SA's auth already
        happened when the handover was issued).
      - Rate-limited to 20/min so an attacker cannot brute-force
        the 24-byte urlsafe id space.
    """
    from app.utils.impersonation_handover import redeem
    token = await redeem(handover_id)
    if token is None:
        raise HTTPException(
            status_code=404,
            detail="Handover id is invalid, expired, or already redeemed.",
        )
    return {"access_token": token, "token_type": "Bearer"}

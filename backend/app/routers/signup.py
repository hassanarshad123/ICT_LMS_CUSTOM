import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

import hashlib
from datetime import datetime, timedelta, timezone

from app.database import get_session
from app.schemas.signup import SignupRequest, SignupResponse, SlugCheckResponse
from app.services.signup_service import check_slug_availability, create_institute_with_admin
from app.models.session import UserSession
from app.utils.security import create_access_token, create_refresh_token
from app.utils.rate_limit import limiter
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", response_model=SignupResponse)
@limiter.limit("10/hour")
async def register(
    request: Request,
    background_tasks: BackgroundTasks,
    body: SignupRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Self-service signup: creates institute + admin user."""
    settings = get_settings()

    if not settings.SIGNUP_ENABLED:
        raise HTTPException(status_code=403, detail="Signup is currently disabled")

    # Honeypot check — bots fill hidden fields.
    # Return a schema-valid fake response after delay so bots can't distinguish
    # from a real signup. Uses plausible-looking data that leads to a dead end.
    if body.website:
        import asyncio
        import uuid
        await asyncio.sleep(2)
        fake_id = str(uuid.uuid4())
        return JSONResponse(
            status_code=200,
            content={
                "access_token": "ok",
                "refresh_token": "ok",
                "token_type": "bearer",
                "user": {
                    "id": fake_id,
                    "email": body.email,
                    "name": body.name,
                    "phone": None,
                    "role": "admin",
                    "institute_id": fake_id,
                    "email_verified": False,
                },
                "institute": {
                    "id": fake_id,
                    "name": body.institute_name,
                    "slug": body.institute_slug,
                    "status": "trial",
                    "plan_tier": "free",
                    "expires_at": None,
                },
            },
        )

    # Cloudflare Turnstile CAPTCHA verification
    # Skipped when CF_TURNSTILE_SECRET_KEY is empty (dev/test)
    if settings.CF_TURNSTILE_SECRET_KEY:
        if not body.cf_turnstile_token:
            raise HTTPException(status_code=400, detail="CAPTCHA verification required")
        from app.utils.captcha import verify_turnstile
        is_valid = await verify_turnstile(
            body.cf_turnstile_token,
            remote_ip=request.client.host if request.client else None,
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail="CAPTCHA verification failed")

    try:
        institute, user = await create_institute_with_admin(
            session=session,
            name=body.name,
            email=body.email,
            password=body.password,
            phone=body.phone,
            institute_name=body.institute_name,
            institute_slug=body.institute_slug,
        )
    except ValueError as e:
        # Cooldown violations and duplicate-slug/email checks both raise ValueError.
        # Surface specific messages so the user knows which field to fix.
        msg = str(e)
        if "within the last" in msg and "days" in msg:
            raise HTTPException(status_code=429, detail=msg)
        if "slug" in msg.lower() and "taken" in msg.lower():
            raise HTTPException(
                status_code=409,
                detail="This subdomain is already taken. Please choose a different one.",
            )
        if "email" in msg.lower() and "exists" in msg.lower():
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Please log in instead.",
            )
        raise HTTPException(
            status_code=409,
            detail="Registration failed. Please try a different subdomain or email.",
        )

    # Generate tokens
    settings_obj = get_settings()
    access_token = create_access_token(user.id, user.role.value, user.token_version)
    refresh_token, token_id = create_refresh_token(user.id)

    # Create session record so refresh works
    hashed_token_id = hashlib.sha256(token_id.encode()).hexdigest()
    user_session = UserSession(
        user_id=user.id,
        session_token=hashed_token_id,
        device_info="Signup",
        ip_address=request.client.host if request.client else None,
        is_active=True,
        logged_in_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings_obj.REFRESH_TOKEN_EXPIRE_DAYS),
        institute_id=user.institute_id,
    )
    session.add(user_session)

    # Audit log for self-service signup.
    # admin_email + admin_phone are used by the cooldown check in
    # signup_service._check_signup_cooldown — do not rename these keys
    # without updating the lookup there.
    from app.models.activity import ActivityLog
    signup_log = ActivityLog(
        user_id=user.id,
        action="institute_self_registered",
        entity_type="institute",
        entity_id=institute.id,
        institute_id=institute.id,
        details={
            "institute_name": institute.name,
            "slug": institute.slug,
            "admin_email": user.email,
            "admin_phone": user.phone,
        },
        ip_address=request.client.host if request.client else None,
    )
    session.add(signup_log)
    try:
        await session.commit()
    except Exception as exc:
        logger.error(
            "Failed to create session/activity for user=%s institute=%s: %s",
            user.id,
            institute.id,
            exc,
        )
        await session.rollback()
        # User + institute already exist (committed in service layer).
        # The JWT access token still works; refresh will fail but user
        # can log in normally. Fall through to return the response.

    # Pre-warm the new tenant subdomain so Vercel provisions the wildcard
    # SSL cert before the user clicks the verification email link.
    from app.utils.subdomain_warmup import warmup_subdomain
    background_tasks.add_task(warmup_subdomain, institute.slug)

    # Send email verification (fire-and-forget)
    try:
        from app.utils.security import create_email_verification_token
        from app.utils.email import send_email
        from app.utils.email_templates import email_verification_email

        verify_token = create_email_verification_token(user.id, user.email, user.token_version)
        if settings.FRONTEND_BASE_DOMAIN:
            base_url = f"https://{institute.slug}.{settings.FRONTEND_BASE_DOMAIN}"
        else:
            base_url = settings.FRONTEND_URL or "https://zensbot.online"
        verify_url = f"{base_url}/verify-email?token={verify_token}"
        subject, html = email_verification_email(
            user_name=user.name,
            verification_url=verify_url,
            institute_name=institute.name,
        )
        send_email(to=user.email, subject=subject, html=html)
    except Exception as exc:
        logger.warning(
            "Verification email failed for user=%s email=%s: %s",
            user.id,
            user.email,
            exc,
        )

    return SignupResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "phone": user.phone,
            "role": user.role.value,
            "institute_id": str(user.institute_id),
            "email_verified": False,
        },
        institute={
            "id": str(institute.id),
            "name": institute.name,
            "slug": institute.slug,
            "status": institute.status.value,
            "plan_tier": institute.plan_tier.value,
            "expires_at": institute.expires_at.isoformat() if institute.expires_at else None,
        },
    )


@router.get("/check-slug", response_model=SlugCheckResponse)
@limiter.limit("20/minute")
async def check_slug(
    request: Request,
    slug: str = Query(..., min_length=3, max_length=30),
    session: Annotated[AsyncSession, Depends(get_session)] = None,
):
    """Check if an institute slug is available."""
    available, reason = await check_slug_availability(session, slug)
    # Don't reveal "already taken" — prevents institute enumeration
    safe_reason = reason if available else "This slug is not available"
    return SlugCheckResponse(slug=slug, available=available, reason=safe_reason)

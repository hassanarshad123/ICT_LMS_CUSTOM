from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.signup import SignupRequest, SignupResponse, SlugCheckResponse
from app.services.signup_service import check_slug_availability, create_institute_with_admin
from app.utils.security import create_access_token, create_refresh_token
from app.utils.rate_limit import limiter
from app.config import get_settings

router = APIRouter()


@router.post("/register", response_model=SignupResponse)
@limiter.limit("3/hour")
async def register(
    request: Request,
    body: SignupRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Self-service signup: creates institute + admin user."""
    settings = get_settings()

    if not settings.SIGNUP_ENABLED:
        raise HTTPException(status_code=403, detail="Signup is currently disabled")

    # Honeypot check — bots fill hidden fields
    if body.website:
        return SignupResponse(
            access_token="ok",
            refresh_token="ok",
            user={"id": "00000000-0000-0000-0000-000000000000"},
            institute={"id": "00000000-0000-0000-0000-000000000000"},
        )

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
        raise HTTPException(status_code=409, detail=str(e))

    # Generate tokens
    access_token = create_access_token(user.id, user.role.value, user.token_version)
    refresh_token, _ = create_refresh_token(user.id)

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
    return SlugCheckResponse(slug=slug, available=available, reason=reason)

"""Public branding endpoints + admin branding management."""

import base64
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.utils.rate_limit import limiter

from app.database import get_session
from app.middleware.auth import require_roles, get_institute_slug_from_header
from app.models.settings import SystemSetting
from app.models.user import User
from app.models.institute import Institute
from app.schemas.branding import (
    BrandingResponse, BrandingUpdate,
    CertificateDesignResponse, CertificateDesignUpdate,
)

router = APIRouter()

Admin = Annotated[User, Depends(require_roles("admin"))]

PRESET_THEMES = {
    "default":      {"primary": "#1A1A1A", "accent": "#C5D86D", "background": "#F0F0F0"},
    "ocean_blue":   {"primary": "#0F2B46", "accent": "#38BDF8", "background": "#F0F4F8"},
    "royal_purple": {"primary": "#2D1B4E", "accent": "#A78BFA", "background": "#F5F0FF"},
    "forest_green": {"primary": "#1A2E1A", "accent": "#4ADE80", "background": "#F0F5F0"},
    "warm_orange":  {"primary": "#2D1A0E", "accent": "#FB923C", "background": "#FFF7F0"},
    "classic_red":  {"primary": "#2D1A1A", "accent": "#F87171", "background": "#FFF0F0"},
}

BRANDING_KEYS = {
    "branding_primary_color":  "primary_color",
    "branding_accent_color":   "accent_color",
    "branding_background_color": "background_color",
    "branding_institute_name": "institute_name",
    "branding_tagline":        "tagline",
    "branding_logo_url":       "logo_url",
    "branding_favicon_url":    "favicon_url",
    "branding_preset_theme":   "preset_theme",
    "branding_watermark_enabled": "watermark_enabled",
}

DEFAULTS = BrandingResponse()

MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2MB


def _field_to_key(field: str) -> str:
    return f"branding_{field}"


async def _resolve_institute_id(
    request: Request, session: AsyncSession,
) -> Optional[uuid.UUID]:
    """Resolve institute_id from X-Institute-Slug header for public endpoints."""
    slug = get_institute_slug_from_header(request)
    if not slug:
        return None
    result = await session.execute(
        select(Institute.id).where(Institute.slug == slug, Institute.deleted_at.is_(None))
    )
    institute_id = result.scalar_one_or_none()
    return institute_id


@router.get("/institutes")
@limiter.limit("10/minute")
async def list_public_institutes(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Public endpoint — returns name and slug of all active/trial institutes."""
    result = await session.execute(
        select(Institute.name, Institute.slug).where(
            Institute.status.in_(["active", "trial"]),
            Institute.deleted_at.is_(None),
        ).order_by(Institute.name)
    )
    return [{"name": row.name, "slug": row.slug} for row in result.all()]


@router.get("", response_model=BrandingResponse)
async def get_branding(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Public endpoint — returns all branding settings with defaults. Cached for 1 hour."""
    from app.core.cache import cache

    institute_id = await _resolve_institute_id(request, session)
    cache_key = cache.branding_key(str(institute_id) if institute_id else None)

    # Try cache first (with validation — corrupt cache falls through to DB)
    cached = await cache.get(cache_key)
    if cached is not None:
        try:
            return BrandingResponse(**cached)
        except Exception:
            await cache.delete(cache_key)

    query = select(SystemSetting).where(
        SystemSetting.setting_key.in_(list(BRANDING_KEYS.keys()))
    )
    if institute_id:
        query = query.where(SystemSetting.institute_id == institute_id)
    else:
        query = query.where(SystemSetting.institute_id.is_(None))

    result = await session.execute(query)
    settings = {s.setting_key: s.value for s in result.scalars().all()}

    data = {}
    for db_key, field_name in BRANDING_KEYS.items():
        value = settings.get(db_key)
        if value is not None:
            # Convert string booleans for bool fields
            if field_name == "watermark_enabled":
                data[field_name] = value.lower() != "false"
            else:
                data[field_name] = value
        else:
            data[field_name] = getattr(DEFAULTS, field_name)

    # Cache for 1 hour
    await cache.set(cache_key, data, ttl=3600)

    return BrandingResponse(**data)


@router.patch("", response_model=BrandingResponse)
@limiter.limit("10/hour")
async def update_branding(
    request: Request,
    body: BrandingUpdate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Admin only — upsert branding keys into SystemSetting."""
    institute_id = current_user.institute_id
    update_data = body.model_dump(exclude_none=True)

    for field_name, value in update_data.items():
        db_key = _field_to_key(field_name)
        result = await session.execute(
            select(SystemSetting).where(
                SystemSetting.setting_key == db_key,
                SystemSetting.institute_id == institute_id,
            )
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
            setting.updated_at = datetime.now(timezone.utc)
            session.add(setting)
        else:
            session.add(SystemSetting(setting_key=db_key, value=str(value), institute_id=institute_id))

    await session.commit()

    # Invalidate branding cache
    from app.core.cache import cache
    await cache.delete(cache.branding_key(str(institute_id)))

    return await get_branding(request, session)


@router.post("/logo-upload")
@limiter.limit("10/hour")
async def upload_logo(
    request: Request,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    file: UploadFile = File(...),
):
    """Admin only — upload logo directly, stored as base64 data URL in DB."""
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Missing content type")

    allowed_types = {
        "image/png", "image/svg+xml", "image/jpeg", "image/webp",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. Use PNG, SVG, JPG, or WebP.",
        )

    contents = await file.read()
    if len(contents) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="Logo must be under 2MB")

    # Convert to data URL
    b64 = base64.b64encode(contents).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64}"

    # Upsert into SystemSetting
    institute_id = current_user.institute_id
    db_key = "branding_logo_url"
    result = await session.execute(
        select(SystemSetting).where(
            SystemSetting.setting_key == db_key,
            SystemSetting.institute_id == institute_id,
        )
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = data_url
        setting.updated_at = datetime.now(timezone.utc)
        session.add(setting)
    else:
        session.add(SystemSetting(setting_key=db_key, value=data_url, institute_id=institute_id))

    await session.commit()

    # Invalidate branding cache
    from app.core.cache import cache
    await cache.delete(cache.branding_key(str(institute_id)))

    return {"logo_url": data_url}


@router.get("/preset-themes")
async def get_preset_themes():
    """Public — returns available preset themes."""
    return PRESET_THEMES


# ── Certificate Design ────────────────────────────────────────────────

CERT_KEYS = {
    "cert_primary_color":  "primary_color",
    "cert_accent_color":   "accent_color",
    "cert_institute_name": "institute_name",
    "cert_website_url":    "website_url",
    "cert_logo_url":       "logo_url",
    "cert_title":          "title",
    "cert_body_line1":     "body_line1",
    "cert_body_line2":     "body_line2",
    "cert_sig1_label":     "sig1_label",
    "cert_sig1_name":      "sig1_name",
    "cert_sig1_image":     "sig1_image",
    "cert_sig2_label":     "sig2_label",
    "cert_sig2_name":      "sig2_name",
    "cert_sig2_image":     "sig2_image",
    "cert_id_prefix":      "id_prefix",
    "cert_border_style":   "border_style",
}

CERT_DEFAULTS = CertificateDesignResponse()
MAX_SIG_SIZE = 1 * 1024 * 1024  # 1MB


async def get_certificate_design_dict(session: AsyncSession, institute_id: Optional[uuid.UUID] = None) -> dict:
    """Load all cert_* settings and return as a plain dict with defaults."""
    query = select(SystemSetting).where(
        SystemSetting.setting_key.in_(list(CERT_KEYS.keys()))
    )
    if institute_id:
        query = query.where(SystemSetting.institute_id == institute_id)
    else:
        query = query.where(SystemSetting.institute_id.is_(None))

    result = await session.execute(query)
    settings = {s.setting_key: s.value for s in result.scalars().all()}

    data = {}
    for db_key, field_name in CERT_KEYS.items():
        value = settings.get(db_key)
        if value is not None:
            data[field_name] = value
        else:
            data[field_name] = getattr(CERT_DEFAULTS, field_name)
    return data


@router.get("/certificate-design", response_model=CertificateDesignResponse)
async def get_certificate_design(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Public endpoint — returns all certificate design settings with defaults."""
    institute_id = await _resolve_institute_id(request, session)
    data = await get_certificate_design_dict(session, institute_id)
    return CertificateDesignResponse(**data)


@router.patch("/certificate-design", response_model=CertificateDesignResponse)
@limiter.limit("10/hour")
async def update_certificate_design(
    request: Request,
    body: CertificateDesignUpdate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Admin only — upsert cert design keys into SystemSetting."""
    institute_id = current_user.institute_id
    update_data = body.model_dump(exclude_none=True)

    for field_name, value in update_data.items():
        db_key = f"cert_{field_name}"
        result = await session.execute(
            select(SystemSetting).where(
                SystemSetting.setting_key == db_key,
                SystemSetting.institute_id == institute_id,
            )
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
            setting.updated_at = datetime.now(timezone.utc)
            session.add(setting)
        else:
            session.add(SystemSetting(setting_key=db_key, value=str(value), institute_id=institute_id))

    await session.commit()

    return await get_certificate_design(request, session)


@router.post("/signature-upload")
@limiter.limit("10/hour")
async def upload_signature(
    request: Request,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    file: UploadFile = File(...),
    position: int = Query(..., ge=1, le=2),
):
    """Admin only — upload signature image (PNG/JPG, max 1MB), stored as base64 data URL."""
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Missing content type")

    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. Use PNG, JPG, or WebP.",
        )

    contents = await file.read()
    if len(contents) > MAX_SIG_SIZE:
        raise HTTPException(status_code=400, detail="Signature image must be under 1MB")

    b64 = base64.b64encode(contents).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64}"

    institute_id = current_user.institute_id
    db_key = f"cert_sig{position}_image"
    result = await session.execute(
        select(SystemSetting).where(
            SystemSetting.setting_key == db_key,
            SystemSetting.institute_id == institute_id,
        )
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = data_url
        setting.updated_at = datetime.now(timezone.utc)
        session.add(setting)
    else:
        session.add(SystemSetting(setting_key=db_key, value=data_url, institute_id=institute_id))

    await session.commit()

    return {"image_url": data_url, "position": position}

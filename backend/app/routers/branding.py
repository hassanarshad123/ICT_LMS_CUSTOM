"""Public branding endpoints + admin branding management."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.other import SystemSetting
from app.models.user import User
from app.schemas.branding import BrandingResponse, BrandingUpdate, LogoUploadResponse
from app.utils.s3 import generate_download_url, delete_object

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
}

DEFAULTS = BrandingResponse()


def _field_to_key(field: str) -> str:
    return f"branding_{field}"


@router.get("/", response_model=BrandingResponse)
async def get_branding(
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Public endpoint — returns all branding settings with defaults."""
    result = await session.execute(
        select(SystemSetting).where(
            SystemSetting.setting_key.in_(list(BRANDING_KEYS.keys()))
        )
    )
    settings = {s.setting_key: s.value for s in result.scalars().all()}

    data = {}
    for db_key, field_name in BRANDING_KEYS.items():
        value = settings.get(db_key)
        if value is not None:
            data[field_name] = value
        else:
            data[field_name] = getattr(DEFAULTS, field_name)

    # Generate presigned download URL for logo if it's an S3 key
    if data.get("logo_url") and not data["logo_url"].startswith("http"):
        try:
            data["logo_url"] = generate_download_url(data["logo_url"], "logo.png", expires_in=86400)
        except Exception:
            data["logo_url"] = None

    if data.get("favicon_url") and not data["favicon_url"].startswith("http"):
        try:
            data["favicon_url"] = generate_download_url(data["favicon_url"], "favicon.png", expires_in=86400)
        except Exception:
            data["favicon_url"] = None

    return BrandingResponse(**data)


@router.patch("/", response_model=BrandingResponse)
async def update_branding(
    body: BrandingUpdate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Admin only — upsert branding keys into SystemSetting."""
    from datetime import datetime, timezone

    update_data = body.model_dump(exclude_none=True)

    for field_name, value in update_data.items():
        db_key = _field_to_key(field_name)
        result = await session.execute(
            select(SystemSetting).where(SystemSetting.setting_key == db_key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
            setting.updated_at = datetime.now(timezone.utc)
            session.add(setting)
        else:
            session.add(SystemSetting(setting_key=db_key, value=str(value)))

    await session.commit()

    # Return updated branding
    return await get_branding(session)


@router.post("/logo-upload", response_model=LogoUploadResponse)
async def get_logo_upload_url(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    file_ext: str = "png",
):
    """Admin only — returns presigned S3 upload URL for logo."""
    allowed_extensions = {"png", "svg", "jpg", "jpeg", "webp"}
    file_ext = file_ext.lower().strip(".")
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file_ext}' not allowed. Use: {', '.join(allowed_extensions)}",
        )

    content_type_map = {
        "png": "image/png",
        "svg": "image/svg+xml",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
    }

    # Delete old logo if exists
    result = await session.execute(
        select(SystemSetting).where(SystemSetting.setting_key == "branding_logo_url")
    )
    old_setting = result.scalar_one_or_none()
    if old_setting and old_setting.value and not old_setting.value.startswith("http"):
        try:
            delete_object(old_setting.value)
        except Exception:
            pass

    # Generate presigned upload URL
    from app.utils.s3 import _get_client
    from app.config import get_settings

    s3_settings = get_settings()
    client = _get_client()
    object_key = f"branding/logo_{uuid.uuid4()}.{file_ext}"

    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": s3_settings.S3_BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type_map[file_ext],
        },
        ExpiresIn=3600,
    )

    return LogoUploadResponse(upload_url=upload_url, object_key=object_key)


@router.get("/preset-themes")
async def get_preset_themes():
    """Public — returns available preset themes."""
    return PRESET_THEMES

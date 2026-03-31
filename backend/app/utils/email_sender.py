"""Background email sending with institute branding support."""
import logging
import threading
import uuid
from typing import Optional

from app.utils.email import send_email

logger = logging.getLogger("ict_lms.email")


def send_email_background(
    to: str,
    subject: str,
    html: str,
    from_name: Optional[str] = None,
) -> None:
    """Fire-and-forget email via daemon thread."""
    def _send():
        try:
            send_email(to, subject, html, from_name=from_name)
            logger.info("Email sent to %s: %s", to, subject)
        except Exception as e:
            logger.error("Failed to send email to %s: %s", to, e)

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()


async def get_institute_branding(session, institute_id: uuid.UUID) -> dict:
    """Load institute branding from SystemSettings + Institute model.

    Returns: {name, slug, logo_url, accent_color}
    """
    from sqlmodel import select
    from app.models.settings import SystemSetting
    from app.models.institute import Institute

    result = {"name": "", "slug": "", "logo_url": None, "accent_color": "#C5D86D"}

    try:
        inst = await session.get(Institute, institute_id)
        if inst:
            result["name"] = inst.name
            result["slug"] = inst.slug
    except Exception:
        pass

    # Load branding settings
    keys = ["branding_institute_name", "branding_logo", "branding_primary_color"]
    try:
        r = await session.execute(
            select(SystemSetting).where(
                SystemSetting.institute_id == institute_id,
                SystemSetting.setting_key.in_(keys),
            )
        )
        for setting in r.scalars().all():
            if setting.setting_key == "branding_institute_name" and setting.value:
                result["name"] = setting.value
            elif setting.setting_key == "branding_logo" and setting.value:
                result["logo_url"] = setting.value
            elif setting.setting_key == "branding_primary_color" and setting.value:
                result["accent_color"] = setting.value
    except Exception:
        pass

    return result


# ── Email preference checks ─────────────────────────────────────

_CRITICAL_EMAILS = {"email_welcome", "email_certificate"}


async def is_email_enabled(session, institute_id: uuid.UUID, email_type: str) -> bool:
    """Check if admin has this email type enabled at institute level.
    Default: True (all enabled if no setting exists).
    """
    from sqlmodel import select
    from app.models.settings import SystemSetting

    try:
        r = await session.execute(
            select(SystemSetting.value).where(
                SystemSetting.setting_key == email_type,
                SystemSetting.institute_id == institute_id,
            )
        )
        val = r.scalar_one_or_none()
        if val is not None:
            return val.lower() != "false"
    except Exception:
        pass
    return True  # Default enabled


async def is_user_subscribed(session, user_id: uuid.UUID, email_type: str) -> bool:
    """Check if user has opted out of this email type.
    Default: True (subscribed if no preference row exists).
    """
    from sqlalchemy import text

    try:
        r = await session.execute(
            text("SELECT subscribed FROM user_email_preferences WHERE user_id = :uid AND email_type = :et"),
            {"uid": str(user_id), "et": email_type},
        )
        row = r.one_or_none()
        if row is not None:
            return bool(row[0])
    except Exception:
        pass
    return True  # Default subscribed


async def should_send_email(
    session, institute_id: uuid.UUID, user_id: uuid.UUID, email_type: str
) -> bool:
    """Combined check: admin enabled AND (critical OR user subscribed)."""
    if not await is_email_enabled(session, institute_id, email_type):
        return False
    if email_type in _CRITICAL_EMAILS:
        return True
    return await is_user_subscribed(session, user_id, email_type)


def build_login_url(slug: str) -> str:
    return f"https://{slug}.zensbot.online/login"


def build_reset_url(slug: str) -> str:
    return f"https://{slug}.zensbot.online/forgot-password"


def build_portal_url(slug: str, user_id: str, path: str = "") -> str:
    return f"https://{slug}.zensbot.online/{user_id}/{path}"

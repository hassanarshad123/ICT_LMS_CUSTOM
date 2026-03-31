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


def build_login_url(slug: str) -> str:
    return f"https://{slug}.zensbot.online/login"


def build_reset_url(slug: str) -> str:
    return f"https://{slug}.zensbot.online/forgot-password"


def build_portal_url(slug: str, user_id: str, path: str = "") -> str:
    return f"https://{slug}.zensbot.online/{user_id}/{path}"

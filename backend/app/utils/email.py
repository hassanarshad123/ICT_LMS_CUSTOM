"""Email sending via Resend with optional institute branding."""
import uuid
from typing import Optional

import resend

from app.config import get_settings

settings = get_settings()


def _init():
    resend.api_key = settings.RESEND_API_KEY


async def _get_institute_name(institute_id: uuid.UUID) -> str | None:
    """Load institute branding name from SystemSetting. Best-effort, returns None on failure."""
    try:
        from sqlmodel import select
        from app.database import async_session
        from app.models.settings import SystemSetting

        async with async_session() as session:
            result = await session.execute(
                select(SystemSetting).where(
                    SystemSetting.setting_key == "branding_institute_name",
                    SystemSetting.institute_id == institute_id,
                )
            )
            setting = result.scalar_one_or_none()
            if setting:
                return setting.value
    except Exception:
        pass
    return None


def _build_from(from_name: str | None) -> str:
    """Build the 'from' address string, using a custom name if provided."""
    if from_name:
        # Extract the email portion from settings.EMAIL_FROM
        # Format is typically "Name <email@domain>" or just "email@domain"
        base = settings.EMAIL_FROM
        if "<" in base:
            email_part = base[base.index("<"):]
            return f"{from_name} {email_part}"
        else:
            return f"{from_name} <{base}>"
    return settings.EMAIL_FROM


def send_email(
    to: str,
    subject: str,
    html: str,
    from_name: Optional[str] = None,
) -> None:
    _init()
    resend.Emails.send({
        "from": _build_from(from_name),
        "to": [to],
        "subject": subject,
        "html": html,
    })


async def send_email_for_institute(
    to: str,
    subject: str,
    html: str,
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    """Send an email with the institute's branding name as the sender display name."""
    from_name = None
    if institute_id:
        from_name = await _get_institute_name(institute_id)
    send_email(to, subject, html, from_name=from_name)


def send_zoom_reminder(
    to: str,
    class_title: str,
    meeting_url: str,
    scheduled_time: str,
    from_name: Optional[str] = None,
) -> None:
    html = f"""
    <h2>Zoom Class Reminder</h2>
    <p>Your class <strong>{class_title}</strong> is starting soon.</p>
    <p>Scheduled time: {scheduled_time}</p>
    <p><a href="{meeting_url}">Join Meeting</a></p>
    """
    send_email(to, f"Reminder: {class_title}", html, from_name=from_name)


def send_password_reset(
    to: str,
    name: str,
    reset_link: str,
    from_name: Optional[str] = None,
) -> None:
    html = f"""
    <h2>Password Reset</h2>
    <p>Hi {name},</p>
    <p>We received a request to reset your password. Click the link below to set a new password:</p>
    <p><a href="{reset_link}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a></p>
    <p style="margin-top: 16px; font-size: 14px; color: #666;">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
    """
    send_email(to, "Password Reset", html, from_name=from_name)

"""Email sending via Resend."""
import resend

from app.config import get_settings

settings = get_settings()


def _init():
    resend.api_key = settings.RESEND_API_KEY


def send_email(to: str, subject: str, html: str) -> None:
    _init()
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
    })


def send_zoom_reminder(to: str, class_title: str, meeting_url: str, scheduled_time: str) -> None:
    html = f"""
    <h2>Zoom Class Reminder</h2>
    <p>Your class <strong>{class_title}</strong> is starting soon.</p>
    <p>Scheduled time: {scheduled_time}</p>
    <p><a href="{meeting_url}">Join Meeting</a></p>
    """
    send_email(to, f"Reminder: {class_title}", html)


def send_password_reset(to: str, name: str, temp_password: str) -> None:
    html = f"""
    <h2>Password Reset</h2>
    <p>Hi {name},</p>
    <p>Your password has been reset. Your new temporary password is:</p>
    <p style="font-size: 20px; font-weight: bold;">{temp_password}</p>
    <p>Please change your password after logging in.</p>
    """
    send_email(to, "Password Reset - ICT LMS", html)

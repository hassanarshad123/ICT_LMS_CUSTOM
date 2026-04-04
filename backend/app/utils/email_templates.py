"""Branded HTML email templates for all student lifecycle events."""
from html import escape as _e
from typing import Optional


def _base_template(
    body: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
    login_url: str = "",
) -> str:
    """Wrap email body in branded template with header + footer."""
    logo_html = ""
    if logo_url and logo_url.startswith(("http", "data:")):
        logo_html = f'<img src="{logo_url}" alt="{institute_name}" style="height:40px;margin-right:12px;" />'

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- Accent Bar -->
<tr><td style="background-color:{accent_color};height:6px;border-radius:8px 8px 0 0;"></td></tr>

<!-- Header -->
<tr><td style="background-color:#ffffff;padding:24px 32px 16px;border-bottom:1px solid #e4e4e7;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td>{logo_html}<span style="font-size:18px;font-weight:bold;color:#1a1a1a;">{institute_name}</span></td>
</tr>
</table>
</td></tr>

<!-- Body -->
<tr><td style="background-color:#ffffff;padding:24px 32px;">
{body}
</td></tr>

<!-- Footer -->
<tr><td style="background-color:#fafafa;padding:16px 32px;border-top:1px solid #e4e4e7;border-radius:0 0 8px 8px;">
<p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
{institute_name}
{f' &middot; <a href="{login_url}" style="color:#a1a1aa;">Login to your account</a>' if login_url else ''}
</p>
<p style="margin:4px 0 0;font-size:11px;color:#d4d4d8;text-align:center;">
This is an automated message. Please do not reply directly to this email.
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""


def _button(text: str, url: str, color: str = "#1a1a1a") -> str:
    return f'<a href="{url}" style="display:inline-block;padding:12px 28px;background-color:{color};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">{text}</a>'


# ── 1. Welcome Email ────────────────────────────────────────────

def welcome_email(
    student_name: str,
    email: str,
    default_password: str,
    login_url: str,
    reset_url: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Welcome, {student_name}!</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Your account has been created at <strong>{institute_name}</strong>. Here are your login details:
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Email</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{email}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Password</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{default_password}</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
{_button("Login to Your Account", login_url, accent_color)}
</p>
<p style="color:#71717a;font-size:13px;margin-top:20px;">
For security, we recommend changing your password after your first login.
<a href="{reset_url}" style="color:{accent_color};">Reset your password here</a>.
</p>
"""
    return (
        f"Welcome to {institute_name}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 2. Enrollment Confirmation ──────────────────────────────────

def enrollment_email(
    student_name: str,
    batch_name: str,
    start_date: str,
    end_date: str,
    teacher_name: Optional[str],
    login_url: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    teacher_row = f'<tr><td style="color:#71717a;font-size:13px;">Teacher</td><td style="color:#1a1a1a;font-size:14px;">{teacher_name}</td></tr>' if teacher_name else ""
    body = f"""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">You've Been Enrolled!</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {student_name}, you have been enrolled in a new batch:
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Batch</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{batch_name}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Start Date</td><td style="color:#1a1a1a;font-size:14px;">{start_date}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">End Date</td><td style="color:#1a1a1a;font-size:14px;">{end_date}</td></tr>
{teacher_row}
</table>
<p style="margin:20px 0;text-align:center;">
{_button("Go to Your Dashboard", login_url, accent_color)}
</p>
"""
    return (
        f"Enrolled in {batch_name}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 3 & 4. Batch Expiry Warning ─────────────────────────────────

def batch_expiry_warning_email(
    student_name: str,
    batch_name: str,
    days_remaining: int,
    end_date: str,
    login_url: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    urgency = "tomorrow" if days_remaining <= 1 else f"in {days_remaining} days"
    color = "#DC2626" if days_remaining <= 1 else "#F59E0B"
    body = f"""
<h2 style="margin:0 0 8px;color:{color};font-size:22px;">Batch Access Expiring Soon</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {student_name}, your access to <strong>{batch_name}</strong> expires <strong>{urgency}</strong>.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:120px;">Batch</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{batch_name}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Expires On</td><td style="color:{color};font-size:14px;font-weight:bold;">{end_date}</td></tr>
</table>
<p style="color:#52525b;font-size:14px;">Make sure to complete your pending lectures and quizzes before access ends.</p>
<p style="margin:20px 0;text-align:center;">
{_button("Continue Learning", login_url, accent_color)}
</p>
"""
    return (
        f"Batch access expiring {urgency} - {batch_name}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 5. Batch Expired ────────────────────────────────────────────

def batch_expired_email(
    student_name: str,
    batch_name: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#DC2626;font-size:22px;">Batch Access Expired</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {student_name}, your access to <strong>{batch_name}</strong> has expired.
</p>
<p style="color:#52525b;font-size:14px;">
If you believe this is an error or need an extension, please contact your institute administrator.
</p>
"""
    return (
        f"Batch access expired - {batch_name}",
        _base_template(body, institute_name, logo_url, accent_color),
    )


# ── 6. Certificate Issued ───────────────────────────────────────

def certificate_issued_email(
    student_name: str,
    course_name: str,
    cert_id: str,
    verification_code: str,
    portal_url: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Congratulations, {student_name}!</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Your certificate for <strong>{course_name}</strong> has been issued.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:140px;">Certificate ID</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{cert_id}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Verification Code</td><td style="color:#1a1a1a;font-size:14px;font-family:monospace;">{verification_code}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Course</td><td style="color:#1a1a1a;font-size:14px;">{course_name}</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
{_button("View Certificate", portal_url, accent_color)}
</p>
"""
    return (
        f"Certificate Issued - {course_name}",
        _base_template(body, institute_name, logo_url, accent_color, portal_url),
    )


# ── 7. Announcement ─────────────────────────────────────────────

def announcement_email(
    student_name: str,
    title: str,
    content: str,
    posted_by: str,
    scope_label: str,
    login_url: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">{title}</h2>
<p style="color:#71717a;font-size:12px;margin-bottom:16px;">
Posted by {posted_by} &middot; {scope_label}
</p>
<div style="color:#52525b;font-size:15px;line-height:1.6;border-left:3px solid {accent_color};padding-left:16px;margin:16px 0;">
{content}
</div>
<p style="margin:20px 0;text-align:center;">
{_button("View in Portal", login_url, accent_color)}
</p>
"""
    return (
        f"Announcement: {title}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 8. Quiz Graded ──────────────────────────────────────────────

def quiz_graded_email(
    student_name: str,
    quiz_title: str,
    score: int,
    max_score: int,
    percentage: float,
    passed: bool,
    login_url: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    result_color = "#16A34A" if passed else "#DC2626"
    result_text = "Passed" if passed else "Not Passed"
    body = f"""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Quiz Results Available</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {student_name}, your quiz <strong>{quiz_title}</strong> has been graded.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Quiz</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{quiz_title}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Score</td><td style="color:#1a1a1a;font-size:14px;">{score}/{max_score} ({percentage:.0f}%)</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Result</td><td style="color:{result_color};font-size:14px;font-weight:bold;">{result_text}</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
{_button("View Detailed Results", login_url, accent_color)}
</p>
"""
    return (
        f"Quiz Graded: {quiz_title} - {result_text}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 9. Class Scheduled ─────────────────────────────────────────

def class_scheduled_email(
    student_name: str,
    class_title: str,
    batch_name: str,
    teacher_name: str,
    scheduled_date: str,
    scheduled_time: str,
    duration: int,
    login_url: str = "",
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">New Class Scheduled</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {_e(student_name)}, a new live class has been scheduled for your batch.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Class</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{_e(class_title)}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Batch</td><td style="color:#1a1a1a;font-size:14px;">{_e(batch_name)}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Teacher</td><td style="color:#1a1a1a;font-size:14px;">{_e(teacher_name)}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Date</td><td style="color:#1a1a1a;font-size:14px;">{scheduled_date}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Time</td><td style="color:#1a1a1a;font-size:14px;">{scheduled_time}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Duration</td><td style="color:#1a1a1a;font-size:14px;">{duration} minutes</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
{_button("View Classes", login_url, accent_color)}
</p>
"""
    return (
        f"New Class: {class_title} on {scheduled_date}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 10. Class Live ────────────────────────────────────────────

def class_live_email(
    student_name: str,
    class_title: str,
    join_url: str,
    login_url: str = "",
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#16A34A;font-size:22px;">Class is LIVE!</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {_e(student_name)}, <strong>{_e(class_title)}</strong> is happening right now. Join before you miss it!
</p>
<p style="margin:24px 0;text-align:center;">
{_button("Join Class Now", join_url, "#16A34A")}
</p>
<p style="color:#a1a1aa;font-size:12px;text-align:center;">
If the button doesn't work, copy this link into your browser:<br>
<a href="{join_url}" style="color:#6366f1;word-break:break-all;">{join_url}</a>
</p>
"""
    return (
        f"LIVE NOW: {class_title}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 11. Class Cancelled ───────────────────────────────────────

def class_cancelled_email(
    student_name: str,
    class_title: str,
    batch_name: str,
    scheduled_date: str,
    scheduled_time: str,
    login_url: str = "",
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#DC2626;font-size:22px;">Class Cancelled</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {_e(student_name)}, the following class has been cancelled:
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Class</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{_e(class_title)}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Batch</td><td style="color:#1a1a1a;font-size:14px;">{_e(batch_name)}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Was Scheduled</td><td style="color:#DC2626;font-size:14px;">{scheduled_date} at {scheduled_time}</td></tr>
</table>
<p style="color:#52525b;font-size:14px;">
If you have any questions, please contact your instructor or administrator.
</p>
"""
    return (
        f"Class Cancelled: {class_title}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 12. Class Rescheduled ─────────────────────────────────────

def class_rescheduled_email(
    student_name: str,
    class_title: str,
    batch_name: str,
    old_date: str,
    old_time: str,
    new_date: str,
    new_time: str,
    duration: int,
    login_url: str = "",
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#F59E0B;font-size:22px;">Class Rescheduled</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {_e(student_name)}, a class in <strong>{_e(batch_name)}</strong> has been moved to a new time:
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:120px;">Class</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{_e(class_title)}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Previous Time</td><td style="color:#DC2626;font-size:14px;text-decoration:line-through;">{old_date} at {old_time}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">New Time</td><td style="color:#16A34A;font-size:14px;font-weight:bold;">{new_date} at {new_time}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Duration</td><td style="color:#1a1a1a;font-size:14px;">{duration} minutes</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
{_button("View Updated Schedule", login_url, accent_color)}
</p>
"""
    return (
        f"Class Rescheduled: {class_title}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 13. Recording Available ───────────────────────────────────

def recording_available_email(
    student_name: str,
    class_title: str,
    login_url: str = "",
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Recording Available</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {_e(student_name)}, the recording for <strong>{_e(class_title)}</strong> is now ready to watch.
</p>
<p style="color:#52525b;font-size:14px;">
You can watch it anytime from your classes page.
</p>
<p style="margin:24px 0;text-align:center;">
{_button("Watch Recording", login_url, accent_color)}
</p>
"""
    return (
        f"Recording Ready: {class_title}",
        _base_template(body, institute_name, logo_url, accent_color, login_url),
    )


# ── 14. Email Verification ──────────────────────────────────────

def email_verification_email(
    user_name: str,
    verification_url: str,
    institute_name: str = "",
    logo_url: Optional[str] = None,
    accent_color: str = "#C5D86D",
) -> tuple[str, str]:
    body = f"""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Verify Your Email</h2>
<p style="color:#52525b;font-size:14px;line-height:1.6;">
Hi {user_name}, welcome to <strong>{institute_name or 'your LMS'}</strong>!
Please verify your email address to fully activate your account.
</p>
<p style="color:#52525b;font-size:14px;line-height:1.6;">
You can use your LMS for the next 24 hours, but after that your account
will be deactivated until you verify.
</p>
<div style="text-align:center;margin:24px 0;">
{_button("Verify Email", verification_url, accent_color)}
</div>
<p style="color:#a1a1aa;font-size:12px;">
If the button doesn't work, copy and paste this link into your browser:<br>
<a href="{verification_url}" style="color:#6366f1;word-break:break-all;">{verification_url}</a>
</p>
<p style="color:#a1a1aa;font-size:12px;">
This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
</p>
"""
    return (
        "Verify your email address",
        _base_template(body, institute_name, logo_url, accent_color),
    )



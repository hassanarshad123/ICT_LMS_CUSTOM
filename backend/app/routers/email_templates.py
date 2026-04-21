"""Admin API for managing per-institute email template overrides."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.services import email_template_service

router = APIRouter(prefix="/email-templates", tags=["Email Templates"])

Admin = Annotated[User, Depends(require_roles("admin"))]


class TemplateUpdateIn(BaseModel):
    subject: str
    body_html: str


class PreviewIn(BaseModel):
    subject: str
    body_html: str
    template_key: str


@router.get("")
async def list_templates(
    user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await email_template_service.list_templates(session, user.institute_id)


@router.get("/{template_key}")
async def get_template(
    template_key: str,
    user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        return await email_template_service.get_template(session, user.institute_id, template_key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{template_key}")
async def update_template(
    template_key: str,
    body: TemplateUpdateIn,
    user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        return await email_template_service.update_template(
            session, user.institute_id, template_key, body.subject, body.body_html,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{template_key}")
async def reset_template(
    template_key: str,
    user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        return await email_template_service.reset_template(session, user.institute_id, template_key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/preview")
async def preview_template(
    body: PreviewIn,
    user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Render a template with sample data for live preview."""
    from app.utils.email_template_defaults import TEMPLATE_DEFAULTS
    from app.utils.email_sender import get_institute_branding, build_login_url

    default = TEMPLATE_DEFAULTS.get(body.template_key)
    if not default:
        raise HTTPException(status_code=404, detail="Unknown template key")

    branding = await get_institute_branding(session, user.institute_id)

    sample_vars = {
        "student_name": "Jane Doe",
        "email": "jane@example.com",
        "default_password": "••••••••",
        "batch_name": "Batch Alpha 2026",
        "course_name": "Introduction to Python",
        "teacher_name": "Mr. Ahmad",
        "start_date": "2026-05-01",
        "end_date": "2026-08-01",
        "effective_end_date": "2026-08-01",
        "days_remaining": "7",
        "urgency": "in 7 days",
        "urgency_color": "#F59E0B",
        "cert_id": "CERT-2026-0042",
        "verification_code": "ABC123XYZ",
        "title": "Important Update",
        "content": "This is a sample announcement content for preview purposes.",
        "posted_by": "Admin",
        "scope_label": "Institute-wide",
        "quiz_title": "Module 1 Quiz",
        "score": "8",
        "max_score": "10",
        "percentage": "80",
        "passed": "True",
        "result_text": "Passed",
        "result_color": "#16A34A",
        "class_title": "Live Session: Python Basics",
        "scheduled_date": "2026-05-15",
        "scheduled_time": "10:00 AM",
        "duration": "60",
        "join_url": "#",
        "old_date": "2026-05-14",
        "old_time": "9:00 AM",
        "new_date": "2026-05-15",
        "new_time": "10:00 AM",
        "amount_due": "5,000",
        "amount_str": "PKR 5,000",
        "currency": "PKR",
        "due_date": "2026-05-01",
        "payment_term": "Installment 2",
        "admin_name": user.name or "Admin",
        "invoice_number": "INV-2026-0001",
        "period_label": "May 2026",
        "total_pkr": "15,000",
        "total_pkr_formatted": "Rs 15,000",
        "days_overdue": "5",
        "days_overdue_plural": "days",
        "user_name": "Jane Doe",
        "name": "Jane Doe",
        "verification_url": "#",
        "portal_url": "#",
        "login_url": build_login_url(branding["slug"]),
        "reset_url": "#",
        "reset_link": "#",
        "meeting_url": "#",
        "scheduled_str": "May 15, 2026 at 10:00 AM",
        "overdue_rows_html": '<tr><td style="color:#7F1D1D;font-size:13px;padding:6px 0;">Installment 2</td><td style="color:#7F1D1D;font-size:13px;padding:6px 0;">Due 2026-05-01</td><td style="color:#7F1D1D;font-size:13px;padding:6px 0;text-align:right;"><strong>PKR 5,000</strong></td></tr>',
        "grand_total_formatted": "PKR 5,000",
        "line_items_html": '<tr><td style="padding:8px 12px;border-bottom:1px solid #E4E4E7;color:#27272a;font-size:14px;">Active Students</td><td style="padding:8px 12px;border-bottom:1px solid #E4E4E7;color:#52525b;font-size:13px;text-align:right;">50 x Rs 300</td><td style="padding:8px 12px;border-bottom:1px solid #E4E4E7;color:#18181b;font-size:14px;font-weight:bold;text-align:right;">Rs 15,000</td></tr>',
        "headline": "New student sign-ups and uploads are now blocked",
        "detail": "Invoice <strong>INV-2026-0001</strong> is 5 days overdue. Until the balance is cleared, you cannot add new students or upload new content.",
    }

    subject, html = email_template_service.render_template_html(
        template_key=body.template_key,
        variables=sample_vars,
        subject_override=body.subject,
        body_override=body.body_html,
        institute_name=branding["name"],
        logo_url=branding.get("logo_url"),
        accent_color=branding.get("accent_color", "#C5D86D"),
        login_url=sample_vars["login_url"],
    )
    return {"subject": subject, "html": html}

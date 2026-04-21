# backend/app/services/email_template_service.py
"""CRUD and rendering for per-institute email template overrides."""
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.email_template import EmailTemplate
from app.utils.email_template_defaults import TEMPLATE_DEFAULTS, TemplateDefault
from app.utils.email_templates import _base_template


async def list_templates(
    session: AsyncSession, institute_id: uuid.UUID
) -> list[dict]:
    """Return all template keys with current subject/body (override or default)."""
    result = await session.execute(
        select(EmailTemplate).where(EmailTemplate.institute_id == institute_id)
    )
    overrides = {t.template_key: t for t in result.scalars().all()}

    templates = []
    for key, default in TEMPLATE_DEFAULTS.items():
        override = overrides.get(key)
        templates.append({
            "key": key,
            "label": default.label,
            "category": default.category,
            "subject": override.subject if override else default.default_subject,
            "body_html": override.body_html if override else default.default_body,
            "is_custom": override is not None,
            "variables": default.variables,
            "updated_at": override.updated_at.isoformat() if override and override.updated_at else None,
        })
    return templates


async def get_template(
    session: AsyncSession, institute_id: uuid.UUID, template_key: str
) -> dict:
    """Return a single template with override or default."""
    default = TEMPLATE_DEFAULTS.get(template_key)
    if not default:
        raise ValueError(f"Unknown template key: {template_key}")

    result = await session.execute(
        select(EmailTemplate).where(
            EmailTemplate.template_key == template_key,
            EmailTemplate.institute_id == institute_id,
        )
    )
    override = result.scalar_one_or_none()

    return {
        "key": template_key,
        "label": default.label,
        "category": default.category,
        "subject": override.subject if override else default.default_subject,
        "body_html": override.body_html if override else default.default_body,
        "default_subject": default.default_subject,
        "default_body": default.default_body,
        "is_custom": override is not None,
        "variables": default.variables,
    }


async def update_template(
    session: AsyncSession, institute_id: uuid.UUID, template_key: str,
    subject: str, body_html: str,
) -> dict:
    """Create or update an institute's template override."""
    default = TEMPLATE_DEFAULTS.get(template_key)
    if not default:
        raise ValueError(f"Unknown template key: {template_key}")

    result = await session.execute(
        select(EmailTemplate).where(
            EmailTemplate.template_key == template_key,
            EmailTemplate.institute_id == institute_id,
        )
    )
    override = result.scalar_one_or_none()

    if override:
        override.subject = subject
        override.body_html = body_html
        override.updated_at = datetime.now(timezone.utc)
        session.add(override)
    else:
        override = EmailTemplate(
            template_key=template_key,
            institute_id=institute_id,
            subject=subject,
            body_html=body_html,
        )
        session.add(override)

    await session.commit()
    await session.refresh(override)
    return await get_template(session, institute_id, template_key)


async def reset_template(
    session: AsyncSession, institute_id: uuid.UUID, template_key: str,
) -> dict:
    """Delete the override, reverting to default."""
    default = TEMPLATE_DEFAULTS.get(template_key)
    if not default:
        raise ValueError(f"Unknown template key: {template_key}")

    result = await session.execute(
        select(EmailTemplate).where(
            EmailTemplate.template_key == template_key,
            EmailTemplate.institute_id == institute_id,
        )
    )
    override = result.scalar_one_or_none()
    if override:
        await session.delete(override)
        await session.commit()

    return await get_template(session, institute_id, template_key)


def render_template_html(
    template_key: str,
    variables: dict[str, str],
    subject_override: str | None = None,
    body_override: str | None = None,
    institute_name: str = "",
    logo_url: str | None = None,
    accent_color: str = "#C5D86D",
    login_url: str = "",
) -> tuple[str, str]:
    """Render a template with {{variable}} substitution + branding wrapper.

    Returns (subject, full_html) ready for sending.
    """
    default = TEMPLATE_DEFAULTS.get(template_key)
    if not default:
        raise ValueError(f"Unknown template key: {template_key}")

    subject = subject_override or default.default_subject
    body = body_override or default.default_body

    # Always inject branding variables
    variables.setdefault("institute_name", institute_name)
    variables.setdefault("accent_color", accent_color)
    variables.setdefault("login_url", login_url)

    # Add camelCase aliases so both {{student_name}} and {{studentName}} work
    def _to_camel(snake: str) -> str:
        parts = snake.split("_")
        return parts[0] + "".join(p.capitalize() for p in parts[1:])

    for key, val in list(variables.items()):
        camel = _to_camel(key)
        if camel != key:
            variables.setdefault(camel, val)

    # Replace {{variable}} placeholders
    def _replace(match):
        var_name = match.group(1).strip()
        return str(variables.get(var_name, match.group(0)))

    subject = re.sub(r"\{\{(\w+)\}\}", _replace, subject)
    body = re.sub(r"\{\{(\w+)\}\}", _replace, body)

    full_html = _base_template(body, institute_name, logo_url, accent_color, login_url)
    return subject, full_html


async def render_with_overrides(
    session: AsyncSession,
    institute_id: uuid.UUID,
    template_key: str,
    variables: dict[str, str],
    institute_name: str = "",
    logo_url: str | None = None,
    accent_color: str = "#C5D86D",
    login_url: str = "",
) -> tuple[str, str]:
    """Load override from DB if exists, then render. Main entry point for senders."""
    result = await session.execute(
        select(EmailTemplate).where(
            EmailTemplate.template_key == template_key,
            EmailTemplate.institute_id == institute_id,
        )
    )
    override = result.scalar_one_or_none()

    return render_template_html(
        template_key=template_key,
        variables=variables,
        subject_override=override.subject if override else None,
        body_override=override.body_html if override else None,
        institute_name=institute_name,
        logo_url=logo_url,
        accent_color=accent_color,
        login_url=login_url,
    )

from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.institute import Institute
from app.models.user import User
from app.models.billing import Invoice, Payment
from app.models.course import Course
from app.models.activity import ActivityLog


async def sa_global_search(session: AsyncSession, query: str, limit: int = 3) -> dict:
    term = f"%{query}%"
    results: dict[str, list[dict]] = {
        "institutes": [],
        "users": [],
        "invoices": [],
        "payments": [],
        "courses": [],
        "activity": [],
    }

    results["institutes"] = await _search_institutes(session, term, limit)
    results["users"] = await _search_users(session, term, limit)
    results["invoices"] = await _search_invoices(session, term, limit)
    results["payments"] = await _search_payments(session, term, limit)
    results["courses"] = await _search_courses(session, term, limit)
    results["activity"] = await _search_activity(session, term, limit)

    return results


async def _search_institutes(session: AsyncSession, term: str, limit: int) -> list[dict]:
    result = await session.execute(
        select(Institute)
        .where(
            Institute.deleted_at.is_(None),
            (Institute.name.ilike(term)) | (Institute.slug.ilike(term)),
        )
        .order_by(Institute.name)
        .limit(limit)
    )
    return [
        {
            "id": str(i.id),
            "label": i.name,
            "sublabel": f"{i.slug}.zensbot.online",
            "entity_type": "institute",
            "url": f"/sa/institutes/{i.id}",
        }
        for i in result.scalars().all()
    ]


async def _search_users(session: AsyncSession, term: str, limit: int) -> list[dict]:
    result = await session.execute(
        select(User, Institute.name.label("institute_name"))
        .outerjoin(Institute, User.institute_id == Institute.id)
        .where(
            User.deleted_at.is_(None),
            (User.name.ilike(term)) | (User.email.ilike(term)),
        )
        .order_by(User.name)
        .limit(limit)
    )
    return [
        {
            "id": str(row[0].id),
            "label": row[0].name,
            "sublabel": f"{row[0].email} — {row[1] or 'No institute'}",
            "entity_type": "user",
            "url": f"/sa/users?highlight={row[0].id}",
        }
        for row in result.all()
    ]


async def _search_invoices(session: AsyncSession, term: str, limit: int) -> list[dict]:
    result = await session.execute(
        select(Invoice, Institute.name.label("institute_name"))
        .outerjoin(Institute, Invoice.institute_id == Institute.id)
        .where(Invoice.invoice_number.ilike(term))
        .order_by(Invoice.created_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": str(row[0].id),
            "label": row[0].invoice_number,
            "sublabel": f"{row[1] or 'Unknown'} — {row[0].status}",
            "entity_type": "invoice",
            "url": f"/sa/billing?invoice={row[0].id}",
        }
        for row in result.all()
    ]


async def _search_payments(session: AsyncSession, term: str, limit: int) -> list[dict]:
    result = await session.execute(
        select(Payment, Institute.name.label("institute_name"))
        .outerjoin(Institute, Payment.institute_id == Institute.id)
        .where(Payment.reference_number.ilike(term))
        .order_by(Payment.created_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": str(row[0].id),
            "label": row[0].reference_number or "No ref",
            "sublabel": f"{row[1] or 'Unknown'} — {row[0].status}",
            "entity_type": "payment",
            "url": f"/sa/billing?payment={row[0].id}",
        }
        for row in result.all()
    ]


async def _search_courses(session: AsyncSession, term: str, limit: int) -> list[dict]:
    result = await session.execute(
        select(Course, Institute.name.label("institute_name"))
        .outerjoin(Institute, Course.institute_id == Institute.id)
        .where(Course.title.ilike(term))
        .order_by(Course.title)
        .limit(limit)
    )
    return [
        {
            "id": str(row[0].id),
            "label": row[0].title,
            "sublabel": row[1] or "Unknown institute",
            "entity_type": "course",
            "url": f"/sa/institutes/{row[0].institute_id}",
        }
        for row in result.all()
    ]


async def _search_activity(session: AsyncSession, term: str, limit: int) -> list[dict]:
    result = await session.execute(
        select(ActivityLog)
        .where(ActivityLog.action.ilike(term))
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": str(a.id),
            "label": a.action,
            "sublabel": f"{a.entity_type} — {a.created_at.strftime('%Y-%m-%d %H:%M') if a.created_at else ''}",
            "entity_type": "activity",
            "url": f"/sa/activity?id={a.id}",
        }
        for a in result.scalars().all()
    ]

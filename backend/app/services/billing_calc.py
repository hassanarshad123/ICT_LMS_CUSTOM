"""Pricing v2 billing calculation service.

Pure-ish computation layer used by the monthly billing cron
(``scheduler/billing_jobs.py``) and the admin "preview current period"
endpoint (PR 4). All functions take the data they need as arguments
plus an ``AsyncSession`` for the reads — no hidden state, no
side effects beyond query execution.

Terminology:
  * snapshot student count = COUNT(users) where role=student, active,
    not soft-deleted, scoped to the institute, at a point in time.
  * overage students = max(0, snapshot − billing.free_users_included).
  * Professional rate: flat ``billing.extra_user_rate`` PKR per extra
    student per month.
  * Custom rate: tiered rates stored in
    ``institute_billing.custom_pricing_config.tiered_student_rates``
    (list of ``{"from": int, "to": int|None, "rate_pkr": int}`` ranges).

Invoice line_items JSONB shape — matches existing sa_billing_service
format (key ``amount`` is the line total in PKR; kept to stay compatible
with existing invoice rendering + revenue rollups):
  [
    {"code": "student_overage", "label": "Student overage (12)", "qty": 12, "unit_pkr": 80, "amount": 960},
    {"code": "addon_video_50gb", "label": "+50 GB video", "qty": 1, "unit_pkr": 3000, "amount": 3000},
    ...
  ]
"""
import uuid
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.billing import InstituteBilling
from app.models.enums import UserRole
from app.models.institute import Institute
from app.models.institute_addon import InstituteAddon
from app.models.user import User
from app.services.addon_service import active_addons
from app.utils.plan_limits import is_v2_billing_tier


@dataclass(frozen=True)
class BillingPreview:
    """Result of computing a period bill. All amounts in PKR."""
    institute_id: uuid.UUID
    snapshot_student_count: int
    overage_student_count: int
    student_overage_pkr: int
    addon_total_pkr: int
    base_fee_pkr: int
    total_pkr: int
    line_items: list[dict]


async def count_active_students(
    session: AsyncSession, institute_id: uuid.UUID,
) -> int:
    """Count students that count toward billing at this exact moment."""
    result = await session.execute(
        select(func.count(User.id)).where(
            User.institute_id == institute_id,
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
    )
    return int(result.scalar_one() or 0)


def compute_student_overage_pkr(
    snapshot_count: int,
    billing: InstituteBilling,
    tier_is_custom: bool,
) -> tuple[int, int]:
    """Return (overage_count, overage_amount_pkr).

    Professional: flat ``billing.extra_user_rate`` per overage student.
    Custom: walk ``custom_pricing_config.tiered_student_rates`` if set,
    otherwise fall back to flat ``extra_user_rate``.

    If extra_user_rate is 0 (legacy config), overage amount is 0 —
    the institute simply has no billable overage. This is the safe
    default for any InstituteBilling row that predates v2.
    """
    overage = max(0, snapshot_count - billing.free_users_included)
    if overage == 0:
        return 0, 0

    # Custom tier with configured tier rates — walk the brackets.
    if tier_is_custom and billing.custom_pricing_config:
        tiers = billing.custom_pricing_config.get("tiered_student_rates") or []
        if tiers:
            return overage, _apply_tiered_rates(snapshot_count, billing.free_users_included, tiers)

    # Professional or Custom without bracket table: flat rate.
    return overage, overage * billing.extra_user_rate


def _apply_tiered_rates(
    snapshot_count: int,
    free_included: int,
    tiers: list[dict],
) -> int:
    """Compute total PKR across ``tiered_student_rates`` brackets.

    Each tier: {"from": int, "to": int | None, "rate_pkr": int}.
    ``from`` is inclusive, ``to`` is exclusive (None = unbounded).
    Brackets are assumed sorted and non-overlapping.

    Billed students = students beyond free_included, distributed across
    the brackets by absolute student number (NOT by overage offset).
    E.g., free=10, tiers = [{from:1,to:500,rate:80},{from:500,to:1000,rate:50}]
    with 700 students:
      * Students 11..499 → 489 × 80 = 39,120
      * Students 500..699 → 200 × 50 = 10,000
      * Total = 49,120 PKR
    """
    billed_start = free_included  # first billable student index (0-based inclusive)
    total = 0
    for tier in tiers:
        lo = max(tier.get("from", 0), billed_start)
        hi = tier.get("to")
        upper = snapshot_count if hi is None else min(hi, snapshot_count)
        qty = max(0, upper - lo)
        total += qty * int(tier["rate_pkr"])
        if hi is not None and snapshot_count <= hi:
            break
    return total


async def compute_addon_charges(
    session: AsyncSession, institute_id: uuid.UUID,
) -> tuple[int, list[InstituteAddon]]:
    """Return (total_pkr, active_addons_list). Sum is price × quantity."""
    addons = list(await active_addons(session, institute_id))
    total = sum(a.unit_price_pkr * a.quantity for a in addons)
    return total, addons


def build_line_items(
    overage_count: int,
    overage_pkr: int,
    base_fee_pkr: int,
    addons: Sequence[InstituteAddon],
    unit_user_rate_pkr: int,
) -> list[dict]:
    """Build the invoice ``line_items`` JSONB blob.

    Order: base fee first (Custom only), then student overage, then addons.
    """
    items: list[dict] = []
    if base_fee_pkr > 0:
        items.append({
            "code": "base_fee",
            "label": "Base fee",
            "qty": 1,
            "unit_pkr": base_fee_pkr,
            "amount": base_fee_pkr,
        })
    if overage_count > 0:
        items.append({
            "code": "student_overage",
            "label": f"Student overage ({overage_count})",
            "qty": overage_count,
            "unit_pkr": unit_user_rate_pkr,
            "amount": overage_pkr,
        })
    for a in addons:
        items.append({
            "code": f"addon_{a.addon_type}",
            "label": _addon_label(a.addon_type),
            "qty": a.quantity,
            "unit_pkr": a.unit_price_pkr,
            "amount": a.unit_price_pkr * a.quantity,
        })
    return items


def _addon_label(addon_type: str) -> str:
    """Human-readable label for an addon_type string."""
    mapping = {
        "docs_10gb": "+10 GB documents",
        "video_50gb": "+50 GB video",
        "video_100gb": "+100 GB video",
        "video_500gb": "+500 GB video",
    }
    return mapping.get(addon_type, addon_type)


async def compute_billing_preview(
    session: AsyncSession,
    institute: Institute,
    billing: InstituteBilling,
) -> BillingPreview:
    """End-to-end preview: snapshot students, compute overage + addons,
    build line items, total.

    Callers MUST verify ``is_v2_billing_tier(institute.plan_tier)`` before
    invoking this. Grandfathered institutes have no v2 billing semantics —
    calling this function for them would return a technically-correct but
    meaningless preview (and waste DB queries).
    """
    snapshot = await count_active_students(session, institute.id)

    tier_is_custom = institute.plan_tier.value == "custom"
    overage_count, student_overage_pkr = compute_student_overage_pkr(
        snapshot, billing, tier_is_custom
    )

    addon_total_pkr, addons = await compute_addon_charges(session, institute.id)

    base_fee_pkr = billing.base_amount  # Custom deals set this per contract
    total_pkr = base_fee_pkr + student_overage_pkr + addon_total_pkr
    line_items = build_line_items(
        overage_count=overage_count,
        overage_pkr=student_overage_pkr,
        base_fee_pkr=base_fee_pkr,
        addons=addons,
        unit_user_rate_pkr=billing.extra_user_rate,
    )

    return BillingPreview(
        institute_id=institute.id,
        snapshot_student_count=snapshot,
        overage_student_count=overage_count,
        student_overage_pkr=student_overage_pkr,
        addon_total_pkr=addon_total_pkr,
        base_fee_pkr=base_fee_pkr,
        total_pkr=total_pkr,
        line_items=line_items,
    )


def is_v2_billable(institute: Institute) -> bool:
    """Defense-in-depth gate: must be a v2 tier AND currently active.

    Suspended/archived institutes don't get billed even if their tier
    matches — there's no point running up a bill while they can't log in.
    """
    return is_v2_billing_tier(institute.plan_tier) and institute.status.value == "active"

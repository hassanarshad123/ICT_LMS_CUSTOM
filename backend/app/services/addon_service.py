"""Pricing v2: storage add-on service layer.

Business rules (see docs/pricing-model-v2.md):
  * Only v2 billing tiers (professional, custom) may purchase addons.
    Grandfathered institutes never reach this service in happy-path code
    paths — callers are expected to tier-gate first, but as defense in
    depth ``activate_addon`` re-checks the tier and raises ValueError.
  * Activation captures immutable pricing snapshot. Future price changes
    to ADDON_PRICING do not affect existing subscriptions.
  * Cancellation takes effect at the end of the current billing period
    (calendar month in v2). Until then, capacity and billing both remain.
  * "Active" means activated_at <= now AND (cancelled_effective_at is
    NULL OR cancelled_effective_at > now).
"""
import calendar
import uuid
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.institute import Institute
from app.models.institute_addon import InstituteAddon
from app.utils.plan_limits import (
    ADDON_PRICING,
    get_addon_pricing,
    is_v2_billing_tier,
)


async def list_addons(
    session: AsyncSession, institute_id: uuid.UUID,
) -> Sequence[InstituteAddon]:
    """All addon rows (active + historical), newest first."""
    result = await session.execute(
        select(InstituteAddon)
        .where(InstituteAddon.institute_id == institute_id)
        .order_by(InstituteAddon.activated_at.desc())
    )
    return result.scalars().all()


async def active_addons(
    session: AsyncSession, institute_id: uuid.UUID,
) -> Sequence[InstituteAddon]:
    """Currently-active addons for capacity and billing calculations."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(InstituteAddon)
        .where(
            InstituteAddon.institute_id == institute_id,
            InstituteAddon.activated_at <= now,
            or_(
                InstituteAddon.cancelled_effective_at.is_(None),
                InstituteAddon.cancelled_effective_at > now,
            ),
        )
        .order_by(InstituteAddon.activated_at.asc())
    )
    return result.scalars().all()


async def get_addon_storage_bonus(
    session: AsyncSession, institute_id: uuid.UUID,
) -> tuple[float, float]:
    """Return (docs_bonus_gb, video_bonus_gb) from all active addons.

    Callers MUST tier-gate before using this result to extend quota —
    grandfathered tiers should never see an addon bonus even if a row
    somehow exists (belt + suspenders). The storage_quota check in
    institute_service enforces this.
    """
    addons = await active_addons(session, institute_id)
    docs = 0.0
    video = 0.0
    for a in addons:
        delta = a.storage_bonus_gb * a.quantity
        if a.storage_bonus_kind == "docs":
            docs += delta
        elif a.storage_bonus_kind == "video":
            video += delta
    return docs, video


async def activate_addon(
    session: AsyncSession,
    institute_id: uuid.UUID,
    addon_type: str,
    quantity: int = 1,
) -> InstituteAddon:
    """Create an active addon subscription.

    Capacity takes effect immediately (activated_at = now). Billing
    starts the next billing cycle (the monthly cron in PR 3 snapshots
    active addons on the 1st).

    Raises:
        ValueError if addon_type is not in ADDON_PRICING.
        ValueError if quantity < 1.
        ValueError if the institute is grandfathered (not a v2 tier).
        ValueError if the institute does not exist.
    """
    if quantity < 1:
        raise ValueError("quantity must be >= 1")

    config = get_addon_pricing(addon_type)
    if config is None:
        valid = ", ".join(sorted(ADDON_PRICING.keys()))
        raise ValueError(f"Unknown addon_type '{addon_type}'. Valid: {valid}")

    institute = await session.get(Institute, institute_id)
    if institute is None:
        raise ValueError(f"Institute {institute_id} not found")

    if not is_v2_billing_tier(institute.plan_tier):
        raise ValueError(
            f"Addons are not available on the '{institute.plan_tier.value}' plan. "
            "Storage add-on packs require the Professional or Custom plan."
        )

    addon = InstituteAddon(
        institute_id=institute_id,
        addon_type=addon_type,
        quantity=quantity,
        unit_price_pkr=config["price_pkr"],
        storage_bonus_gb=config["bonus_gb"],
        storage_bonus_kind=config["kind"],
        activated_at=datetime.now(timezone.utc),
    )
    session.add(addon)
    await session.flush()
    return addon


async def cancel_addon(
    session: AsyncSession, addon_id: uuid.UUID,
) -> InstituteAddon:
    """Mark an addon as cancelled.

    Sets ``cancelled_at`` = now and ``cancelled_effective_at`` = last
    instant of the current calendar month. Capacity and billing remain
    active until that moment, then disappear.

    Raises:
        ValueError if the addon does not exist or is already cancelled.
    """
    addon = await session.get(InstituteAddon, addon_id)
    if addon is None:
        raise ValueError(f"Addon {addon_id} not found")
    if addon.cancelled_at is not None:
        raise ValueError(f"Addon {addon_id} is already cancelled")

    now = datetime.now(timezone.utc)
    addon.cancelled_at = now
    addon.cancelled_effective_at = _end_of_month_utc(now)
    session.add(addon)
    await session.flush()
    return addon


def _end_of_month_utc(when: datetime) -> datetime:
    """Last microsecond of the calendar month containing ``when``, UTC."""
    last_day = calendar.monthrange(when.year, when.month)[1]
    return datetime(
        when.year, when.month, last_day,
        23, 59, 59, 999_999,
        tzinfo=timezone.utc,
    )

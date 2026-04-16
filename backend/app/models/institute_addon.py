"""Pricing v2: storage add-on subscriptions.

An InstituteAddon row represents one active (or historical) storage pack
purchased by an institute on the Professional or Custom tier. Addons are
the mechanism by which a Professional institute expands past the base
10 GB docs / 50 GB video included in the free plan — e.g., activating
a ``video_50gb`` addon adds 50 GB of video capacity immediately.

Key rules (see docs/pricing-model-v2.md):
  * Addons apply ONLY to tiers where is_v2_billing_tier() is True.
    Grandfathered institutes (free/starter/basic/pro/enterprise —
    including ICT.ZENSBOT.ONLINE) never see this table.
  * Capacity is effective at ``activated_at``. Billing starts the NEXT
    billing cycle (see addon_service + PR 3 billing cron).
  * Cancel sets ``cancelled_at`` = now and ``cancelled_effective_at`` =
    last instant of current billing period. The addon remains active
    until cancelled_effective_at, then disappears from both capacity
    and billing.

Pricing is snapshotted on activation via ``unit_price_pkr`` so that
future price changes to ADDON_PRICING (in plan_limits) don't retroactively
change what an existing subscriber pays.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Index, ForeignKey, Integer, String, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP


class InstituteAddon(SQLModel, table=True):
    __tablename__ = "institute_addons"
    __table_args__ = (
        # Query pattern: "what's active right now for this institute?"
        # Hits both list_addons() and get_addon_storage_bonus().
        Index(
            "ix_institute_addons_active_lookup",
            "institute_id",
            "cancelled_effective_at",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("institutes.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    # addon_type maps to a key in ADDON_PRICING (plan_limits.py). Stored as
    # a plain string (not enum) so adding new pack types doesn't require
    # a DB migration — just a new ADDON_PRICING entry.
    addon_type: str = Field(
        sa_column=Column(String(32), nullable=False)
    )
    # Number of packs of this type (e.g., 3 × video_50gb = +150 GB).
    quantity: int = Field(default=1, sa_column=Column(Integer, nullable=False, server_default="1"))
    # Price per pack in PKR, snapshotted at activation. Monthly charge =
    # unit_price_pkr × quantity until cancelled_effective_at.
    unit_price_pkr: int = Field(sa_column=Column(Integer, nullable=False))
    # Storage added by one pack, in GB. Snapshotted so future config
    # changes don't alter existing capacity calculations.
    storage_bonus_gb: float = Field(sa_column=Column(Float, nullable=False))
    # "docs" (adds to max_storage_gb) or "video" (adds to max_video_gb).
    storage_bonus_kind: str = Field(sa_column=Column(String(16), nullable=False))
    activated_at: datetime = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")
    )
    # Set when the admin cancels. cancelled_effective_at is the moment
    # capacity is removed and billing stops — typically end of current
    # billing period.
    cancelled_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    cancelled_effective_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )

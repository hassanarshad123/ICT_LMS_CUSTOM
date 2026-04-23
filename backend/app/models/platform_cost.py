import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import BigInteger, Date, Float, String, Text, UniqueConstraint, Index, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID as PG_UUID


class PlatformCost(SQLModel, table=True):
    __tablename__ = "platform_costs"
    __table_args__ = (
        UniqueConstraint("month", "service", name="uq_platform_cost_month_service"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    month: date = Field(sa_column=Column(Date, nullable=False))
    service: str = Field(sa_column=Column(String(32), nullable=False))
    amount_usd: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    amount_pkr: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    source: str = Field(sa_column=Column(String(16), nullable=False, server_default="'manual'"))
    raw_data: Optional[dict] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class InstituteCostAttribution(SQLModel, table=True):
    __tablename__ = "institute_cost_attributions"
    __table_args__ = (
        UniqueConstraint("institute_id", "month", "service", name="uq_cost_attr_inst_month_svc"),
        Index("ix_cost_attr_month", "month"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False)
    )
    month: date = Field(sa_column=Column(Date, nullable=False))
    service: str = Field(sa_column=Column(String(32), nullable=False))
    amount_usd: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    amount_pkr: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    usage_ratio: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class QuotaAlertLog(SQLModel, table=True):
    __tablename__ = "quota_alert_logs"
    __table_args__ = (
        UniqueConstraint(
            "institute_id", "resource", "threshold_pct",
            name="uq_quota_alert_inst_res_thresh",
        ),
        Index("ix_quota_alert_institute", "institute_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False)
    )
    resource: str = Field(sa_column=Column(String(16), nullable=False))
    threshold_pct: int = Field(nullable=False)
    sent_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    notified_sa: bool = Field(default=False)
    notified_admin: bool = Field(default=False)

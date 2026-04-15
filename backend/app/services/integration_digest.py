"""Tier 3: weekly Frappe sync digest email for institute admins.

Run from the scheduler once per week (or daily — the job dedupes via Redis
so it's safe to call more often). For each institute with an enabled
Frappe integration AND any sync activity in the last 7 days, sends every
admin a one-page summary: success rate, failure count, top 3 failure
reasons.

Safe to skip: institutes with no integration, no activity, or already
sent a digest in the current 7-day window.
"""
from __future__ import annotations

import logging
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.integration import InstituteIntegration, IntegrationSyncLog
from app.models.user import User

logger = logging.getLogger("ict_lms.integration_digest")

DIGEST_WINDOW_DAYS = 7
DIGEST_DEDUP_TTL_SECONDS = 6 * 24 * 3600  # 6 days — slightly less than the window
DIGEST_DEDUP_KEY = "integration:digest:weekly:{institute_id}"


async def send_weekly_digests(session: AsyncSession) -> int:
    """Iterate every institute with frappe_enabled=True; send digests where
    there's activity AND no recent digest already sent. Returns count sent.
    """
    from app.core.cache import cache

    cutoff = datetime.now(timezone.utc) - timedelta(days=DIGEST_WINDOW_DAYS)

    # Find institutes with sync activity in the window
    activity_rows = (await session.execute(
        select(IntegrationSyncLog.institute_id, func.count(IntegrationSyncLog.id))
        .where(IntegrationSyncLog.created_at >= cutoff)
        .group_by(IntegrationSyncLog.institute_id)
    )).all()
    if not activity_rows:
        return 0

    sent = 0
    for institute_id, total_events in activity_rows:
        # Skip if integration disabled or already digested this window
        cfg = (await session.execute(
            select(InstituteIntegration).where(
                InstituteIntegration.institute_id == institute_id,
                InstituteIntegration.frappe_enabled.is_(True),
            )
        )).scalar_one_or_none()
        if cfg is None:
            continue

        dedup_key = DIGEST_DEDUP_KEY.format(institute_id=institute_id)
        if await cache.get(dedup_key) is not None:
            continue

        try:
            await _send_digest_for_institute(
                session, institute_id=institute_id, cutoff=cutoff,
                total_events=total_events,
            )
            await cache.set(dedup_key, "1", ttl=DIGEST_DEDUP_TTL_SECONDS)
            sent += 1
        except Exception:  # noqa: BLE001
            logger.exception("Failed to send digest for institute=%s", institute_id)

    return sent


async def _send_digest_for_institute(
    session: AsyncSession,
    *,
    institute_id: uuid.UUID,
    cutoff: datetime,
    total_events: int,
) -> None:
    from app.utils.email import send_email_for_institute

    # Gather counts
    rows = (await session.execute(
        select(IntegrationSyncLog.status, func.count(IntegrationSyncLog.id))
        .where(
            IntegrationSyncLog.institute_id == institute_id,
            IntegrationSyncLog.created_at >= cutoff,
        )
        .group_by(IntegrationSyncLog.status)
    )).all()
    by_status = {status: count for status, count in rows}
    success = by_status.get("success", 0)
    failed = by_status.get("failed", 0)
    completed_total = success + failed
    success_rate = (success / completed_total * 100.0) if completed_total else 100.0

    # Top error reasons (only failed rows, error_message non-null)
    err_rows = (await session.execute(
        select(IntegrationSyncLog.error_message)
        .where(
            IntegrationSyncLog.institute_id == institute_id,
            IntegrationSyncLog.created_at >= cutoff,
            IntegrationSyncLog.status == "failed",
            IntegrationSyncLog.error_message.is_not(None),
        )
    )).all()
    counter: Counter[str] = Counter()
    for (msg,) in err_rows:
        if msg:
            counter[msg[:120]] += 1
    top_errors = counter.most_common(3)

    # Find admins
    admin_rows = (await session.execute(
        select(User.email, User.name).where(
            User.institute_id == institute_id,
            User.role == "admin",
            User.status == "active",
        )
    )).all()
    if not admin_rows:
        logger.info("No active admins for institute=%s — skipping digest", institute_id)
        return

    subject = f"Frappe sync — weekly summary ({success_rate:.0f}% success)"
    html = _render_digest_html(
        success_rate=success_rate,
        success_count=success,
        failure_count=failed,
        total_events=total_events,
        top_errors=top_errors,
    )

    for email, _name in admin_rows:
        try:
            await send_email_for_institute(
                to=email, subject=subject, html=html, institute_id=institute_id,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Email send failed for admin=%s", email)


def _render_digest_html(
    *,
    success_rate: float,
    success_count: int,
    failure_count: int,
    total_events: int,
    top_errors: list[tuple[str, int]],
) -> str:
    rate_color = (
        "#16a34a" if success_rate >= 95
        else "#ca8a04" if success_rate >= 80
        else "#dc2626"
    )
    error_rows_html = "".join(
        f"""<tr>
              <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">{_escape(msg)}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;text-align:right;">{count}×</td>
            </tr>"""
        for msg, count in top_errors
    ) or """<tr><td colspan="2" style="padding:8px 10px;font-size:12px;color:#94a3b8;">No failures this week 🎉</td></tr>"""

    return f"""<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;">
      <h1 style="font-size:18px;color:#1A1A1A;margin:0;">Frappe sync — weekly summary</h1>
      <p style="font-size:13px;color:#64748b;margin:4px 0 0;">Last 7 days · {total_events} sync events</p>
    </div>

    <div style="padding:20px 24px;">
      <div style="display:flex;gap:12px;margin-bottom:16px;">
        <div style="flex:1;background:#f8fafc;border-radius:12px;padding:12px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Success rate</div>
          <div style="font-size:24px;font-weight:600;color:{rate_color};margin-top:4px;">{success_rate:.0f}%</div>
        </div>
        <div style="flex:1;background:#f8fafc;border-radius:12px;padding:12px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Successes</div>
          <div style="font-size:24px;font-weight:600;color:#16a34a;margin-top:4px;">{success_count}</div>
        </div>
        <div style="flex:1;background:#f8fafc;border-radius:12px;padding:12px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Failures</div>
          <div style="font-size:24px;font-weight:600;color:#dc2626;margin-top:4px;">{failure_count}</div>
        </div>
      </div>

      <h2 style="font-size:14px;color:#1A1A1A;margin:0 0 8px;">Top failure reasons</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f1f5f9;border-radius:8px;overflow:hidden;">
        {error_rows_html}
      </table>

      <p style="font-size:12px;color:#64748b;margin:20px 0 0;line-height:1.5;">
        Open the LMS Integrations page → Sync Health tab to retry failed events
        or drill into individual sync logs.
      </p>
    </div>
  </div>
  <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:16px;">
    You receive this email because you're an admin of an institute with Frappe
    sync enabled. To stop receiving it, disable the Frappe integration.
  </p>
</body></html>"""


def _escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
         .replace('"', "&quot;")
    )

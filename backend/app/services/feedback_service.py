"""Feedback & error reporting service."""
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, col

from app.models.feedback import Feedback, FeedbackAttachment, FeedbackResponse
from app.models.error_log import ErrorLog
from app.models.user import User
from app.models.institute import Institute
from app.models.enums import FeedbackType, FeedbackStatus, UserRole
from app.utils.s3 import generate_view_url, _get_client, _prefix
from app.config import get_settings

logger = logging.getLogger("ict_lms.feedback")
settings = get_settings()

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024  # 5MB
MAX_ATTACHMENTS = 2


# ── Presigned upload ──

def generate_feedback_upload_url(
    file_name: str,
    content_type: str,
    institute_id: Optional[uuid.UUID] = None,
    expires_in: int = 3600,
) -> tuple[str, str]:
    """Returns (presigned_url, object_key) for feedback screenshot upload."""
    client = _get_client()
    object_key = _prefix(institute_id, f"feedback/{uuid.uuid4()}_{file_name}")
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url, object_key


# ── Create ──

async def create_feedback(
    session: AsyncSession,
    user: User,
    data: dict,
) -> dict:
    """Create a feedback entry with optional attachments and auto-linked errors."""
    from app.services import notification_service

    # Validate feedback_type
    try:
        ft = FeedbackType(data["feedback_type"])
    except ValueError:
        raise ValueError(f"Invalid feedback_type: {data['feedback_type']}")

    # Build client_context dict
    client_context = None
    if data.get("client_context"):
        ctx = data["client_context"]
        client_context = ctx if isinstance(ctx, dict) else ctx.model_dump() if hasattr(ctx, "model_dump") else dict(ctx)

    # Auto-link recent frontend errors for bug reports
    if ft == FeedbackType.bug_report:
        thirty_min_ago = datetime.now(timezone.utc) - timedelta(minutes=30)
        result = await session.execute(
            select(
                ErrorLog.id, ErrorLog.message, ErrorLog.request_path, ErrorLog.created_at,
            ).where(
                ErrorLog.source == "frontend",
                ErrorLog.user_id == user.id,
                ErrorLog.created_at >= thirty_min_ago,
            ).order_by(ErrorLog.created_at.desc()).limit(10)
        )
        recent_errors = [
            {
                "id": str(row[0]),
                "message": row[1],
                "path": row[2],
                "time": row[3].isoformat() if row[3] else None,
            }
            for row in result.all()
        ]
        if recent_errors:
            if client_context is None:
                client_context = {}
            client_context["linked_error_logs"] = recent_errors

    feedback = Feedback(
        feedback_type=ft,
        subject=data["subject"],
        description=data["description"],
        rating=data.get("rating"),
        is_anonymous=data.get("is_anonymous", False),
        user_id=user.id,
        user_role=user.role.value if hasattr(user.role, "value") else str(user.role),
        client_context=client_context,
        institute_id=user.institute_id,
    )
    session.add(feedback)
    await session.flush()

    # Create attachments
    attachment_keys = data.get("attachment_keys") or []
    attachment_names = data.get("attachment_names") or []
    attachment_content_types = data.get("attachment_content_types") or []
    attachment_sizes = data.get("attachment_sizes") or []

    for i in range(min(len(attachment_keys), MAX_ATTACHMENTS)):
        att = FeedbackAttachment(
            feedback_id=feedback.id,
            object_key=attachment_keys[i],
            file_name=attachment_names[i] if i < len(attachment_names) else "screenshot.png",
            content_type=attachment_content_types[i] if i < len(attachment_content_types) else "image/png",
            file_size=attachment_sizes[i] if i < len(attachment_sizes) else None,
        )
        session.add(att)

    await session.commit()
    await session.refresh(feedback)

    # Notify all super_admin users
    try:
        sa_result = await session.execute(
            select(User.id, User.email).where(
                User.role == UserRole.super_admin,
                User.deleted_at.is_(None),
            )
        )
        sa_users = sa_result.all()
        sa_ids = [row[0] for row in sa_users]

        if sa_ids:
            type_label = ft.value.replace("_", " ").title()
            await notification_service.create_bulk_notifications(
                session,
                user_ids=sa_ids,
                type="new_feedback",
                title=f"New Feedback: {feedback.subject[:50]}",
                message=f"{type_label} — rating {feedback.rating or 'N/A'}/5",
                link="/sa/feedback",
                institute_id=None,
            )

            # Send email to SAs (fire-and-forget)
            _send_feedback_email_to_sas(
                sa_emails=[row[1] for row in sa_users if row[1]],
                feedback_type=type_label,
                subject=feedback.subject,
                rating=feedback.rating,
                is_anonymous=feedback.is_anonymous,
            )
    except Exception as e:
        logger.warning("Failed to notify SAs about feedback: %s", e)

    return _feedback_to_dict(feedback)


def _send_feedback_email_to_sas(
    sa_emails: list[str],
    feedback_type: str,
    subject: str,
    rating: Optional[int],
    is_anonymous: bool,
) -> None:
    """Fire-and-forget email to SA users. Non-blocking."""
    try:
        from app.utils.email import send_email

        html = f"""
        <h2>New LMS Feedback</h2>
        <p><strong>Type:</strong> {feedback_type}</p>
        <p><strong>Subject:</strong> {subject}</p>
        <p><strong>Rating:</strong> {rating or 'N/A'}/5</p>
        <p><strong>Anonymous:</strong> {'Yes' if is_anonymous else 'No'}</p>
        <br>
        <p><a href="{settings.FRONTEND_URL or 'https://zensbot.online'}/sa/feedback">View in Dashboard</a></p>
        """
        for email in sa_emails:
            send_email(
                to=email,
                subject=f"[LMS Feedback] New {feedback_type}: {subject[:80]}",
                html=html,
            )
    except Exception as e:
        logger.warning("Failed to send feedback email: %s", e)


# ── List ──

async def list_feedbacks(
    session: AsyncSession,
    current_user: User,
    page: int = 1,
    per_page: int = 20,
    feedback_type: Optional[str] = None,
    status: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    rating: Optional[int] = None,
) -> tuple[list[dict], int]:
    """SA: all feedbacks. Others: own feedbacks only."""
    is_sa = current_user.role == UserRole.super_admin

    query = select(Feedback).where(Feedback.deleted_at.is_(None))

    if not is_sa:
        query = query.where(Feedback.user_id == current_user.id)
        if current_user.institute_id:
            query = query.where(Feedback.institute_id == current_user.institute_id)
    else:
        if institute_id:
            query = query.where(Feedback.institute_id == institute_id)

    if feedback_type:
        query = query.where(Feedback.feedback_type == feedback_type)
    if status:
        query = query.where(Feedback.status == status)
    if rating:
        query = query.where(Feedback.rating == rating)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            col(Feedback.subject).ilike(pattern) | col(Feedback.description).ilike(pattern)
        )
    if date_from:
        query = query.where(Feedback.created_at >= date_from)
    if date_to:
        query = query.where(Feedback.created_at <= date_to)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_q)).scalar() or 0

    # Paginated results
    query = query.order_by(Feedback.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await session.execute(query)
    feedbacks = result.scalars().all()

    if not feedbacks:
        return [], total

    # Batch-load user names
    user_ids = {f.user_id for f in feedbacks}
    user_result = await session.execute(
        select(User.id, User.name).where(User.id.in_(user_ids))
    )
    user_names = {row[0]: row[1] for row in user_result.all()}

    # Batch-load institute names
    inst_ids = {f.institute_id for f in feedbacks if f.institute_id}
    inst_names: dict[uuid.UUID, str] = {}
    if inst_ids:
        inst_result = await session.execute(
            select(Institute.id, Institute.name).where(Institute.id.in_(inst_ids))
        )
        inst_names = {row[0]: row[1] for row in inst_result.all()}

    # Batch-load attachment counts
    fb_ids = [f.id for f in feedbacks]
    att_result = await session.execute(
        select(
            FeedbackAttachment.feedback_id,
            func.count(FeedbackAttachment.id),
        ).where(FeedbackAttachment.feedback_id.in_(fb_ids))
        .group_by(FeedbackAttachment.feedback_id)
    )
    att_counts = {row[0]: row[1] for row in att_result.all()}

    # Batch-load response counts
    resp_result = await session.execute(
        select(
            FeedbackResponse.feedback_id,
            func.count(FeedbackResponse.id),
        ).where(FeedbackResponse.feedback_id.in_(fb_ids))
        .group_by(FeedbackResponse.feedback_id)
    )
    resp_counts = {row[0]: row[1] for row in resp_result.all()}

    items = []
    for f in feedbacks:
        item = {
            "id": f.id,
            "feedback_type": f.feedback_type.value if hasattr(f.feedback_type, "value") else f.feedback_type,
            "subject": f.subject,
            "rating": f.rating,
            "status": f.status.value if hasattr(f.status, "value") else f.status,
            "is_anonymous": f.is_anonymous,
            "user_role": f.user_role,
            "institute_id": f.institute_id,
            "institute_name": inst_names.get(f.institute_id) if f.institute_id else None,
            "attachment_count": att_counts.get(f.id, 0),
            "response_count": resp_counts.get(f.id, 0),
            "created_at": f.created_at,
        }
        # Mask user identity when anonymous (for SA view)
        if f.is_anonymous and is_sa:
            item["user_name"] = None
        else:
            item["user_name"] = user_names.get(f.user_id)

        items.append(item)

    return items, total


# ── Get detail ──

async def get_feedback(
    session: AsyncSession,
    feedback_id: uuid.UUID,
    current_user: User,
) -> Optional[dict]:
    """Full detail view."""
    is_sa = current_user.role == UserRole.super_admin

    result = await session.execute(
        select(Feedback).where(
            Feedback.id == feedback_id,
            Feedback.deleted_at.is_(None),
        )
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        return None

    # Non-SA can only view own feedback
    if not is_sa and feedback.user_id != current_user.id:
        return None

    # Load attachments with presigned view URLs
    att_result = await session.execute(
        select(FeedbackAttachment).where(FeedbackAttachment.feedback_id == feedback_id)
    )
    attachments = []
    for att in att_result.scalars().all():
        try:
            view_url = generate_view_url(att.object_key)
        except Exception:
            view_url = None
        attachments.append({
            "id": att.id,
            "file_name": att.file_name,
            "content_type": att.content_type,
            "file_size": att.file_size,
            "view_url": view_url,
        })

    # Load responses
    resp_query = select(FeedbackResponse).where(
        FeedbackResponse.feedback_id == feedback_id
    ).order_by(FeedbackResponse.created_at.asc())
    if not is_sa:
        # Non-SA only sees non-internal responses
        resp_query = resp_query.where(FeedbackResponse.is_internal == False)  # noqa: E712

    resp_result = await session.execute(resp_query)
    responses_raw = resp_result.scalars().all()

    # Batch-load responder names
    responder_ids = {r.responder_id for r in responses_raw}
    responder_names: dict[uuid.UUID, str] = {}
    if responder_ids:
        rn_result = await session.execute(
            select(User.id, User.name).where(User.id.in_(responder_ids))
        )
        responder_names = {row[0]: row[1] for row in rn_result.all()}

    responses = [
        {
            "id": r.id,
            "feedback_id": r.feedback_id,
            "responder_id": r.responder_id,
            "responder_name": responder_names.get(r.responder_id),
            "message": r.message,
            "is_internal": r.is_internal,
            "created_at": r.created_at,
        }
        for r in responses_raw
    ]

    # Load user name + institute name
    user_result = await session.execute(
        select(User.name, User.email).where(User.id == feedback.user_id)
    )
    user_row = user_result.first()

    inst_name = None
    if feedback.institute_id:
        inst_result = await session.execute(
            select(Institute.name).where(Institute.id == feedback.institute_id)
        )
        inst_name = inst_result.scalar_one_or_none()

    out = _feedback_to_dict(feedback)
    out["attachments"] = attachments
    out["responses"] = responses
    out["institute_name"] = inst_name

    if feedback.is_anonymous and is_sa:
        out["user_id"] = None
        out["user_name"] = None
        out["user_email"] = None
    else:
        out["user_name"] = user_row[0] if user_row else None
        out["user_email"] = user_row[1] if user_row else None

    return out


# ── Update status ──

async def update_feedback_status(
    session: AsyncSession,
    feedback_id: uuid.UUID,
    new_status: str,
) -> Optional[dict]:
    """SA-only. Update feedback status."""
    try:
        FeedbackStatus(new_status)
    except ValueError:
        raise ValueError(f"Invalid status: {new_status}")

    result = await session.execute(
        select(Feedback).where(
            Feedback.id == feedback_id,
            Feedback.deleted_at.is_(None),
        )
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        return None

    feedback.status = FeedbackStatus(new_status)
    feedback.updated_at = datetime.now(timezone.utc)
    session.add(feedback)
    await session.commit()
    await session.refresh(feedback)

    return _feedback_to_dict(feedback)


# ── Add response ──

async def add_feedback_response(
    session: AsyncSession,
    feedback_id: uuid.UUID,
    responder_id: uuid.UUID,
    message: str,
    is_internal: bool = False,
) -> Optional[dict]:
    """SA-only. Add response or internal note."""
    from app.services import notification_service

    result = await session.execute(
        select(Feedback).where(
            Feedback.id == feedback_id,
            Feedback.deleted_at.is_(None),
        )
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        return None

    response = FeedbackResponse(
        feedback_id=feedback_id,
        responder_id=responder_id,
        message=message,
        is_internal=is_internal,
    )
    session.add(response)
    await session.commit()
    await session.refresh(response)

    # Notify submitter for user-visible responses
    if not is_internal:
        try:
            await notification_service.create_notification(
                session,
                user_id=feedback.user_id,
                type="feedback_response",
                title="Response to your feedback",
                message=f"Your feedback \"{feedback.subject[:50]}\" received a response",
                link=f"/feedback",
                institute_id=feedback.institute_id,
            )
        except Exception as e:
            logger.warning("Failed to notify user about feedback response: %s", e)

    # Load responder name
    rn_result = await session.execute(
        select(User.name).where(User.id == responder_id)
    )
    responder_name = rn_result.scalar_one_or_none()

    return {
        "id": response.id,
        "feedback_id": response.feedback_id,
        "responder_id": response.responder_id,
        "responder_name": responder_name,
        "message": response.message,
        "is_internal": response.is_internal,
        "created_at": response.created_at,
    }


# ── Soft delete ──

async def soft_delete_feedback(
    session: AsyncSession,
    feedback_id: uuid.UUID,
) -> bool:
    result = await session.execute(
        select(Feedback).where(
            Feedback.id == feedback_id,
            Feedback.deleted_at.is_(None),
        )
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        return False

    feedback.deleted_at = datetime.now(timezone.utc)
    session.add(feedback)
    await session.commit()
    return True


# ── Analytics ──

async def get_feedback_analytics(
    session: AsyncSession,
    period_days: int = 30,
) -> dict:
    """SA-only analytics dashboard data."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)
    base = select(Feedback).where(
        Feedback.deleted_at.is_(None),
        Feedback.created_at >= cutoff,
    )

    # Total count
    total_q = select(func.count()).select_from(base.subquery())
    total_count = (await session.execute(total_q)).scalar() or 0

    # By type
    type_q = (
        select(Feedback.feedback_type, func.count())
        .where(Feedback.deleted_at.is_(None), Feedback.created_at >= cutoff)
        .group_by(Feedback.feedback_type)
    )
    type_result = await session.execute(type_q)
    by_type = {
        (row[0].value if hasattr(row[0], "value") else row[0]): row[1]
        for row in type_result.all()
    }

    # By status
    status_q = (
        select(Feedback.status, func.count())
        .where(Feedback.deleted_at.is_(None), Feedback.created_at >= cutoff)
        .group_by(Feedback.status)
    )
    status_result = await session.execute(status_q)
    by_status = {
        (row[0].value if hasattr(row[0], "value") else row[0]): row[1]
        for row in status_result.all()
    }

    # Unresolved count (not done, not declined)
    unresolved_q = (
        select(func.count())
        .select_from(Feedback)
        .where(
            Feedback.deleted_at.is_(None),
            Feedback.status.notin_([FeedbackStatus.done, FeedbackStatus.declined]),
        )
    )
    unresolved_count = (await session.execute(unresolved_q)).scalar() or 0

    # Average rating
    avg_q = (
        select(func.avg(Feedback.rating))
        .where(
            Feedback.deleted_at.is_(None),
            Feedback.created_at >= cutoff,
            Feedback.rating.isnot(None),
        )
    )
    avg_rating_raw = (await session.execute(avg_q)).scalar()
    avg_rating = round(float(avg_rating_raw), 2) if avg_rating_raw else None

    # Rating distribution
    dist_q = (
        select(Feedback.rating, func.count())
        .where(
            Feedback.deleted_at.is_(None),
            Feedback.created_at >= cutoff,
            Feedback.rating.isnot(None),
        )
        .group_by(Feedback.rating)
    )
    dist_result = await session.execute(dist_q)
    rating_distribution = {row[0]: row[1] for row in dist_result.all()}

    # By institute (top 10)
    inst_q = (
        select(Feedback.institute_id, func.count().label("cnt"))
        .where(
            Feedback.deleted_at.is_(None),
            Feedback.created_at >= cutoff,
            Feedback.institute_id.isnot(None),
        )
        .group_by(Feedback.institute_id)
        .order_by(text("cnt DESC"))
        .limit(10)
    )
    inst_result = await session.execute(inst_q)
    inst_rows = inst_result.all()

    # Load institute names
    inst_ids = [row[0] for row in inst_rows if row[0]]
    inst_name_map: dict[uuid.UUID, str] = {}
    if inst_ids:
        in_result = await session.execute(
            select(Institute.id, Institute.name).where(Institute.id.in_(inst_ids))
        )
        inst_name_map = {r[0]: r[1] for r in in_result.all()}

    by_institute = [
        {
            "institute_id": str(row[0]),
            "name": inst_name_map.get(row[0], "Unknown"),
            "count": row[1],
        }
        for row in inst_rows
    ]

    # Satisfaction trend (daily avg rating)
    trend_q = (
        select(
            func.date_trunc("day", Feedback.created_at).label("day"),
            func.avg(Feedback.rating).label("avg_r"),
            func.count().label("cnt"),
        )
        .where(
            Feedback.deleted_at.is_(None),
            Feedback.created_at >= cutoff,
            Feedback.rating.isnot(None),
        )
        .group_by(text("day"))
        .order_by(text("day"))
    )
    trend_result = await session.execute(trend_q)
    satisfaction_trend = [
        {
            "date": row[0].isoformat() if row[0] else None,
            "avg_rating": round(float(row[1]), 2) if row[1] else None,
            "count": row[2],
        }
        for row in trend_result.all()
    ]

    # Volume trend (daily count)
    vol_q = (
        select(
            func.date_trunc("day", Feedback.created_at).label("day"),
            func.count().label("cnt"),
        )
        .where(
            Feedback.deleted_at.is_(None),
            Feedback.created_at >= cutoff,
        )
        .group_by(text("day"))
        .order_by(text("day"))
    )
    vol_result = await session.execute(vol_q)
    volume_trend = [
        {"date": row[0].isoformat() if row[0] else None, "count": row[1]}
        for row in vol_result.all()
    ]

    # Top feature requests (most common subjects)
    feat_q = (
        select(Feedback.subject, func.count().label("cnt"))
        .where(
            Feedback.deleted_at.is_(None),
            Feedback.feedback_type == FeedbackType.feature_request,
            Feedback.created_at >= cutoff,
        )
        .group_by(Feedback.subject)
        .order_by(text("cnt DESC"))
        .limit(10)
    )
    feat_result = await session.execute(feat_q)
    top_feature_requests = [
        {"subject": row[0], "count": row[1]}
        for row in feat_result.all()
    ]

    # Average response time (hours from submission to first non-internal response)
    resp_time_q = text("""
        SELECT AVG(EXTRACT(EPOCH FROM (fr.created_at - f.created_at)) / 3600)
        FROM feedback_responses fr
        JOIN feedbacks f ON fr.feedback_id = f.id
        WHERE fr.is_internal = false
          AND f.deleted_at IS NULL
          AND f.created_at >= :cutoff
          AND fr.created_at = (
              SELECT MIN(fr2.created_at)
              FROM feedback_responses fr2
              WHERE fr2.feedback_id = f.id AND fr2.is_internal = false
          )
    """)
    resp_time_result = await session.execute(resp_time_q, {"cutoff": cutoff})
    avg_resp_raw = resp_time_result.scalar()
    avg_response_time_hours = round(float(avg_resp_raw), 1) if avg_resp_raw else None

    return {
        "total_count": total_count,
        "by_type": by_type,
        "by_status": by_status,
        "by_institute": by_institute,
        "avg_rating": avg_rating,
        "rating_distribution": rating_distribution,
        "unresolved_count": unresolved_count,
        "avg_response_time_hours": avg_response_time_hours,
        "satisfaction_trend": satisfaction_trend,
        "volume_trend": volume_trend,
        "top_feature_requests": top_feature_requests,
    }


# ── Helpers ──

def _feedback_to_dict(feedback: Feedback) -> dict:
    return {
        "id": feedback.id,
        "feedback_type": feedback.feedback_type.value if hasattr(feedback.feedback_type, "value") else feedback.feedback_type,
        "subject": feedback.subject,
        "description": feedback.description,
        "rating": feedback.rating,
        "status": feedback.status.value if hasattr(feedback.status, "value") else feedback.status,
        "is_anonymous": feedback.is_anonymous,
        "user_id": feedback.user_id,
        "user_role": feedback.user_role,
        "institute_id": feedback.institute_id,
        "client_context": feedback.client_context,
        "created_at": feedback.created_at,
        "updated_at": feedback.updated_at,
    }

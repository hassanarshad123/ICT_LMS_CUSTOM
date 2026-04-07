import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func
from sqlmodel import select

from app.models.institute import Institute, InstituteUsage, InstituteStatus, PlanTier
from app.models.user import User
from app.models.enums import UserRole
from app.models.activity import ActivityLog
from app.utils.security import hash_password
from app.utils.plan_limits import PLAN_LIMITS
from app.config import get_settings
from app.schemas.validators import _SLUG_RE

RESERVED_SLUGS = frozenset({
    # System routes
    "www", "api", "admin", "sa", "app", "auth", "oauth",
    # Pages
    "login", "register", "signup", "dashboard", "profile", "settings",
    "help", "support", "docs", "blog", "status", "terms", "privacy",
    # Infrastructure
    "mail", "smtp", "ftp", "cdn", "assets", "static", "media", "files",
    "download", "upload",
    # Environments
    "test", "staging", "dev", "demo", "sandbox",
    # Common subdomains
    "ns1", "ns2", "mx", "pop", "imap", "webmail",
    # Major brands (prevent impersonation)
    "google", "microsoft", "facebook", "amazon", "apple", "netflix",
    "meta", "twitter", "instagram", "tiktok", "whatsapp", "linkedin",
    "github", "openai", "zensbot",
    # Competitors (prevent confusion)
    "coursera", "udemy", "edx", "canvas", "moodle", "blackboard",
    "classroom", "teachable", "thinkific", "skillshare", "khan",
    # System / abuse prevention
    "root", "null", "undefined", "system", "moderator",
    "billing", "payment", "security", "verify", "official", "secure",
    "account", "certificate", "webhook", "notify", "email",
})

# Block patterns like admin123, test42, demo-1, free99, etc.
_BLOCKED_SLUG_PATTERN = re.compile(
    r"^(admin|test|demo|free|trial|premium|temp|fake|www|api)\d*(-\d+)?$"
)


def validate_slug_format(slug: str) -> tuple[bool, str]:
    """Validate slug format and check reserved words. Returns (valid, reason)."""
    if not _SLUG_RE.match(slug):
        return False, "Slug must be 3-30 lowercase alphanumeric characters or hyphens"
    if "--" in slug:
        return False, "Slug cannot contain consecutive hyphens"
    if slug in RESERVED_SLUGS:
        return False, "This slug is reserved"
    if _BLOCKED_SLUG_PATTERN.match(slug):
        return False, "This slug is reserved"
    return True, "Valid format"


async def check_slug_availability(session: AsyncSession, slug: str) -> tuple[bool, str]:
    """Check if slug is available. Returns (available, reason)."""
    valid, reason = validate_slug_format(slug)
    if not valid:
        return False, reason

    result = await session.execute(
        select(Institute.id).where(
            Institute.slug == slug,
            Institute.deleted_at.is_(None),
        )
    )
    if result.scalar_one_or_none() is not None:
        return False, "This slug is already taken"

    return True, "Available"


async def _check_signup_cooldown(
    session: AsyncSession,
    email: str,
    phone: Optional[str],
    cooldown_days: int,
) -> None:
    """Block re-signup from the same email or phone within the cooldown window.

    Prevents the "signup → 14-day trial → let expire → signup again with same
    contact info" abuse pattern. Checks ActivityLog for prior
    institute_self_registered events.

    Raises ValueError with a user-friendly message if a prior signup exists.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=cooldown_days)

    # Look for any previous self-signup with this email as the admin.
    # The signup router logs: action='institute_self_registered' with
    # details={'admin_email': ..., 'slug': ...}
    filters = [
        ActivityLog.action == "institute_self_registered",
        ActivityLog.created_at >= cutoff,
        func.lower(ActivityLog.details["admin_email"].astext) == email.lower(),
    ]

    result = await session.execute(
        select(ActivityLog.id).where(*filters).limit(1)
    )
    if result.scalar_one_or_none() is not None:
        raise ValueError(
            f"An account with this email signed up within the last {cooldown_days} days. "
            f"Please wait before creating another trial, or contact support@zensbot.com."
        )

    # Also check by phone if provided
    if phone:
        phone_filters = [
            ActivityLog.action == "institute_self_registered",
            ActivityLog.created_at >= cutoff,
            ActivityLog.details["admin_phone"].astext == phone,
        ]
        result = await session.execute(
            select(ActivityLog.id).where(*phone_filters).limit(1)
        )
        if result.scalar_one_or_none() is not None:
            raise ValueError(
                f"An account with this phone number signed up within the last "
                f"{cooldown_days} days. Please wait before creating another trial."
            )


async def create_institute_with_admin(
    session: AsyncSession,
    name: str,
    email: str,
    password: str,
    phone: Optional[str],
    institute_name: str,
    institute_slug: str,
) -> tuple[Institute, User]:
    """Create institute + admin user in one atomic transaction."""
    email = email.strip().lower()
    settings = get_settings()

    # Re-signup cooldown: block repeat trials from the same contact info.
    await _check_signup_cooldown(
        session, email, phone, settings.TRIAL_COOLDOWN_DAYS,
    )

    trial_days = settings.TRIAL_DURATION_DAYS
    # Source trial defaults from the authoritative PLAN_LIMITS dict
    trial_limits = PLAN_LIMITS[PlanTier.free]
    max_students = trial_limits["students"]
    max_storage_gb = trial_limits["storage_gb"]
    max_video_gb = trial_limits["video_gb"]
    # max_users stays generous (staff uncounted); not the enforcement lever
    max_users = max_students + 5

    # Create institute
    institute = Institute(
        name=institute_name,
        slug=institute_slug,
        contact_email=email,
        status=InstituteStatus.trial,
        plan_tier=PlanTier.free,
        max_users=max_users,
        max_students=max_students,
        max_storage_gb=max_storage_gb,
        max_video_gb=max_video_gb,
        expires_at=datetime.now(timezone.utc) + timedelta(days=trial_days),
    )
    session.add(institute)
    await session.flush()  # get institute.id without committing

    # Create usage tracking
    usage = InstituteUsage(
        institute_id=institute.id,
        current_users=1,  # the admin we're about to create
        last_calculated_at=datetime.now(timezone.utc),
    )
    session.add(usage)

    # Create admin user
    user = User(
        email=email,
        name=name,
        phone=phone,
        hashed_password=hash_password(password),
        role=UserRole.admin,
        institute_id=institute.id,
    )
    session.add(user)

    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        error_str = str(e.orig) if e.orig else str(e)
        if "uq_institutes_slug" in error_str or "ix_institutes_slug" in error_str:
            raise ValueError("This slug is already taken") from e
        if "uq_users_email_institute" in error_str:
            raise ValueError("An account with this email already exists") from e
        raise ValueError("Registration failed. Please try again.") from e

    await session.refresh(institute)
    await session.refresh(user)
    return institute, user

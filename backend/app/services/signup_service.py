import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func
from sqlmodel import select

from app.models.institute import Institute, InstituteUsage, InstituteStatus, PlanTier
from app.models.billing import InstituteBilling
from app.models.user import User
from app.models.enums import UserRole
from app.models.activity import ActivityLog
from app.utils.security import hash_password
from app.utils.plan_limits import PLAN_LIMITS, is_v2_billing_tier
from app.config import get_settings
from app.schemas.validators import _SLUG_RE

# Sentinel "soft unlimited" — used for v2 tiers where per-student caps are
# replaced by overage billing (see InstituteBilling.extra_user_rate).
# A 7-digit cap large enough to never be hit in practice keeps the column
# type `int NOT NULL` without introducing nullable plumbing everywhere.
_UNLIMITED_SENTINEL_INT = 1_000_000

# Professional tier billing defaults (pricing-model-v2). These get persisted
# into InstituteBilling at signup so the monthly invoice cron has a row to
# read from on the 1st of each month.
_PROFESSIONAL_EXTRA_USER_RATE_PKR = 80
_PROFESSIONAL_FREE_USERS_INCLUDED = 10

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


def _resolve_signup_tier(raw: str) -> PlanTier:
    """Resolve the SIGNUP_DEFAULT_TIER env value to a PlanTier enum.

    Falls back to PlanTier.free if the configured value is not a known
    tier — this keeps a broken env var from breaking signups entirely.
    """
    try:
        return PlanTier(raw)
    except ValueError:
        return PlanTier.free


def _institute_kwargs_for_tier(tier: PlanTier) -> dict:
    """Build Institute() kwargs (status, expires_at, quota caps) for a tier.

    v2 tiers (professional, custom):
      - status=active (no trial)
      - expires_at=None (no auto-suspend)
      - max_students uses a soft-unlimited sentinel; overage is billed
        monthly via InstituteBilling.extra_user_rate
      - storage/video limits from PLAN_LIMITS (None → sentinel)

    Free / grandfathered tiers:
      - status=trial, expires_at=now+TRIAL_DURATION_DAYS
      - hard caps from PLAN_LIMITS
    """
    limits = PLAN_LIMITS[tier]

    if is_v2_billing_tier(tier):
        max_students = limits.get("students") or _UNLIMITED_SENTINEL_INT
        return {
            "status": InstituteStatus.active,
            "plan_tier": tier,
            "max_users": _UNLIMITED_SENTINEL_INT,
            "max_students": max_students,
            "max_storage_gb": limits.get("storage_gb") or float(_UNLIMITED_SENTINEL_INT),
            "max_video_gb": limits.get("video_gb") or float(_UNLIMITED_SENTINEL_INT),
            "expires_at": None,
        }

    settings = get_settings()
    max_students = limits["students"]
    return {
        "status": InstituteStatus.trial,
        "plan_tier": tier,
        "max_users": max_students + 5,
        "max_students": max_students,
        "max_storage_gb": limits["storage_gb"],
        "max_video_gb": limits["video_gb"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=settings.TRIAL_DURATION_DAYS),
    }


def _initial_billing_for_tier(
    institute_id: uuid.UUID, tier: PlanTier,
) -> Optional[InstituteBilling]:
    """Provision the InstituteBilling row for v2 signups.

    Professional gets the standard Rs 80/extra-student rate plus 10 free
    seats. Custom is negotiated per deal, so SA fills in extra_user_rate
    and custom_pricing_config later — we still create the row so the
    monthly invoice cron has something to read.

    Returns None for grandfathered / trial tiers (they have no v2 billing
    row).
    """
    if not is_v2_billing_tier(tier):
        return None

    if tier == PlanTier.professional:
        return InstituteBilling(
            institute_id=institute_id,
            base_amount=0,
            currency="PKR",
            billing_cycle="monthly",
            extra_user_rate=_PROFESSIONAL_EXTRA_USER_RATE_PKR,
            free_users_included=_PROFESSIONAL_FREE_USERS_INCLUDED,
        )

    # Custom tier: SA will fill in extra_user_rate + custom_pricing_config
    # post-signup when the deal is quoted. Default to zero-billed so nothing
    # accidental gets charged before the deal is finalized.
    return InstituteBilling(
        institute_id=institute_id,
        base_amount=0,
        currency="PKR",
        billing_cycle="monthly",
        extra_user_rate=0,
        free_users_included=0,
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
    """Create institute + admin user in one atomic transaction.

    The tier assigned to new signups is controlled by
    settings.SIGNUP_DEFAULT_TIER (defaults to "professional" in v2).
    V2 tiers skip the trial path, activate immediately, and get an
    InstituteBilling row provisioned for the monthly invoice cron.
    """
    email = email.strip().lower()
    settings = get_settings()

    # Re-signup cooldown: block repeat trials from the same contact info.
    # Still applies on v2 signups so a single admin can't spin up N free
    # Professional tenants to abuse the free-forever student allowance.
    await _check_signup_cooldown(
        session, email, phone, settings.TRIAL_COOLDOWN_DAYS,
    )

    tier = _resolve_signup_tier(settings.SIGNUP_DEFAULT_TIER)
    inst_kwargs = _institute_kwargs_for_tier(tier)

    institute = Institute(
        name=institute_name,
        slug=institute_slug,
        contact_email=email,
        **inst_kwargs,
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

    # V2 tiers (professional, custom) get an InstituteBilling row so the
    # monthly invoice cron can find them. Grandfathered / trial tiers
    # deliberately skip this — they're handled outside the v2 engine.
    billing = _initial_billing_for_tier(institute.id, tier)
    if billing is not None:
        session.add(billing)

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

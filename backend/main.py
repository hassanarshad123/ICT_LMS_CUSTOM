import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.utils.rate_limit import limiter

from app.config import get_settings
from app.routers import auth, users, batches, courses, curriculum, lectures, materials, jobs, announcements, zoom, admin, certificates, monitoring, branding, notifications, search, super_admin, api_keys, webhooks, public_api, quizzes, signup, sa_analytics, sa_monitoring, sa_operations, sa_billing, feedback, upgrade, admissions, integrations, billing, payment_proof, email_templates
from app.websockets.routes import router as ws_router
from app.middleware.error_tracking import ErrorTrackingMiddleware
from app.exceptions import NotFoundError, DuplicateError, ForbiddenError, ValidationError

settings = get_settings()

import os as _os

if _os.getenv("APP_ENV") == "production":
    # Structured JSON logging for production (queryable by CloudWatch/ELK/Datadog)
    try:
        from pythonjsonlogger import jsonlogger
        _handler = logging.StreamHandler()
        _handler.setFormatter(jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        ))
        logging.root.handlers = [_handler]
        logging.root.setLevel(logging.INFO)
    except ImportError:
        # Fallback if python-json-logger not installed
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
else:
    # Human-readable text format for development
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

# ── Sentry ──────────────────────────────────────────────────────
from app.core.sentry import init_sentry
init_sentry(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.sentry import capture_exception_safe

    # Startup — Redis cache
    from app.core.redis import init_redis, close_redis
    redis_result = await init_redis()
    if redis_result is None and settings.CACHE_ENABLED:
        try:
            import sentry_sdk
            sentry_sdk.capture_message("Redis unavailable at startup — caching disabled", level="warning")
        except Exception:
            pass

    # Startup — Zoom API httpx client (connection pooling)
    from app.utils.zoom_api import startup as zoom_startup, shutdown as zoom_shutdown
    await zoom_startup()

    # Startup — WebSocket Pub/Sub listener (cross-worker notification delivery)
    from app.websockets.pubsub import start_pubsub_listener
    pubsub_task = await start_pubsub_listener()

    # Startup — start scheduler on every slot. Per-job Redis ownership check
    # inside sentry_job_wrapper prevents duplicate runs during blue-green
    # cutover. Set SCHEDULER_ENABLED=false only as an emergency kill-switch
    # (e.g. to pause all recurring jobs without restarting both slots).
    if settings.SCHEDULER_ENABLED:
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            from app.scheduler.jobs import cleanup_expired_sessions, send_zoom_reminders, retry_failed_recordings, cleanup_stale_uploads, auto_suspend_expired_institutes, process_webhook_deliveries, recalculate_all_usage, send_batch_expiry_notifications, sync_stuck_video_statuses, send_trial_expiry_warnings, deactivate_unverified_users, purge_stale_records, backfill_video_durations, send_fee_reminders, process_frappe_sync_tasks, send_integration_weekly_digest, enforce_overdue_access_revocation, refresh_payment_erp_statuses
            from app.scheduler.billing_jobs import generate_monthly_invoices, enforce_late_payments

            scheduler = AsyncIOScheduler()
            scheduler.add_job(cleanup_expired_sessions, "interval", hours=1, id="cleanup_sessions")
            scheduler.add_job(send_zoom_reminders, "interval", minutes=10, id="zoom_reminders")
            scheduler.add_job(retry_failed_recordings, "interval", minutes=30, id="retry_recordings")
            scheduler.add_job(cleanup_stale_uploads, "interval", hours=24, id="cleanup_stale_uploads")
            scheduler.add_job(auto_suspend_expired_institutes, "interval", hours=24, id="auto_suspend_institutes")
            scheduler.add_job(process_webhook_deliveries, "interval", minutes=1, id="webhook_deliveries")
            scheduler.add_job(process_frappe_sync_tasks, "interval", seconds=30, id="frappe_sync_tasks")
            scheduler.add_job(recalculate_all_usage, "interval", hours=24, id="recalculate_usage")
            scheduler.add_job(send_batch_expiry_notifications, "interval", hours=24, id="batch_expiry_notifications")
            scheduler.add_job(send_fee_reminders, "interval", hours=24, id="fee_reminders")
            # Daily overdue-invoice enforcement for Frappe-enabled institutes.
            # 19:00 UTC == 00:00 PKT (Asia/Karachi, UTC+5) — runs at midnight
            # local time so any installment that crossed its due_date during
            # the day is enforced before the next business morning.
            scheduler.add_job(enforce_overdue_access_revocation, "cron", hour=19, minute=0, id="frappe_overdue_suspension")
            # Daily ERP-status refresh at 00:30 PKT (19:30 UTC). Mirrors every
            # pending PE's docstatus + every linked SI's status so the AO UI
            # shows live state without a round-trip. 30 min offset from the
            # suspension job so they don't collide on Frappe concurrency.
            scheduler.add_job(refresh_payment_erp_statuses, "cron", hour=19, minute=30, id="payment_erp_status_refresh")
            scheduler.add_job(sync_stuck_video_statuses, "interval", minutes=30, id="sync_stuck_videos")
            scheduler.add_job(send_trial_expiry_warnings, "interval", hours=24, id="trial_expiry_warnings")
            scheduler.add_job(deactivate_unverified_users, "interval", hours=12, id="deactivate_unverified")
            scheduler.add_job(purge_stale_records, "interval", hours=24, id="purge_stale_records")
            scheduler.add_job(backfill_video_durations, "interval", hours=6, id="backfill_durations")
            # Weekly Frappe sync digest — fires every 24h, but the job itself
            # dedupes per institute on a 6-day Redis cache so admins get one
            # email per week max even if the job fires daily.
            scheduler.add_job(send_integration_weekly_digest, "interval", hours=24, id="integration_weekly_digest")
            # Pricing v2 billing engine — dormant until a professional/custom
            # institute exists (query filters to those tiers only). First
            # deploys with BILLING_CRON_DRY_RUN=True so jobs log intent without
            # writing. Flip the env var to False after a calendar cycle is
            # manually verified. See docs/pricing-model-v2.md.
            scheduler.add_job(generate_monthly_invoices, "cron", day=1, hour=0, minute=5, id="v2_monthly_billing")
            scheduler.add_job(enforce_late_payments, "cron", hour=2, minute=0, id="v2_late_payment")
            scheduler.start()
            app.state.scheduler = scheduler
            logging.getLogger("ict_lms").info("Scheduler started (slot=%s)", settings.DEPLOY_SLOT)
        except Exception as e:
            logging.getLogger("ict_lms").warning("Scheduler not started: %s", e)
            capture_exception_safe(e)
    else:
        logging.getLogger("ict_lms").info("Scheduler disabled (slot=%s)", settings.DEPLOY_SLOT)

    # DRY_RUN prod alarm — if the billing cron is in dry-run mode while
    # running in production, log a loud warning and send a Sentry
    # breadcrumb. Dry-run is the safe default for first deploys, but
    # leaving it on silently would mean v2 invoices never actually
    # issue. See docs/pricing-model-v2.md for the flip procedure.
    app_env = (settings.APP_ENV or "").lower()
    if app_env == "production" and settings.BILLING_CRON_DRY_RUN:
        logging.getLogger("ict_lms").warning(
            "BILLING_CRON_DRY_RUN=True in production — v2 invoice "
            "generation is disabled. Flip the env var after one "
            "verified dry cycle.",
        )
        try:
            import sentry_sdk
            sentry_sdk.capture_message(
                "billing_cron_dry_run_enabled_in_prod",
                level="warning",
            )
        except Exception:
            pass

    yield

    # Shutdown
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown()
    if pubsub_task is not None:
        pubsub_task.cancel()
    await zoom_shutdown()
    await close_redis()


app = FastAPI(
    title="ICT Institute LMS API",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Custom exception handlers ─────────────────────────────────
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(DuplicateError)
async def duplicate_handler(request: Request, exc: DuplicateError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Error tracking + request logging (replaces old RequestLoggingMiddleware)
app.add_middleware(ErrorTrackingMiddleware)

# CORS — support multi-tenant subdomains
origins = [settings.FRONTEND_URL]
if settings.ALLOWED_ORIGINS:
    origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]

allow_origin_regex = None
if settings.FRONTEND_BASE_DOMAIN:
    import re
    escaped = re.escape(settings.FRONTEND_BASE_DOMAIN)
    allow_origin_regex = rf"^https?://([a-zA-Z0-9\-]+\.)?{escaped}$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Institute-Slug", "X-API-Key", "X-Request-ID"],
)

# API v1 Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(batches.router, prefix="/api/v1/batches", tags=["Batches"])
app.include_router(courses.router, prefix="/api/v1/courses", tags=["Courses"])
app.include_router(curriculum.router, prefix="/api/v1/curriculum", tags=["Curriculum"])
app.include_router(lectures.router, prefix="/api/v1/lectures", tags=["Lectures"])
app.include_router(materials.router, prefix="/api/v1/materials", tags=["Materials"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["Jobs"])
app.include_router(announcements.router, prefix="/api/v1/announcements", tags=["Announcements"])
app.include_router(zoom.router, prefix="/api/v1/zoom", tags=["Zoom"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["Certificates"])
app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["Monitoring"])
app.include_router(branding.router, prefix="/api/v1/branding", tags=["Branding"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(email_templates.router, prefix="/api/v1", tags=["Email Templates"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
app.include_router(super_admin.router, prefix="/api/v1/super-admin", tags=["Super Admin"])
app.include_router(sa_analytics.router, prefix="/api/v1/super-admin/analytics", tags=["SA Analytics"])
app.include_router(sa_monitoring.router, prefix="/api/v1/super-admin/monitoring", tags=["SA Monitoring"])
app.include_router(sa_operations.router, prefix="/api/v1/super-admin/operations", tags=["SA Operations"])
app.include_router(sa_billing.router, prefix="/api/v1/super-admin", tags=["SA Billing"])
app.include_router(api_keys.router, prefix="/api/v1/admin/api-keys", tags=["API Keys"])
app.include_router(webhooks.router, prefix="/api/v1/admin/webhooks", tags=["Webhooks"])
app.include_router(public_api.router, prefix="/api/v1/public", tags=["Public API"])
app.include_router(quizzes.router, prefix="/api/v1/quizzes", tags=["Quizzes"])
app.include_router(signup.router, prefix="/api/v1/signup", tags=["Signup"])
app.include_router(feedback.router, prefix="/api/v1/feedback", tags=["Feedback"])
# Upgrade endpoints: admins request upgrade, SAs approve.
# Router mounts both /upgrade/request (admin) and /upgrade/approve/:id (SA).
app.include_router(upgrade.router, prefix="/api/v1/upgrade", tags=["Upgrade"])
app.include_router(admissions.router, prefix="/api/v1/admissions", tags=["Admissions"])
app.include_router(payment_proof.router, prefix="/api/v1/admissions", tags=["Admissions — Payment Proof"])
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations"])
# Admin-facing billing (pricing v2). Tier-gated internally — grandfathered
# institutes (like ICT) get 403 from every endpoint.
app.include_router(billing.router, prefix="/api/v1/billing", tags=["Billing"])

# WebSocket routes
app.include_router(ws_router)


@app.get("/api/health")
async def health_check():
    from app.database import async_session
    from app.core.redis import get_redis
    from sqlalchemy import text

    result = {"status": "ok", "version": "1.0.0"}

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        result["database"] = "connected"
    except Exception:
        result["database"] = "unreachable"
        result["status"] = "degraded"

    r = get_redis()
    if r is not None:
        try:
            await r.ping()
            result["cache"] = "connected"
        except Exception:
            result["cache"] = "unreachable"
    else:
        result["cache"] = "disabled"

    if result["status"] == "degraded":
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=result)
    return result

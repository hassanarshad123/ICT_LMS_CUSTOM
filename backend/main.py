import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.utils.rate_limit import limiter

from app.config import get_settings
from app.routers import auth, users, batches, courses, curriculum, lectures, materials, jobs, announcements, zoom, admin, certificates, monitoring
from app.websockets.routes import router as ws_router
from app.middleware.error_tracking import ErrorTrackingMiddleware

settings = get_settings()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

# ── Sentry ──────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.starlette import StarletteIntegration
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        release="ict-lms@1.0.0",
        send_default_pii=True,
        traces_sample_rate=0.3,          # 30% of requests get performance tracing
        profiles_sample_rate=0.1,         # 10% of traced requests get profiled
        enable_db_query_source=True,      # show which code triggered DB queries
        include_local_variables=True,     # capture local vars in stack traces
        max_request_body_size="medium",   # capture request bodies up to 10KB
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
    )
    logging.getLogger("ict_lms").info("Sentry initialized (env=%s)", settings.APP_ENV)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — start scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from app.scheduler.jobs import cleanup_expired_sessions, send_zoom_reminders, retry_failed_recordings

        scheduler = AsyncIOScheduler()
        scheduler.add_job(cleanup_expired_sessions, "interval", hours=1, id="cleanup_sessions")
        scheduler.add_job(send_zoom_reminders, "interval", minutes=10, id="zoom_reminders")
        scheduler.add_job(retry_failed_recordings, "interval", minutes=30, id="retry_recordings")
        scheduler.start()
        app.state.scheduler = scheduler
    except Exception as e:
        logging.getLogger("ict_lms").warning("Scheduler not started: %s", e)

    yield

    # Shutdown
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown()


app = FastAPI(
    title="ICT Institute LMS API",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Error tracking + request logging (replaces old RequestLoggingMiddleware)
app.add_middleware(ErrorTrackingMiddleware)

# CORS
origins = [settings.FRONTEND_URL]
if settings.ALLOWED_ORIGINS:
    origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
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

# WebSocket routes
app.include_router(ws_router)


@app.get("/api/health")
async def health_check():
    from app.database import async_session
    from sqlalchemy import text

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "version": "1.0.0", "database": "connected"}
    except Exception:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "version": "1.0.0", "database": "unreachable"},
        )

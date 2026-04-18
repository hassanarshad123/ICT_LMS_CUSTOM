from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DATABASE_URL_DIRECT: str = ""

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS (comma-separated for multiple origins)
    FRONTEND_URL: str = "http://localhost:3000"
    FRONTEND_BASE_DOMAIN: str = ""  # e.g. "zensbot.online" for tenant-aware reset URLs
    ALLOWED_ORIGINS: str = ""  # e.g. "https://zensbot.online,http://localhost:3000"

    # Public-facing API base URL (used when we need to tell external systems
    # how to reach us — e.g. the Frappe webhook URL baked into the Frappe
    # Webhook record). In dev leave blank and we'll fall back to the Frappe
    # wizard copy-paste path.
    PUBLIC_API_BASE_URL: str = ""

    # Subdomain warmup — pre-warms Vercel wildcard SSL cert for new tenant subdomains
    SUBDOMAIN_WARMUP_ENABLED: bool = True
    SUBDOMAIN_WARMUP_MAX_ATTEMPTS: int = 5
    SUBDOMAIN_WARMUP_DELAY_SECONDS: float = 3.0

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET_NAME: str = "ict-lms-files"

    # Bunny.net (BUNNY_API_KEY = library API key from Stream library settings, NOT the account API key)
    BUNNY_API_KEY: str = ""
    BUNNY_LIBRARY_ID: str = ""
    BUNNY_CDN_HOSTNAME: str = ""
    BUNNY_TOKEN_KEY: str = ""
    BUNNY_WEBHOOK_SECRET: str = ""

    # Zoom
    ZOOM_CLIENT_ID: str = ""
    ZOOM_CLIENT_SECRET: str = ""
    ZOOM_ACCOUNT_ID: str = ""
    ZOOM_WEBHOOK_SECRET: str = ""
    ZOOM_CREDENTIAL_ENCRYPTION_KEY: str = ""

    # Resend
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@zensbot.com"

    # Monitoring
    SENTRY_DSN: str = ""
    DISCORD_WEBHOOK_URL: str = ""

    # Deploy / Blue-Green
    SCHEDULER_ENABLED: bool = True
    DEPLOY_SLOT: str = "standalone"  # blue, green, or standalone
    GIT_SHA: str = "unknown"

    # Redis Cache
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    CACHE_ENABLED: bool = True
    CACHE_DEFAULT_TTL: int = 300  # 5 minutes

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = False
    DEVICE_LIMIT: int = 2
    SUPER_ADMIN_EMAIL: str = ""

    # Signup / Trial
    TRIAL_DURATION_DAYS: int = 14
    TRIAL_COOLDOWN_DAYS: int = 90  # re-signup blocked this long after trial expiry
    # Trial tier defaults now sourced from PLAN_LIMITS[PlanTier.free] in
    # backend/app/utils/plan_limits.py. Override per-tier values there.
    SIGNUP_ENABLED: bool = True
    # Pricing v2 rollout: default tier assigned to new self-signups.
    # "professional" = new v2 flow (free forever, 10 students included, overage billed).
    # "free"         = legacy 14-day trial (kept for rollback safety).
    # Values must match a PlanTier enum in app.models.institute.
    SIGNUP_DEFAULT_TIER: str = "professional"

    # Pricing v2 billing engine (pricing-model-v2)
    # Monthly invoice cron + late-payment enforcement. True = log-only,
    # no DB writes, no emails sent. Safe default for first deploy — flip
    # to False after the first calendar-month cycle is manually verified.
    BILLING_CRON_DRY_RUN: bool = True

    # Cloudflare Turnstile (CAPTCHA)
    CF_TURNSTILE_SECRET_KEY: str = ""  # empty = skip verification (dev/test)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()

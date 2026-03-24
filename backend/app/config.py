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

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
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
    TRIAL_DURATION_DAYS: int = 30
    FREE_PLAN_MAX_USERS: int = 50
    FREE_PLAN_MAX_STORAGE_GB: float = 5.0
    FREE_PLAN_MAX_VIDEO_GB: float = 5.0
    SIGNUP_ENABLED: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()

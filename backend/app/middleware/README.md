# Middleware

Request/response processing that runs on every request.

- `auth.py` — JWT validation, role guards, user cache (Redis-backed, 5min TTL)
- `error_tracking.py` — X-Request-ID, error logging to DB, Sentry, Discord alerts
- `api_key_auth.py` — API key validation for programmatic access
- `logging.py` — Request/response logging

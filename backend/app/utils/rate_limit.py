from starlette.requests import Request
from slowapi import Limiter


def _get_real_ip(request: Request) -> str:
    """Extract the real client IP behind a reverse proxy.

    Checks X-Real-IP first (set by nginx), then X-Forwarded-For (first hop),
    then falls back to request.client.host.
    """
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For: client, proxy1, proxy2 — first is the real client
        return forwarded_for.split(",")[0].strip()

    return request.client.host if request.client else "127.0.0.1"


limiter = Limiter(key_func=_get_real_ip)

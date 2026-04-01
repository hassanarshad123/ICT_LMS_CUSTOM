from starlette.requests import Request
from slowapi import Limiter


def _get_real_ip(request: Request) -> str:
    """Extract the real client IP behind a reverse proxy.

    Checks X-Real-IP first (set by nginx), then X-Forwarded-For only when
    X-Real-IP is also present (prevents spoofing when not behind a trusted proxy).
    Falls back to request.client.host.
    """
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Only trust X-Forwarded-For if the connection comes from a local/private IP
        # (i.e., through nginx reverse proxy, not direct from the internet)
        client_ip = request.client.host if request.client else ""
        if client_ip.startswith(("127.", "10.", "172.", "192.168.", "::1")):
            return forwarded_for.split(",")[0].strip()

    return request.client.host if request.client else "127.0.0.1"


limiter = Limiter(key_func=_get_real_ip)

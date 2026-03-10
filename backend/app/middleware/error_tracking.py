import uuid
import time
import logging
import traceback as tb

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

logger = logging.getLogger("ict_lms")


def _sentry_set_context(request: Request, request_id: str, exc: Exception | None = None):
    """Push request context + user info into the current Sentry scope. Best-effort."""
    try:
        import sentry_sdk
    except ImportError:
        return

    # Tag the event with our request ID so it's searchable in Sentry
    sentry_sdk.set_tag("request_id", request_id)

    # Attach user context if auth middleware has set it
    user_id = getattr(request.state, "user_id", None)
    user_email = getattr(request.state, "user_email", None)
    if user_id or user_email:
        sentry_sdk.set_user({
            **({"id": str(user_id)} if user_id else {}),
            **({"email": user_email} if user_email else {}),
            "ip_address": request.client.host if request.client else None,
        })

    # If there's an exception, capture it explicitly so Sentry gets full context
    if exc is not None:
        sentry_sdk.capture_exception(exc)


async def _store_error(
    request: Request,
    request_id: str,
    status_code: int,
    exc: Exception | None = None,
):
    """Store error in database and send Discord alert. Best-effort, never raises."""
    try:
        from app.database import async_session
        from app.models.error_log import ErrorLog
        from app.utils.discord import send_discord_alert

        message = str(exc) if exc else f"HTTP {status_code}"
        traceback_str = "".join(tb.format_exception(type(exc), exc, exc.__traceback__)) if exc else None

        # Extract user info from request state (set by auth middleware if available)
        user_id = getattr(request.state, "user_id", None)
        user_email = getattr(request.state, "user_email", None)
        institute_id = getattr(request.state, "institute_id", None)

        # If institute_id not on request.state, try to resolve from the authenticated user
        if institute_id is None and user_id is not None:
            try:
                from sqlmodel import select as sql_select
                from app.models.user import User
                async with async_session() as lookup_session:
                    result = await lookup_session.execute(
                        sql_select(User).where(User.id == user_id)
                    )
                    user_obj = result.scalar_one_or_none()
                    if user_obj:
                        institute_id = user_obj.institute_id
            except Exception:
                pass  # best-effort

        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")[:500]

        error_log = ErrorLog(
            level="critical" if status_code >= 500 else "error",
            message=message[:2000],
            traceback=traceback_str,
            request_id=request_id,
            request_method=request.method,
            request_path=str(request.url.path)[:500],
            status_code=status_code,
            user_id=user_id,
            user_email=user_email,
            institute_id=institute_id,
            ip_address=ip,
            user_agent=user_agent[:500] if user_agent else None,
            source="backend",
        )

        async with async_session() as session:
            session.add(error_log)
            await session.commit()

        # Send Discord alert for 500+ errors
        if status_code >= 500:
            fields = [
                {"name": "Path", "value": f"`{request.method} {request.url.path}`", "inline": True},
                {"name": "Status", "value": str(status_code), "inline": True},
                {"name": "Request ID", "value": f"`{request_id}`", "inline": True},
            ]
            if user_email:
                fields.append({"name": "User", "value": user_email, "inline": True})
            if ip:
                fields.append({"name": "IP", "value": ip, "inline": True})

            desc = message[:500]
            if traceback_str:
                # Include last few lines of traceback
                tb_lines = traceback_str.strip().split("\n")
                desc = "```\n" + "\n".join(tb_lines[-5:]) + "\n```"

            await send_discord_alert(
                title="Server Error",
                description=desc,
                color=0xFF0000,
                fields=fields,
            )

    except Exception as e:
        logger.error("Failed to store error log: %s", e)


class ErrorTrackingMiddleware(BaseHTTPMiddleware):
    """Adds request ID to every request and catches unhandled exceptions."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = uuid.uuid4().hex[:12]
        request.state.request_id = request_id

        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as exc:
            # Unhandled exception — log it and return 500
            logger.error(
                "Unhandled exception [%s] %s %s: %s",
                request_id,
                request.method,
                request.url.path,
                exc,
            )
            _sentry_set_context(request, request_id, exc)
            await _store_error(request, request_id, 500, exc)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
                headers={"X-Request-ID": request_id},
            )

        duration = (time.perf_counter() - start) * 1000

        # Log every request
        logger.info(
            "[%s] %s %s %s %.1fms",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration,
        )

        # Store 5xx errors that were handled (e.g., HTTPException with 500)
        if response.status_code >= 500:
            _sentry_set_context(request, request_id)
            await _store_error(request, request_id, response.status_code)

        response.headers["X-Request-ID"] = request_id
        return response

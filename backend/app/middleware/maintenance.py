from __future__ import annotations

import logging

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.models.settings import SystemSetting

logger = logging.getLogger(__name__)

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SA_PREFIX = "/api/v1/super-admin"
MAINTENANCE_KEY = "maintenance_mode_global"


class MaintenanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method not in WRITE_METHODS:
            return await call_next(request)

        path = request.url.path
        if path.startswith(SA_PREFIX):
            return await call_next(request)

        if path.startswith("/api/v1/webhooks"):
            return await call_next(request)

        try:
            from app.core.cache import cache
            cached = await cache.get("maintenance:global")
            if cached is not None:
                is_maintenance = cached == "true"
            else:
                from app.database import async_session
                async with async_session() as session:
                    from sqlalchemy import select
                    result = await session.execute(
                        select(SystemSetting).where(SystemSetting.key == MAINTENANCE_KEY)
                    )
                    setting = result.scalar_one_or_none()
                    is_maintenance = setting.value == "true" if setting else False
                await cache.set("maintenance:global", "true" if is_maintenance else "false", ttl=10)

            if is_maintenance:
                return JSONResponse(
                    status_code=503,
                    content={"code": "maintenance_mode", "message": "Platform is in maintenance mode. Write operations are temporarily disabled."},
                )

            if hasattr(request.state, "institute_id") and request.state.institute_id:
                inst_key = f"maintenance:inst:{request.state.institute_id}"
                inst_cached = await cache.get(inst_key)
                if inst_cached == "true":
                    return JSONResponse(
                        status_code=503,
                        content={"code": "maintenance_mode", "message": "This institute is in maintenance mode."},
                    )
        except Exception:
            pass

        return await call_next(request)

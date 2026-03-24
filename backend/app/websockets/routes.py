"""WebSocket route handlers with institute ownership verification."""
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import select

from app.database import async_session
from app.models.batch import Batch
from app.models.user import User
from app.models.session import UserSession
from app.utils.security import decode_token
from app.websockets.manager import manager

router = APIRouter()


async def _get_user_from_token(websocket: WebSocket) -> User | None:
    """Extract user from WebSocket JWT query param. Returns None if invalid."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if not user:
            return None
        # Verify token_version — reject revoked tokens (Fix 1)
        token_tv = payload.get("tv")
        if token_tv is None or token_tv != user.token_version:
            return None
        return user


def _set_ws_sentry_context(user: User, channel: str):
    """Best-effort Sentry context for WebSocket connections."""
    try:
        import sentry_sdk
        sentry_sdk.set_user({"id": str(user.id), "email": user.email})
        sentry_sdk.set_tag("ws_channel", channel)
        sentry_sdk.set_tag("institute_id", str(user.institute_id) if user.institute_id else "none")
    except Exception:
        pass


@router.websocket("/ws/class-status/{batch_id}")
async def class_status_ws(websocket: WebSocket, batch_id: uuid.UUID):
    # Verify institute ownership before accepting connection
    user = await _get_user_from_token(websocket)
    if user is None:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    # Verify the batch belongs to the same institute as the user
    async with async_session() as session:
        result = await session.execute(
            select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None))
        )
        batch = result.scalar_one_or_none()
    if not batch or batch.institute_id != user.institute_id:
        await websocket.close(code=4003, reason="Batch does not belong to your institute")
        return

    channel = f"class-status:{batch_id}"
    connected = await manager.connect(websocket, channel)
    if not connected:
        return

    _set_ws_sentry_context(user, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as exc:
        manager.disconnect(websocket, channel)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass


@router.websocket("/ws/announcements/{user_id}")
async def announcements_ws(websocket: WebSocket, user_id: uuid.UUID):
    # Verify the connecting user matches the user_id parameter
    user = await _get_user_from_token(websocket)
    if user is None:
        await websocket.close(code=4001, reason="Authentication failed")
        return
    if user.id != user_id:
        await websocket.close(code=4003, reason="Cannot subscribe to another user's announcements")
        return

    channel = f"announcements:{user_id}"
    connected = await manager.connect(websocket, channel)
    if not connected:
        return

    _set_ws_sentry_context(user, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as exc:
        manager.disconnect(websocket, channel)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass


@router.websocket("/ws/notifications/{user_id}")
async def notifications_ws(websocket: WebSocket, user_id: uuid.UUID):
    """Real-time notification count updates. Replaces frontend polling."""
    user = await _get_user_from_token(websocket)
    if user is None:
        await websocket.close(code=4001, reason="Authentication failed")
        return
    if user.id != user_id:
        await websocket.close(code=4003, reason="Cannot subscribe to another user's notifications")
        return

    channel = f"notifications:{user_id}"
    connected = await manager.connect(websocket, channel)
    if not connected:
        return

    _set_ws_sentry_context(user, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as exc:
        manager.disconnect(websocket, channel)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass


@router.websocket("/ws/session/{session_id}")
async def session_ws(websocket: WebSocket, session_id: uuid.UUID):
    # Verify the session belongs to the same institute as the connecting user
    user = await _get_user_from_token(websocket)
    if user is None:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    async with async_session() as session:
        result = await session.execute(
            select(UserSession).where(UserSession.id == session_id)
        )
        user_session = result.scalar_one_or_none()
    if not user_session or (user.institute_id is not None and user_session.institute_id != user.institute_id):
        await websocket.close(code=4003, reason="Session does not belong to your institute")
        return

    channel = f"session:{session_id}"
    connected = await manager.connect(websocket, channel)
    if not connected:
        return

    _set_ws_sentry_context(user, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as exc:
        manager.disconnect(websocket, channel)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass

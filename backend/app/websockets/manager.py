"""WebSocket connection manager."""
import json
from collections import defaultdict

from fastapi import WebSocket, WebSocketDisconnect

from app.utils.security import decode_token


class ConnectionManager:
    MAX_CONNECTIONS_PER_USER = 5

    def __init__(self):
        # channel -> list of WebSocket connections
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)
        # user_id -> active connection count
        self._user_connections: dict[str, int] = defaultdict(int)

    async def connect(self, websocket: WebSocket, channel: str, user_id: str | None = None) -> bool:
        """Validate JWT from query params and accept connection."""
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4001, reason="Missing token")
            return False

        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid or expired token")
            return False

        # Resolve user_id from token if not provided
        ws_user_id = user_id or payload.get("sub")

        # Per-user connection limit
        if ws_user_id and self._user_connections[ws_user_id] >= self.MAX_CONNECTIONS_PER_USER:
            await websocket.close(code=1008, reason="Too many concurrent connections")
            return False

        await websocket.accept()
        self._connections[channel].append(websocket)

        # Track user connection count
        if ws_user_id:
            self._user_connections[ws_user_id] += 1
            websocket.state.tracked_user_id = ws_user_id

        return True

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self._connections:
            self._connections[channel] = [
                ws for ws in self._connections[channel] if ws != websocket
            ]

        # Decrement user connection counter
        tracked_uid = getattr(websocket.state, "tracked_user_id", None)
        if tracked_uid and self._user_connections.get(tracked_uid, 0) > 0:
            self._user_connections[tracked_uid] -= 1

    async def broadcast(self, channel: str, message: dict):
        """Send message to all connections on a channel."""
        dead = []
        for ws in self._connections.get(channel, []):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)

        # Clean up dead connections
        for ws in dead:
            self.disconnect(ws, channel)

    async def send_personal(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            pass


manager = ConnectionManager()

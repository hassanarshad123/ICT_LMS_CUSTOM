"""WebSocket connection manager."""
import json
from collections import defaultdict

from fastapi import WebSocket, WebSocketDisconnect

from app.utils.security import decode_token


class ConnectionManager:
    def __init__(self):
        # channel -> list of WebSocket connections
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, channel: str) -> bool:
        """Validate JWT from query params and accept connection."""
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4001, reason="Missing token")
            return False

        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid or expired token")
            return False

        await websocket.accept()
        self._connections[channel].append(websocket)
        return True

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self._connections:
            self._connections[channel] = [
                ws for ws in self._connections[channel] if ws != websocket
            ]

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

"""WebSocket route handlers."""
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websockets.manager import manager

router = APIRouter()


@router.websocket("/ws/class-status/{batch_id}")
async def class_status_ws(websocket: WebSocket, batch_id: uuid.UUID):
    channel = f"class-status:{batch_id}"
    connected = await manager.connect(websocket, channel)
    if not connected:
        return

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)


@router.websocket("/ws/announcements/{user_id}")
async def announcements_ws(websocket: WebSocket, user_id: uuid.UUID):
    channel = f"announcements:{user_id}"
    connected = await manager.connect(websocket, channel)
    if not connected:
        return

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)


@router.websocket("/ws/session/{session_id}")
async def session_ws(websocket: WebSocket, session_id: uuid.UUID):
    channel = f"session:{session_id}"
    connected = await manager.connect(websocket, channel)
    if not connected:
        return

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)

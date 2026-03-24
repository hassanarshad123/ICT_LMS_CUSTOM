# WebSockets

Real-time communication channels.

4 channels: class-status, announcements, notifications, session.
All authenticated via JWT query parameter.

- `manager.py` — ConnectionManager (connect, disconnect, broadcast)
- `routes.py` — WebSocket endpoint handlers with institute ownership checks
- `pubsub.py` — Redis Pub/Sub bridge for cross-container delivery (blue-green)

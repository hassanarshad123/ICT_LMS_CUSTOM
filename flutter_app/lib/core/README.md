# Core

Infrastructure and shared utilities for the Flutter app.

- `constants/` — API URLs, colors, spacing, animation durations, storage keys
- `network/` — Dio HTTP client with auth interceptor, case conversion, slug header.
  WebSocket service for real-time notifications.
- `storage/` — SecureStorage (tokens, PII) and SharedPreferences (non-sensitive)
- `theme/` — Dark theme with branding-driven accent colors, text styles
- `services/` — Crash reporting (expandable to Firebase Crashlytics)
- `utils/` — JWT decoder, date formatter, file utilities

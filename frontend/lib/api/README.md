# API Client

HTTP client modules. 1:1 mapping with backend routers.

- `client.ts` — Core apiClient with auto snake_case/camelCase conversion,
  JWT auth, token refresh, X-Institute-Slug header, timeout handling
- Each module (auth.ts, courses.ts, batches.ts, etc.) exports typed functions
  that call the corresponding backend endpoints

All responses are auto-converted from snake_case to camelCase.
Query params stay in snake_case. Use `skipConversion: true` for raw keys.

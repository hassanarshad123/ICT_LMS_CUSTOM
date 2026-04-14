# Public REST API Reference

Programmatic access to LMS data. Everything an external system needs for
read/write integration.

Base URL: `https://apiict.zensbot.site/api/v1/public`

## Authentication

All requests require an **API key** issued per-institute:

```
X-API-Key: zbk_live_abc123...
```

Generate keys in the LMS admin UI under **Settings → API Keys**. Each key
has:
- **Scopes:** `read` (default) and/or `write`. Write endpoints require
  `write` scope.
- **Expiry:** optional TTL.
- **Revocation:** instant, from the same screen.

Keys are hashed at rest — if lost, revoke and create a new one.

## Rate limits

**1000 requests / minute / API key**, regardless of endpoint. 429 responses
include `Retry-After` in seconds.

## Response envelope

Lists return:
```json
{
  "data": [...],
  "total": 250,
  "page": 1,
  "per_page": 20,
  "total_pages": 13
}
```

Single resources return the object directly.

Errors return:
```json
{"detail": "Student not found"}
```

## Endpoints

### Students
- `GET /students` — list. Filters: `search`, `status`, `page`, `per_page` (max 100)
- `GET /students/{id}` — detail
- `POST /students` — create (write scope) — `{email, name, phone}`
- `PATCH /students/{id}` — update (write scope)

### Batches
- `GET /batches` — list active batches
- `GET /batches/{id}` — detail

### Courses
- `GET /courses` — list
- `GET /courses/{id}` — detail with modules

### Enrollments
- `POST /enrollments` — enroll a student in a batch (write) — `{student_id, batch_id}`
- `DELETE /enrollments` — remove (write) — `{student_id, batch_id}`

### Certificates
- `GET /certificates` — list issued certificates
- `GET /certificates/{id}` — detail with PDF URL

### Classes & attendance
- `GET /classes` — list Zoom classes
- `GET /attendance?batch_id=...` — attendance records

### Announcements
- `GET /announcements` — list
- `POST /announcements` — create (write) — `{title, body, audience}`

### Jobs
- `GET /jobs` — list job postings

### Fees (read-only in v1)
- `GET /students/{id}/fees` — fee plans + installments + payments for a student

## Delta sync

> **v1.1 (coming soon):** `?updated_since=<ISO8601>` will be supported on all
> list endpoints to return only records changed since a timestamp. Until
> then, use webhooks for real-time sync and periodic full pulls for
> reconciliation.

## SDK availability

No official SDK today. The API is designed to work cleanly with any HTTP
client — Python `httpx`, Node `fetch`, Go `net/http`, PHP `Guzzle`, etc.

## Versioning

We version the URL prefix (`/api/v1/public`). Breaking changes ship under
`/api/v2/*` with a minimum 6-month deprecation window on v1.

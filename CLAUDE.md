# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack white-label LMS (Learning Management System) with a FastAPI backend and Next.js frontend. Four user roles: admin, course_creator, teacher, student. Admins can customize branding (colors, logo, theme) and certificate design through the UI.

## Commands

### Backend (from `backend/`)
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Python 3.11 is used in CI and production.

### Frontend (from `frontend/`)
```bash
npm install
npm run dev          # dev server at localhost:3000
npm run build        # production build (also runs type checks)
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
```

### Tests
```bash
# Integration tests (backend must be running)
cd backend
TEST_BASE_URL=http://localhost:8000 TEST_ADMIN_EMAIL=admin@test.com TEST_ADMIN_PASSWORD=changeme python tests/integration_test.py
```

### Database Migrations
```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Backend Syntax Check (no venv required)
```bash
cd backend
python -m py_compile app/routers/some_file.py
python -m compileall -q app/
```

## Architecture

### Backend (`backend/`)

**Stack:** FastAPI + SQLModel + PostgreSQL (AWS RDS, asyncpg) + SQLAlchemy 2.0 async

**Request flow:** Router → Service → Database (AsyncSession)

- `main.py` — App factory, registers 14 routers under `/api/v1/`, CORS, rate limiter, Sentry, APScheduler
- `app/routers/` — 14 routers: auth, users, batches, courses, curriculum, lectures, materials, jobs, announcements, zoom, admin, certificates, monitoring, branding
- `app/services/` — Business logic layer; each service takes `AsyncSession` and returns domain objects
- `app/models/` — SQLModel tables (~23 tables across 9 files); all use UUID PKs and soft-delete via `deleted_at`
- `app/schemas/` — Pydantic request/response DTOs; `PaginatedResponse[T]` in `common.py`
- `app/middleware/auth.py` — `get_current_user()` (JWT validation), `require_roles()` (role guard)
- `app/middleware/error_tracking.py` — `ErrorTrackingMiddleware`: adds `X-Request-ID`, logs to DB (`ErrorLog` table), Sentry integration, Discord alerts on 5xx
- `app/utils/` — security (JWT/bcrypt), rate_limit, bunny (video CDN), s3, zoom_api, encryption, email, transformers, formatters, certificate_pdf
- `app/websockets/routes.py` — 3 WebSocket channels: `/ws/class-status/{batch_id}`, `/ws/announcements/{user_id}`, `/ws/session/{session_id}`
- `app/scheduler/jobs.py` — 3 background jobs: cleanup_expired_sessions (hourly), send_zoom_reminders (10min), retry_failed_recordings (30min)
- `app/config.py` — Pydantic Settings with `@lru_cache`, reads `.env`

**Key patterns:**
- Role-based access: `CC = Annotated[User, Depends(require_roles("course_creator"))]`
- Enum convention: API uses kebab-case (`course-creator`), DB uses snake_case (`course_creator`); `utils/transformers.py` converts
- All list endpoints return `PaginatedResponse` with server-side pagination (max 100/page)
- Rate limiting via slowapi on auth endpoints (5/min login, 10/min refresh)
- Sentry optional: initializes only when `SENTRY_DSN` is set in `.env`

### Frontend (`frontend/`)

**Stack:** Next.js 13 App Router + TypeScript + Tailwind CSS + Radix/Shadcn UI + Sonner (toasts)

- `next.config.js` — Rewrites `/api/v1/*` → backend and `/ws/*` → WebSocket (uses `API_URL`/`WS_URL` env vars, defaults to `localhost:8000`)
- `lib/api/client.ts` — `apiClient<T>()` with auto snake_case↔camelCase conversion, 401 refresh with deduplication, 30s timeout, redirects to `/` on auth failure
- `lib/api/*.ts` — 14 API modules matching backend routers; all interfaces use camelCase
- `lib/auth-context.tsx` — `AuthProvider` + `useAuth()` hook; stores JWT in localStorage; `logout()` clears tokens and redirects
- `lib/branding-context.tsx` — `BrandingProvider` + `useBranding()` hook; fetches branding settings on mount, applies colors as CSS custom properties (HSL), updates page title and favicon dynamically; graceful fallback to defaults on error
- `hooks/use-api.ts` — `useApi(fetcher, deps)` for GET, `useMutation(fn)` for POST/PATCH/DELETE
- `hooks/use-paginated-api.ts` — `usePaginatedApi()` with page state management
- `components/shared/page-states.tsx` — `PageLoading`, `PageError`, `EmptyState`
- `components/shared/video-player.tsx` — Bunny Stream iframe + YouTube/Vimeo embed player with anti-piracy watermark overlay (student email)
- `components/layout/sidebar.tsx` — Shared sidebar; logout calls `onLogout` prop (wired to `useAuth().logout` via `dashboard-layout.tsx`)
- `app/[userId]/` — ~20 page directories: batches, branding, certificates, classes, courses, insights, jobs, monitoring, schedule, settings, students, teachers, users, etc.

**Key patterns:**
- All pages are `'use client'` components using `useApi`/`useMutation` hooks
- All destructive actions use `AlertDialog` confirmation
- All mutations show toast feedback via Sonner
- API client handles case conversion automatically; use `skipConversion: true` for raw keys (e.g., admin settings)
- `useAuth()` returns flat user properties: `id`, `name`, `email`, `role`, `batchIds`, etc.
- `useBranding()` returns colors, institute name, tagline, logo URL, etc.

### Case Conversion Boundary

Backend sends/receives snake_case. Frontend works in camelCase. The `apiClient` in `lib/api/client.ts` auto-converts in both directions using `lib/utils/case-convert.ts`. Query params stay snake_case. Schema fields in `lib/api/*.ts` must be camelCase.

**Exception:** Public endpoints that use raw `fetch` instead of `apiClient` (e.g., `getBranding()`, `getCertificateDesign()`) must manually convert snake_case response keys to camelCase.

### Branding & Certificate Design System

Admin-configurable white-label branding stored in `SystemSetting` table (not a dedicated model):
- **Site branding** (`branding_*` keys): colors, logo, favicon, institute name, tagline, preset themes. Applied at runtime via `BrandingProvider` → CSS custom properties.
- **Certificate design** (`cert_*` keys): independent colors, institute name, title, body text, signatures, border style, ID prefix. Loaded by `certificate_service.py` at PDF generation time via `_load_cert_design()`.

Certificate PDFs are generated by `app/utils/certificate_pdf.py` using ReportLab. The `CertDesign` dataclass holds all customizable fields with defaults matching the original hardcoded values — so existing behavior is preserved when no settings are configured.

### Video Infrastructure (Bunny.net)

Upload: Course creator → `POST /lectures/upload-init` → backend creates Bunny entry → frontend uploads directly to Bunny via TUS protocol (`tus-js-client`, 50MB chunks, 5 parallel uploads) → Bunny encodes → webhook sets `video_status=ready`.

**TUS config caveat:** `parallelUploads` and `uploadSize` cannot be used together in tus-js-client. The file object provides its own size.

Playback: Student → `POST /lectures/{id}/signed-url` (checks enrollment via `StudentBatch`) → returns signed Bunny Stream embed URL → frontend renders in `<VideoPlayer>` iframe with student email watermark overlay.

`Lecture.video_status`: pending → processing → ready/failed. External URL lectures skip this flow.

**Bunny API key:** Must use the **library API key** (from Stream library settings), NOT the account API key. Library ID: 613513.

### Environment Variables

- Local `.env` files: `backend/.env` and `frontend/.env`
- Backup/reference copies: `envs/backend.env` and `envs/frontend.env` (gitignored)
- Production `.env`: `/home/ubuntu/ICT_LMS_CUSTOM/backend/.env` on EC2
- GitHub secrets inject Bunny credentials into `.env` on each deploy

**Note:** `*.md` is in `.gitignore` — new markdown files won't be tracked unless force-added. CLAUDE.md is tracked because it was committed before the rule.

### Production Infrastructure

**EC2 Instance (ap-south-1):**
- Instance: `i-0b5bcfa8445700e21` (t3.small, Ubuntu 24.04)
- Elastic IP: `13.204.107.220`
- SSH: `ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220`
- Key file: `LMS_CUSTOM.pem` (in project root, gitignored)

**Server layout:**
- Code: `/home/ubuntu/ICT_LMS_CUSTOM/`
- Backend venv: `/home/ubuntu/ICT_LMS_CUSTOM/backend/venv/`
- Env file: `/home/ubuntu/ICT_LMS_CUSTOM/backend/.env`
- Systemd service: `ict-lms-api` (uvicorn, 2 workers, port 8000)
- Nginx reverse proxy → `127.0.0.1:8000`

**Useful server commands:**
```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220
sudo systemctl status ict-lms-api
sudo systemctl restart ict-lms-api
sudo journalctl -u ict-lms-api -n 50 --no-pager
sudo journalctl -u ict-lms-api -f  # follow live
```

**URLs:**
- API: `https://apiict.zensbot.site` → nginx → uvicorn :8000
- Frontend: `https://zensbot.online` (Vercel)
- Health: `https://apiict.zensbot.site/api/health`

**CI/CD:** GitHub Actions (`.github/workflows/deploy-backend.yml`) — push to `main` with `backend/**` changes triggers compile check + import validation + SSH deploy to EC2. Bunny.net credentials are injected from GitHub secrets into `.env` on each deploy.

**Database:** AWS RDS PostgreSQL (`ict-lms-db`, db.t4g.micro, 20GB) in `ap-south-1` (Mumbai) — same region as EC2 for low latency.

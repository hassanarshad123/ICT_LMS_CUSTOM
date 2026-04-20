# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Planning Style

**Always plan in phases.** Every plan produced for this repo must be structured as discrete sequential phases, each with an explicit **deliverable** and **checkpoint**. Do not start Phase N until Phase N-1 is verified. This applies to both in-session plans and plan-mode plan files.

## Project Overview

Full-stack white-label LMS: FastAPI backend, Next.js 13 frontend, Flutter mobile app. Five roles: super_admin, admin, course_creator, teacher, student. Multi-tenant via subdomain isolation. Admins have full course-creator powers plus branding, monitoring, and institute management.

## Commands

### Backend (from `backend/`)
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Python 3.11 in CI and production.

### Frontend (from `frontend/`)
```bash
npm install
npm run dev          # dev server at localhost:3000
npm run build        # production build (also runs type checks)
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
```

### Tests (backend must be running)
```bash
cd backend
TEST_BASE_URL=http://localhost:8000 TEST_ADMIN_EMAIL=admin@test.com TEST_ADMIN_PASSWORD=changeme python tests/integration_test.py
```

### Database Migrations (from `backend/`)
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Backend Syntax Check (no venv required)
```bash
cd backend
python -m py_compile app/routers/some_file.py
python -m compileall -q app/
```

## Key Patterns

- **Request flow:** Router -> Service -> Database (AsyncSession)
- **Role guard:** `CC = Annotated[User, Depends(require_roles("admin", "course_creator"))]` (admin has full CC powers)
- **Enums:** API = kebab-case (`course-creator`), DB = snake_case (`course_creator`); `utils/transformers.py` converts
- **Pagination:** All list endpoints return `PaginatedResponse` with server-side pagination (max 100/page)
- **Case conversion:** Backend snake_case <-> Frontend camelCase, auto-converted by `apiClient` in `lib/api/client.ts`. Query params stay snake_case. Schema fields in `lib/api/*.ts` must be camelCase.
  - **Exception:** Public endpoints using raw `fetch` (e.g., `getBranding()`, `getCertificateDesign()`) must manually convert snake_case -> camelCase.
  - Use `skipConversion: true` for raw keys (e.g., admin settings).
- **Frontend patterns:** All pages are `'use client'`; destructive actions use `AlertDialog`; mutations show Sonner toasts; `useApi(fetcher, deps)` for GET, `useMutation(fn)` for POST/PATCH/DELETE.
- **Rate limiting:** slowapi on sensitive endpoints (15/min login, 10/min refresh). Redis-backed in production.
- **Sentry:** Optional, initializes only when `SENTRY_DSN` is set in `.env`.
- **Env files:** `backend/.env` and `frontend/.env` (local); `envs/` (backup, gitignored). `*.md` is in `.gitignore` -- force-add new markdown files.

## Detailed References

Read these docs ON-DEMAND when the task involves the topic.

### Architecture & Code Structure
| Topic | Doc | What's Inside |
|-------|-----|---------------|
| Backend deep-dive | `docs/BackendStructure.md` | Folder layout, 14 routers, services, models, middleware, DI, error handling, conventions |
| Frontend deep-dive | `docs/Features.md` | Feature-by-feature breakdown: auth, users, batches, courses, lectures, Zoom, certs, monitoring |
| Database schema | `docs/DatabaseSchema.md` | All 23+ tables, fields, relationships, indexes, constraints, soft-delete patterns |
| Project structure | `docs/STRUCTURE.md` | Folder layout quick reference |
| Full project reference | `docs/WHATISTHISPROJECT.md` | Comprehensive 1600-line reference covering everything |
| Tech stack details | `docs/stack-tech.md` | Technology stack deep-dive with rationale |

### Feature-Specific
| Topic | Doc | What's Inside |
|-------|-----|---------------|
| API endpoints | `docs/API.md` | Complete REST API reference -- all routers, request/response schemas, auth, pagination |
| Branding & certificates | `docs/claude/branding-certificates.md` | SystemSetting key conventions, BrandingProvider, CertDesign dataclass, PDF generation |
| Admissions officer portal | `docs/claude/admissions-officer.md` | New role + fee lifecycle — onboarding, installments, payments, receipts, soft-lock enforcement, reminders, admin stats |
| SuperAdmin playbook | `docs/claude/sa-playbook.md` | 8-tier registry, unlimited-tier contract, impersonation security, heartbeat invariants, DRY_RUN flip checklist — read BEFORE touching SA code |
| Video pipeline (Bunny) | `docs/claude/video-infrastructure.md` | TUS upload flow, critical caveats (parallelUploads conflict, library API key), playback, status lifecycle |
| Security & auth | `docs/Security.md` | JWT flow, RBAC, password hashing, rate limiting, encryption, CORS, activity logging |
| Auth flow audit | `docs/backend-auth-flow-audit-2026-03-14.md` | Detailed JWT auth flow analysis |

### Production & Deployment
| Topic | Doc | What's Inside |
|-------|-----|---------------|
| Production quick ref | `docs/claude/production-quick-ref.md` | EC2 SSH, Docker blue-green commands, URLs, CI/CD summary, RDS, env vars |
| Full deployment guide | `docs/Deployment.md` | Step-by-step: RDS, EC2, S3, Bunny, Docker, Vercel, DNS, SSL setup |
| Blue-green architecture | `docs/blue-green.md` | 10-step deploy flow, health checks, rollback, scheduler dedup, Redis, monitoring |

### Flutter App
| Topic | Doc | What's Inside |
|-------|-----|---------------|
| Flutter patterns & skills | `docs/claude/flutter-patterns.md` | Required skills (super-flutter), Riverpod+GoRouter+Dio, animation tokens, production checklist |
| Flutter full guide | `flutter_app/flutter.md` | Feature implementation guide with backend file map |

### Testing & Audits
| Topic | Doc | What's Inside |
|-------|-----|---------------|
| Testing guide | `docs/LMS-TESTING-PROMPT.md` | Automated testing prompt for unit, integration, E2E |
| Security audit | `docs/SECURITY_AUDIT_REPORT.md` | Detailed security audit findings and recommendations |

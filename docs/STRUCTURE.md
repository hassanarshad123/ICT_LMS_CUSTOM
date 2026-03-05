# Project Structure Guide

Quick reference for developers picking up this codebase.

---

## Top-Level Layout (Monorepo)

```
ICT_LMS_CUSTOM/
├── frontend/     Next.js 13 web app (TypeScript + Tailwind)
├── backend/      FastAPI Python API (SQLModel + Neon PostgreSQL)
├── docs/         All project documentation
├── .gitignore    Shared gitignore for both projects
└── .gitattributes
```

---

## `frontend/` — Next.js App

```
frontend/
├── app/              Next.js 13 App Router pages (all routes)
├── components/       Reusable UI components
├── lib/              Types, mock data, constants, auth context, utilities
├── hooks/            Custom React hooks
├── package.json      Node dependencies
├── tsconfig.json     TypeScript config (@/* path alias)
├── tailwind.config.ts
├── next.config.js
└── postcss.config.js
```

### `frontend/app/` — Pages by Role

---

### Pages by Role

Every page is a `'use client'` component. No server components or data fetching — all data comes from mock arrays in `lib/mock/`.

| Route | Page |
|-------|------|
| `/` | Login / role selector |
| `/admin` | Admin dashboard |
| `/admin/users` | Unified user list (shared component) |
| `/admin/users/[userId]` | User detail (shared component) |
| `/admin/batches` | Batch management |
| `/admin/students` | Student list |
| `/admin/teachers` | Teacher list |
| `/admin/course-creators` | Course creator list |
| `/admin/devices` | Device session management |
| `/admin/insights` | Analytics charts (Recharts) |
| `/admin/settings` | Account + session settings (shared component + extra card) |
| `/course-creator` | Course creator dashboard |
| `/course-creator/users` | Unified user list (shared component) |
| `/course-creator/users/[userId]` | User detail (shared component) |
| `/course-creator/courses` | Course list |
| `/course-creator/courses/[courseId]` | Course detail (batches + curriculum) |
| `/course-creator/batches` | Batch list |
| `/course-creator/batches/[batchId]` | Batch content (lectures + materials + recordings) |
| `/course-creator/jobs` | Job postings |
| `/course-creator/settings` | Account settings (shared component) |
| `/teacher` | Teacher dashboard |
| `/teacher/courses` | Teacher's courses |
| `/teacher/courses/[courseId]` | Course detail (curriculum + materials) |
| `/teacher/batches` | Teacher's batches |
| `/teacher/schedule` | Zoom class scheduling |
| `/teacher/settings` | Account settings (shared component + specialization field) |
| `/student` | Student dashboard |
| `/student/courses` | Student's courses |
| `/student/courses/[courseId]` | Course detail (video player + playlist + materials) |
| `/student/zoom` | Zoom classes |
| `/student/jobs` | Job listings |
| `/student/settings` | Account settings (shared component + batch field) |

---

### `frontend/components/`

```
frontend/components/
  layout/
    dashboard-layout.tsx    Wraps every page: sidebar + main area + AuthProvider
    dashboard-header.tsx    Page title + subtitle bar
    sidebar.tsx             Role-based navigation sidebar
  shared/
    users-list-view.tsx     Shared user list (admin + course-creator)
    user-detail-view.tsx    Shared user detail (admin + course-creator)
    settings-view.tsx       Shared settings (all 4 roles)
  ui/
    ...                     47 shadcn/ui primitives (button, dialog, etc.)
```

---

### `frontend/lib/`

```
frontend/lib/
  types/                    TypeScript interfaces, split by domain
    user.ts                 UserRole, User, Student, Teacher, CourseCreator, UnifiedUser
    batch.ts                Batch
    course.ts               Course, Lecture, CurriculumModule, MaterialFileType, CourseMaterial
    job.ts                  Job, JobApplication
    zoom.ts                 ZoomClass
    device.ts               DeviceSession, UserDeviceSummary
    nav.ts                  NavItem
    index.ts                Barrel re-export (import from '@/lib/types')

  mock/                     Mock data arrays, split by domain
    batches.ts              batches[]
    students.ts             students[]
    teachers.ts             teachers[]
    course-creators.ts      courseCreators[]
    courses.ts              courses[]
    lectures.ts             lectures[]
    curriculum.ts           curriculum[]
    materials.ts            batchMaterials[]
    zoom-classes.ts         zoomClasses[]
    jobs.ts                 jobs[], jobApplications[]
    devices.ts              deviceSessions[]
    insights.ts             monthlyInsightsData[]
    users.ts                getAllUsers(), getUserDeviceSummaries()
    index.ts                Barrel re-export

  mock-data.ts              Thin barrel re-export (legacy import path '@/lib/mock-data')
  auth-context.tsx          Mock auth context (AuthProvider + useAuth hook)
  constants.ts              Shared UI constants (status colors, role badges, file type config)
  utils.ts                  Tailwind cn() utility
```

---

## `backend/` — FastAPI API

```
backend/
├── main.py               FastAPI app entry point (CORS, routers, health check)
├── requirements.txt      Python dependencies (pinned)
├── .env / .env.example   Environment variables (Neon, JWT, AWS, etc.)
├── app/
│   ├── config.py         Pydantic Settings (reads .env)
│   ├── database.py       Async SQLAlchemy engine + session factory
│   ├── models/           SQLModel table models (20 tables + 12 enums)
│   ├── schemas/          Pydantic request/response schemas
│   ├── routers/          FastAPI route handlers (auth, users, ...)
│   ├── services/         Business logic layer
│   ├── middleware/       Auth middleware (JWT + RBAC)
│   ├── utils/            Security helpers (bcrypt, JWT)
│   ├── websockets/       WebSocket handlers (Phase 1D)
│   └── scheduler/        APScheduler cron jobs (Phase 1C)
├── alembic/              Database migration files
└── tests/                Unit + integration tests
```

See `docs/BackendStructure.md` for full details on patterns and conventions.

---

## `docs/`

| File | Contents |
|------|----------|
| `STRUCTURE.md` | This file |
| `DatabaseSchema.md` | Complete Neon PostgreSQL schema (20 tables, indexes, triggers, SQL) |
| `Features.md` | Full feature requirements in plain English |
| `stack-tech.md` | Complete tech stack: FastAPI + Neon + AWS architecture, costs, env vars |
| `API.md` | All 80+ API endpoints across 12 routers with request/response schemas |
| `Security.md` | JWT auth, RBAC, video signing, device limits, encryption |
| `Deployment.md` | Step-by-step deployment: Neon, EC2, S3, Bunny.net, Vercel, CI/CD |
| `BackendStructure.md` | FastAPI `/backend` folder layout, patterns, dependency injection |

---

## Key Patterns

1. **All pages use mock data** — No API calls. Replace `lib/mock/` imports with FastAPI endpoint calls.
2. **Auth is mocked** — `useAuth()` returns a hardcoded user per role. Replace with real JWT auth via FastAPI `/api/auth/login`.
3. **Barrel re-exports** — `@/lib/types` and `@/lib/mock-data` resolve through `index.ts` files.
4. **Shared components** — Users list, user detail, and settings are extracted into `components/shared/` with role/config props.
5. **Design system** — `#1A1A1A` (dark), `#C5D86D` (accent green), `#F0F0F0` (bg), white cards with `rounded-2xl` and `card-shadow`.
6. **No global state** — Each page manages its own state with `useState`.

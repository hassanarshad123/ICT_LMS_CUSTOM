# ICT Institute LMS — Tech Stack

> **Single source of truth** for every technology in the stack, why it was chosen, how it connects, and what it costs.
> This replaces the previous `TechStack.md` (which referenced Supabase, then Neon). The database has been migrated from Neon (serverless) to **AWS RDS PostgreSQL** in ap-south-1. The backend is now **FastAPI + AWS RDS + AWS**.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Services](#2-services)
3. [How Everything Connects](#3-how-everything-connects)
4. [Cost Breakdown](#4-cost-breakdown)
5. [Environment Variables](#5-environment-variables)
6. [Python Dependencies](#6-python-dependencies)
7. [Development Workflow](#7-development-workflow)
8. [Scaling Path](#8-scaling-path)

---

## 1. Architecture Overview

```
                         ┌──────────────────────┐
                         │    Browser / Flutter   │
                         │    (Students, Teachers, │
                         │     Admin, CC)          │
                         └───────────┬────────────┘
                                     │
                          HTTPS (JSON + WebSocket)
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                                       │
                 ▼                                       ▼
    ┌────────────────────┐              ┌────────────────────────┐
    │   Vercel (Free)    │              │   AWS EC2 (t3.small)   │
    │                    │              │                        │
    │   Next.js 13       │   API calls  │   Nginx (reverse proxy)│
    │   Frontend         │ ──────────── │      ↓                 │
    │   (App Router)     │              │   Uvicorn              │
    │                    │              │      ↓                 │
    └────────────────────┘              │   FastAPI Application  │
                                        │      │                 │
                                        └──────┼─────────────────┘
                                               │
                       ┌───────────┬───────────┼───────────┬───────────┐
                       │           │           │           │           │
                       ▼           ▼           ▼           ▼           ▼
              ┌─────────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
              │  AWS RDS    │ │ AWS S3 │ │Bunny.net│ │  Zoom  │ │ Resend │
              │  PostgreSQL │ │        │ │ Stream  │ │  API   │ │ Email  │
              │ (db.t4g.micro)│ │ Files │ │ Videos  │ │  OAuth │ │        │
              └─────────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

**Data Flow — Zoom Webhook (separate path):**
```
Zoom Cloud ──webhook──▶ EC2 public endpoint ──▶ FastAPI handler ──▶ RDS PostgreSQL
```

---

## 2. Services

### 2.1 Next.js 13 (Web Frontend)

| Detail | Value |
|--------|-------|
| Version | Next.js 13.5 with App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui (47 Radix primitives) |
| Charts | Recharts |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Deployed on | Vercel (free tier) |

**What it does:** Renders all 32 pages of the LMS. Handles client-side routing. Every page is `'use client'` — no server components.

**How it connects:** Calls FastAPI via `fetch()` with `Authorization: Bearer <token>` header. Stores JWT access token in `localStorage`. The `NEXT_PUBLIC_API_URL` env var points to the EC2 backend.

**Why Next.js:** Already built. 32 pages exist with complete UI. The frontend is done — only the mock data layer needs to be replaced with real API calls.

---

### 2.2 FastAPI (Backend API)

| Detail | Value |
|--------|-------|
| Version | FastAPI 0.115+ |
| Language | Python 3.11+ |
| ASGI Server | Uvicorn (2 workers) |
| Reverse Proxy | Nginx |
| Process Manager | systemd |

**What it does:** Handles ALL backend logic — authentication, CRUD operations, file upload orchestration, Zoom API calls, video URL signing, WebSocket connections, and scheduled tasks. Generates automatic OpenAPI docs at `/docs`.

**Why FastAPI:**
- Async-native — handles WebSockets and concurrent DB queries efficiently
- Pydantic validation built-in — request/response schemas are type-safe
- SQLModel integration — same author, seamless ORM + API schema sharing
- Python ecosystem — CSV parsing (pandas), PDF generation (reportlab), cryptography libraries are mature
- Auto-generated OpenAPI/Swagger docs at `/docs` — free API documentation

**How it connects:**
- Receives HTTPS requests from frontend via Nginx
- Queries AWS RDS PostgreSQL via SQLModel/asyncpg
- Calls Bunny.net API for video uploads and signed URLs
- Calls Zoom API for meeting creation and attendance retrieval
- Calls AWS S3 for file upload/download pre-signed URLs
- Calls Resend API for email reminders
- Runs APScheduler for cron jobs (Zoom reminders, session cleanup)

---

### 2.3 SQLModel (ORM)

| Detail | Value |
|--------|-------|
| Version | SQLModel 0.0.21+ |
| Built on | SQLAlchemy 2.0 + Pydantic v2 |
| Migrations | Alembic 1.13+ |
| DB Driver | asyncpg (async PostgreSQL driver) |

**What it does:** Defines all 20 database tables as Python classes. Each class is both a database model AND a Pydantic schema — one definition, two uses. Alembic handles schema migrations (create tables, add columns, etc.).

**Why SQLModel over raw SQLAlchemy:**
- Same author as FastAPI (Sebastian Ramirez) — designed to work together
- Eliminates duplicate class definitions (SQLAlchemy model + Pydantic schema = 40+ classes → SQLModel = 20 classes)
- Built on SQLAlchemy underneath, so all SQLAlchemy patterns work (joins, subqueries, Alembic)
- Pydantic v2 integration means automatic JSON serialization/validation

**How it connects:** Reads/writes to AWS RDS PostgreSQL via the `asyncpg` driver. Alembic generates migration SQL and applies it to RDS.

---

### 2.4 AWS RDS (Database)

| Detail | Value |
|--------|-------|
| Engine | PostgreSQL 15+ (managed) |
| Instance ID | `ict-lms-db` |
| Instance class | db.t4g.micro (2 vCPU, 1 GB RAM, ARM/Graviton2) |
| Storage | 20 GB gp3 |
| Region | ap-south-1 (Mumbai) |
| Endpoint | `ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com` |
| Port | 5432 |
| Connection | asyncpg (direct) |
| CLI | AWS CLI (`aws rds`) |
| Estimated cost | ~$12/month |

**What it does:** Stores ALL LMS data — 20 tables, 12 enums, 2 views, 50+ indexes. Managed RDS handles automated backups (7-day retention), patching, and failover. The instance runs in the same region as the EC2 backend (ap-south-1), eliminating the cross-region latency that existed with the previous Neon setup (which was in ap-southeast-1).

**Why RDS over Neon (previous):**
- Same-region as EC2 — sub-millisecond network latency vs 30-50ms cross-region to Neon in Singapore
- Predictable performance — dedicated compute, no cold starts from scale-to-zero
- Automated backups, point-in-time recovery, and optional Multi-AZ failover
- Standard AWS ecosystem — IAM, CloudWatch metrics, Security Groups
- No vendor-specific connection pooler quirks

**Connection URL:**
```
# Single connection URL for both FastAPI and Alembic:
DATABASE_URL=postgresql+asyncpg://user:pass@ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com:5432/dbname?ssl=require
```
Since RDS uses a standard PostgreSQL connection (no PgBouncer transaction-mode restrictions), a single connection URL works for both application traffic and Alembic migrations.

---

### 2.5 AWS EC2 (Backend Hosting)

| Detail | Value |
|--------|-------|
| Instance | t3.small (2 vCPU, 2 GB RAM) |
| OS | Ubuntu 22.04 LTS |
| Region | ap-south-1 (Mumbai — closest to Pakistan) |
| Estimated cost | ~$15/month on-demand, ~$10 with 1yr reserved |

**What it does:** Runs the FastAPI application. Nginx terminates SSL (Let's Encrypt), proxies to Uvicorn on port 8000. systemd ensures the process survives reboots.

**Why EC2 over serverless (Lambda/Vercel Functions):**
- WebSockets require persistent connections — Lambda has a 15-minute timeout
- APScheduler cron jobs need a long-running process
- EC2 gives predictable pricing ($15/mo fixed vs per-invocation costs)
- Full control — install any Python package, debug via SSH

**Security group:**
| Port | Source | Purpose |
|------|--------|---------|
| 22 | Your IP only | SSH access |
| 80 | 0.0.0.0/0 | HTTP → HTTPS redirect |
| 443 | 0.0.0.0/0 | HTTPS (API + WebSocket) |

---

### 2.6 AWS S3 (File Storage)

| Detail | Value |
|--------|-------|
| Region | ap-south-1 (Mumbai) |
| Pricing | $0.023/GB storage + $0.09/GB egress |
| Estimated cost | ~$1-2/month |

**What it does:** Stores non-video files: student resumes, profile avatars, and exported CSV/PDF reports. All buckets are private — files are accessed only via pre-signed URLs.

**Three buckets:**
| Bucket | Contents | Max file size |
|--------|----------|---------------|
| `ict-lms-resumes` | Student resumes for job applications | 10 MB (PDF only) |
| `ict-lms-avatars` | User profile pictures | 2 MB (JPEG/PNG/WebP) |
| `ict-lms-materials` | Course materials (PDF, Excel, Word, PPTX, images, archives) | 100 MB |
| `ict-lms-exports` | Admin data exports (CSV/PDF) | Temporary, auto-deleted after 24h |

**Upload flow (pre-signed URL pattern):**
1. Frontend calls `POST /api/v1/materials/upload-url` with `{file_name, file_type, batch_id}`
2. FastAPI validates role/batch access, generates S3 pre-signed PUT URL (15 min expiry)
3. Frontend uploads file directly to S3 (bypasses EC2 — no bandwidth bottleneck)
4. Frontend calls `POST /api/v1/materials/` with `{object_key, title, ...}` to register in DB

**Why S3 over Supabase Storage:**
- Already in AWS ecosystem (EC2)
- No Supabase vendor dependency
- Cheapest object storage available
- Pre-signed URLs work identically for web and mobile

---

### 2.7 Bunny.net Stream (Video Hosting & CDN)

| Detail | Value |
|--------|-------|
| Storage cost | $0.005/GB/month |
| Streaming cost | $0.01/GB bandwidth |
| Estimated cost | $10-20/month (1,000 students) |

**What it does:** Stores all lecture videos and Zoom class recordings. Auto-transcodes uploads to multiple quality levels (240p → 1080p). Serves video from the nearest CDN edge server. Supports DRM, signed URLs, and visible watermarking.

**Video security (3 layers):**
1. **Signed URLs** — Every video URL expires in 10 minutes. Generated by FastAPI after enrollment verification.
2. **Watermark** — Student's name + ID overlaid on the video during playback. Deters screen recording.
3. **DRM** — Bunny.net's built-in DRM prevents unauthorized playback on non-authorized devices.

**Lecture viewing flow:**
1. Student opens lecture page → frontend calls `POST /api/v1/lectures/{id}/signed-url`
2. FastAPI verifies: Is student enrolled in this batch? Is account active? Is batch within grace period?
3. If yes → FastAPI generates Bunny.net signed URL with watermark params (10 min expiry)
4. Signed URL returned to frontend → video player loads and streams
5. URL expires — sharing it is useless

**Lecture upload flow:**
1. Course Creator uploads video in LMS → frontend sends to FastAPI
2. FastAPI streams file to Bunny.net API → receives `bunny_video_id` + processing status
3. FastAPI stores video metadata in `lectures` table
4. Bunny.net auto-transcodes to multiple quality levels in the background

---

### 2.8 Zoom API (Live Classes)

| Detail | Value |
|--------|-------|
| Auth method | Server-to-Server OAuth |
| Scopes | `meeting:write:admin`, `meeting:read:admin`, `report:read:admin` |
| Webhooks | `meeting.started`, `meeting.ended`, `recording.completed` |
| Cost | $0 (uses institute's existing Zoom plan) |

**What it does:** Programmatic Zoom meeting creation, status syncing via webhooks, attendance tracking, and recording retrieval.

**Meeting creation flow:**
1. Teacher fills schedule form → `POST /api/v1/zoom/classes` with `{title, batch_id, zoom_account_id, date, time, duration}`
2. FastAPI decrypts Zoom OAuth credentials from `zoom_accounts` table
3. FastAPI calls Zoom API: `POST /v2/users/me/meetings`
4. Zoom returns `meeting_id`, `join_url`, `start_url`
5. FastAPI stores in `zoom_classes` table → returns to frontend

**Webhook flow (class status):**
1. Teacher starts meeting in Zoom
2. Zoom sends `meeting.started` webhook → `POST /api/v1/zoom/webhook` on EC2
3. FastAPI validates webhook signature (HMAC-SHA256 with `ZOOM_WEBHOOK_SECRET`)
4. Updates `zoom_classes.status = 'live'` → pushes WebSocket message to students
5. When meeting ends: `meeting.ended` → status = `'completed'` → triggers attendance fetch

**Recording flow:**
1. Zoom sends `recording.completed` webhook with recording download URL
2. FastAPI downloads recording from Zoom
3. FastAPI uploads to Bunny.net → stores in `class_recordings` table
4. Students see recording in their course's "Class Recordings" tab

**Zoom credentials security:** OAuth `client_secret` is encrypted at rest using Fernet symmetric encryption (Python `cryptography` library). The encryption key is an environment variable — never stored in DB.

---

### 2.9 Resend (Email)

| Detail | Value |
|--------|-------|
| Free tier | 100 emails/day |
| Python SDK | `resend` package |
| Cost | $0 |

**What it does:** Sends Zoom class reminder emails to students 1 hour before each class.

**Reminder flow:**
1. APScheduler runs `send_zoom_reminders` every 15 minutes
2. Queries `zoom_classes` starting in the next hour where `reminder_sent = false`
3. For each class: gets enrolled students from `student_batches`
4. Sends email via Resend API: subject, teacher name, class time, Zoom join link
5. Marks `reminder_sent = true` in DB

**Why Resend:** Simple API, generous free tier (100/day is more than enough for 2-10 classes/day), modern developer experience.

---

### 2.10 APScheduler (Cron Jobs)

| Detail | Value |
|--------|-------|
| Version | APScheduler 3.10+ |
| Variant | `AsyncIOScheduler` |
| Cost | $0 (runs inside FastAPI process) |

**What it does:** Runs two scheduled tasks inside the FastAPI process — no separate worker or Redis required.

**Jobs:**
| Job | Schedule | What it does |
|-----|----------|-------------|
| `send_zoom_reminders` | Every 15 minutes | Email students about upcoming Zoom classes |
| `cleanup_stale_sessions` | Daily at 3 AM PKT | Deactivate sessions older than 30 days |

**Why APScheduler over Celery:** Only 2 cron jobs. Celery requires Redis + a separate worker process = more infrastructure, more cost, more complexity. APScheduler runs in-process. If the LMS grows to need task queues (e.g., 50+ cron jobs, background video processing), migrate to Celery at that point.

---

### 2.11 WebSockets (FastAPI Native)

**What it does:** Provides real-time updates without polling. Three channels:

| Channel | Path | Purpose |
|---------|------|---------|
| Class Status | `/ws/class-status/{batch_id}` | Push when a Zoom class goes live or completes |
| Announcements | `/ws/announcements/{user_id}` | Push new announcements to the user |
| Session | `/ws/session/{session_id}` | Push "you have been logged out" when admin terminates a session |

**Auth:** JWT token passed as query parameter `?token=xxx` (browsers cannot set headers on WebSocket connections). Token is validated on connect.

**Architecture:** `ConnectionManager` class maintains a `dict[str, list[WebSocket]]` mapping channel IDs to connected sockets. Single-server architecture — all connections are in-memory on the EC2 instance. At scale (multiple EC2 instances), add Redis Pub/Sub for cross-instance message delivery.

---

## 3. How Everything Connects

### Data Flow Examples

**Student watches a lecture:**
```
1. Student opens course page
   → Next.js calls GET /api/v1/lectures?batch_id=X&course_id=Y
   → FastAPI queries RDS → returns lecture list

2. Student clicks a lecture
   → Next.js calls POST /api/v1/lectures/{id}/signed-url
   → FastAPI checks student_batches in RDS (enrollment + grace period)
   → FastAPI generates Bunny.net signed URL (10 min expiry + watermark)
   → Returns URL to frontend → video player loads

3. Student watches 90%+
   → Next.js calls POST /api/v1/lectures/{id}/progress
   → FastAPI UPSERTs lecture_progress in RDS (status = 'completed')
```

**Teacher schedules a Zoom class:**
```
1. Teacher fills form
   → Next.js calls POST /api/v1/zoom/classes
   → FastAPI decrypts Zoom credentials from zoom_accounts table
   → FastAPI calls Zoom API → creates meeting → gets join URL
   → FastAPI stores in zoom_classes table in RDS
   → Returns class with Zoom link to frontend

2. Teacher starts meeting in Zoom
   → Zoom sends webhook to POST /api/v1/zoom/webhook
   → FastAPI validates signature → updates status to 'live'
   → FastAPI pushes WebSocket message to /ws/class-status/{batch_id}
   → Students see "Join Class" button appear

3. Meeting ends
   → Zoom sends webhook → status = 'completed'
   → FastAPI calls Zoom Past Participants API → inserts zoom_attendance
   → If recording available: downloads from Zoom → uploads to Bunny.net → creates class_recordings row
```

**Student applies to a job:**
```
1. Student clicks "Apply Now" with resume
   → Next.js calls POST /api/v1/materials/upload-url (resume type)
   → FastAPI returns S3 pre-signed PUT URL
   → Browser uploads resume directly to S3

2. After upload completes:
   → Next.js calls POST /api/v1/jobs/{id}/apply with {resume_key, cover_letter}
   → FastAPI creates job_applications row in RDS (status = 'applied')

3. Course Creator reviews applications:
   → CC opens job page → GET /api/v1/jobs/{id}/applications
   → CC updates status → PATCH /api/v1/jobs/{id}/applications/{app_id}/status
   → Student sees updated status on their "My Applications" page
```

---

## 4. Cost Breakdown

### Monthly Estimates

| Service | Year 1 (1,000 students) | Year 2-3 (5,000 students) | Notes |
|---------|-------------------------|---------------------------|-------|
| Vercel | $0 | $0 | Free tier: 100GB bandwidth |
| AWS RDS (db.t4g.micro) | $12 | $12 | 20GB gp3; may upgrade to db.t4g.small at scale |
| AWS EC2 t3.small | $15 | $15 | May upgrade to t3.medium ($30) at 5k |
| AWS S3 | $1-2 | $3-5 | ~50GB files @ $0.023/GB |
| Bunny.net Stream | $10-20 | $30-60 | Dominant variable cost (CDN bandwidth) |
| Resend | $0 | $0 | Free: 100 emails/day |
| Route 53 / DNS | $0.50 | $0.50 | Or use Cloudflare (free) |
| SSL (Let's Encrypt) | $0 | $0 | Auto-renews via Certbot |
| **Total** | **$39-49/month** | **$79-112/month** | |

### Bunny.net Cost Calculation

At 1,000 students, each watching 2 hours/week:
- Avg bitrate: ~1.5 Mbps (720p adaptive)
- Per student per week: 2h × 3600s × 1.5Mbps ÷ 8 = ~1.35 GB
- Monthly: 1,000 × 1.35 × 4 = ~5.4 TB bandwidth
- CDN cost: 5.4 TB × $0.01/GB = ~$54/month

More realistic (not all students watch every week): ~$20-30/month.

### Comparison vs Supabase Stack

| | This Stack | Supabase Stack |
|--|-----------|---------------|
| Year 1 | $27-37/mo | $50-105/mo (Pro $25 + Vercel $20 + Bunny) |
| Year 2-3 | $67-100/mo | $75-150/mo |
| Vendor lock-in | Low (standard PostgreSQL + AWS) | Medium (Supabase Auth, RLS, Edge Functions) |
| Control | Full (own server, own code) | Limited (Supabase platform constraints) |

---

## 5. Environment Variables

```bash
# ─── FastAPI / Application ───────────────────────────
SECRET_KEY=<random-64-char-hex>              # JWT signing key
ALGORITHM=HS256                               # JWT algorithm
ACCESS_TOKEN_EXPIRE_MINUTES=15                # Access token lifetime
REFRESH_TOKEN_EXPIRE_DAYS=7                   # Refresh token lifetime
ENCRYPTION_KEY=<Fernet-32-byte-base64-key>    # Zoom client_secret encryption
ENVIRONMENT=production                        # production | development

# ─── Database (AWS RDS) ──────────────────────────────
DATABASE_URL=postgresql+asyncpg://user:pass@ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com:5432/dbname?ssl=require

# ─── AWS S3 ──────────────────────────────────────────
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
S3_BUCKET_RESUMES=ict-lms-resumes
S3_BUCKET_AVATARS=ict-lms-avatars
S3_BUCKET_MATERIALS=ict-lms-materials
S3_BUCKET_EXPORTS=ict-lms-exports

# ─── Bunny.net ───────────────────────────────────────
BUNNY_API_KEY=...
BUNNY_LIBRARY_ID=...
BUNNY_CDN_HOSTNAME=vz-xxx.b-cdn.net
BUNNY_SIGNING_KEY=...                         # For signed URL generation

# ─── Zoom ────────────────────────────────────────────
ZOOM_WEBHOOK_SECRET=...                       # Webhook signature validation

# ─── Email (Resend) ──────────────────────────────────
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@ictlms.com

# ─── CORS ────────────────────────────────────────────
ALLOWED_ORIGINS=https://ict-lms.vercel.app,http://localhost:3000

# ─── Frontend (Vercel) ───────────────────────────────
NEXT_PUBLIC_API_URL=https://api.ictlms.com    # Set in Vercel dashboard
```

---

## 6. Python Dependencies

```txt
# ─── Core Framework ──────────────────────────────────
fastapi==0.115.6
uvicorn[standard]==0.32.1
python-multipart==0.0.18

# ─── ORM & Database ──────────────────────────────────
sqlmodel==0.0.22
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.14.1
greenlet==3.1.1

# ─── Authentication ──────────────────────────────────
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# ─── AWS ─────────────────────────────────────────────
boto3==1.35.86
botocore==1.35.86

# ─── Scheduling ──────────────────────────────────────
apscheduler==3.10.4

# ─── External Service Clients ────────────────────────
httpx==0.28.1            # Async HTTP (Bunny.net, Zoom API)
resend==2.5.0            # Email

# ─── Cryptography ────────────────────────────────────
cryptography==44.0.0     # Fernet encryption for Zoom secrets

# ─── Configuration ───────────────────────────────────
python-dotenv==1.0.1
pydantic-settings==2.7.1

# ─── Data Processing ─────────────────────────────────
pandas==2.2.3            # CSV import/export
reportlab==4.2.5         # PDF export

# ─── Rate Limiting ───────────────────────────────────
slowapi==0.1.9

# ─── WebSocket ───────────────────────────────────────
websockets==14.1         # Required by uvicorn for WS support

# ─── Testing ─────────────────────────────────────────
pytest==8.3.4
pytest-asyncio==0.24.0
```

---

## 7. Development Workflow

### Local Setup

```bash
# 1. Clone the monorepo
git clone https://github.com/org/ICT_LMS_CUSTOM.git
cd ICT_LMS_CUSTOM

# 2. Set up the backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your RDS connection URL and other keys
# For local dev, you can use the shared RDS instance or a local PostgreSQL

# 4. Run migrations
alembic upgrade head

# 5. Seed initial data
python -m app.scripts.seed

# 6. Start FastAPI (with auto-reload)
uvicorn app.main:app --reload --port 8000

# 7. In another terminal — start frontend
cd ..
npm install
npm run dev
# Frontend runs on http://localhost:3000
# API runs on http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Day-to-Day Commands

```bash
# Create a new Alembic migration after changing models
alembic revision --autogenerate -m "description_of_change"

# Apply migrations
alembic upgrade head

# Rollback last migration
alembic downgrade -1

# Run tests
pytest tests/ -v

# Run a specific test
pytest tests/test_auth.py -v

# Check API docs
open http://localhost:8000/docs

# RDS management (via AWS CLI)
aws rds describe-db-instances --db-instance-identifier ict-lms-db
aws rds create-db-snapshot --db-instance-identifier ict-lms-db --db-snapshot-identifier manual-backup-$(date +%F)
```

### Deployment Flow

```bash
# Push to main branch triggers GitHub Actions:
# 1. Run pytest in CI
# 2. SSH into EC2 → git pull → pip install → alembic upgrade → restart
git push origin main
```

---

## 8. Scaling Path

### Current (1,000 students): Single EC2

Everything runs on one `t3.small`. Simple, cheap, sufficient.

### Growth (5,000 students): Upgrade EC2

- Upgrade to `t3.medium` (4 GB RAM) — $30/month
- Increase Uvicorn workers from 2 to 4
- Upgrade RDS to db.t4g.small if needed (~$24/month)
- Bunny.net auto-scales (CDN)

### Scale (10,000+ students): Add redundancy

- Add Application Load Balancer + 2 EC2 instances
- Add Redis for WebSocket cross-instance messaging and session caching
- Move APScheduler jobs to Celery + Redis
- Add CloudWatch alarms for monitoring
- Enable RDS Multi-AZ for automatic failover

### SaaS (50,000+ students): Platform architecture

- Kubernetes (EKS) or ECS for container orchestration
- Upgrade RDS to db.r6g class for high-memory workloads
- ElastiCache (Redis) for caching
- CloudFront CDN in front of the API
- Multi-region deployment

Each scaling step is additive — the core FastAPI + RDS + S3 architecture stays the same.

---

## Security Summary

| Concern | Solution | Service |
|---------|----------|---------|
| Authentication | JWT (access 15min + refresh 7 days) + bcrypt | FastAPI |
| Authorization | Role-based access control (RBAC) per endpoint | FastAPI middleware |
| Device limit | Configurable max sessions per user (default 2) | FastAPI + RDS |
| Video protection | Signed URLs (10min expiry) + watermark + DRM | Bunny.net + FastAPI |
| File access | Pre-signed URLs (15min expiry) | AWS S3 + FastAPI |
| Zoom credentials | Fernet symmetric encryption at rest | FastAPI + `cryptography` |
| API secrets | Environment variables on EC2 (never in code/DB) | EC2 `.env` |
| SSL/TLS | Let's Encrypt auto-renewing certificate | Nginx + Certbot |
| Rate limiting | Per-IP and per-user request limits | `slowapi` |
| SQL injection | Parameterized queries via SQLModel/SQLAlchemy | SQLModel |
| CORS | Explicit origin allowlist | FastAPI middleware |
| Webhook validation | HMAC-SHA256 signature verification | FastAPI |

For detailed security documentation, see `docs/Security.md`.

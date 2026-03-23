<div align="center">

<!-- Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0066FF,003399&height=220&section=header&text=ICT%20LMS&fontSize=80&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=Learning%20Management%20System&descSize=24&descAlignY=55&descAlign=50" width="100%"/>

<br/>

<!-- Logo & Branding -->
<a href="https://zensbot.com">
<img src="https://img.shields.io/badge/Built%20by-Zensbot.com%20LLC-0066FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHBhdGggZD0iTTEyIDJMMiA3bDEwIDUgMTAtNS0xMC01ek0yIDE3bDEwIDUgMTAtNS0xMC01LTEwIDV6TTIgMTJsMTAgNSAxMC01LTEwLTUtMTAgNXoiLz48L3N2Zz4=&logoColor=white" alt="Zensbot.com LLC" height="35"/>
</a>

<br/><br/>

<!-- Badges -->
<img src="https://img.shields.io/badge/Next.js-13-0066FF?style=flat-square&logo=next.js&logoColor=white" alt="Next.js"/>
<img src="https://img.shields.io/badge/FastAPI-0.104-0066FF?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
<img src="https://img.shields.io/badge/PostgreSQL-16-0066FF?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
<img src="https://img.shields.io/badge/TypeScript-5.0-0066FF?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
<img src="https://img.shields.io/badge/Python-3.11-0066FF?style=flat-square&logo=python&logoColor=white" alt="Python"/>
<img src="https://img.shields.io/badge/Tailwind-3.4-0066FF?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind"/>

<br/>

<img src="https://img.shields.io/badge/status-Production-00CC66?style=flat-square" alt="Status"/>
<img src="https://img.shields.io/badge/license-Proprietary-FF6600?style=flat-square" alt="License"/>
<img src="https://img.shields.io/badge/deploy-AWS%20EC2-FF9900?style=flat-square&logo=amazon-aws&logoColor=white" alt="AWS"/>
<img src="https://img.shields.io/badge/frontend-Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel"/>

<br/><br/>

> **A production-grade Learning Management System built for institutes managing thousands of students, teachers, and courses — with live Zoom classes, video streaming, and real-time collaboration.**

<br/>

</div>

---

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; Four Powerful Roles

<table>
<tr>
<td align="center" width="25%">

### <img src="https://img.shields.io/badge/Admin-0066FF?style=for-the-badge" alt="Admin"/>

Manage everything — users, batches, settings, devices, and institute-wide analytics

</td>
<td align="center" width="25%">

### <img src="https://img.shields.io/badge/Course%20Creator-003399?style=for-the-badge" alt="Course Creator"/>

Build courses, upload video lectures, manage curriculum, materials, and job postings

</td>
<td align="center" width="25%">

### <img src="https://img.shields.io/badge/Teacher-0055CC?style=for-the-badge" alt="Teacher"/>

Teach batches, schedule Zoom classes, upload materials, track student progress

</td>
<td align="center" width="25%">

### <img src="https://img.shields.io/badge/Student-0088FF?style=for-the-badge" alt="Student"/>

Watch lectures, download materials, join live classes, browse job opportunities

</td>
</tr>
</table>

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; Feature Highlights

<table>
<tr>
<td width="50%">

### Video Streaming
```
Bunny.net CDN  ·  TUS Resumable Upload
Parallel Chunked Upload  ·  Auto-Encoding
Signed Token Playback  ·  Progress Tracking
Anti-Piracy Watermark Overlay
```

</td>
<td width="50%">

### Live Classes
```
Zoom Integration  ·  Server-to-Server OAuth
Auto-Recording  ·  Webhook Status Sync
Schedule Management  ·  Recording Playback
```

</td>
</tr>
<tr>
<td width="50%">

### Authentication & Security
```
JWT Access + Refresh Tokens
Device Limit Enforcement
Role-Based Access Control
Soft-Delete Across All Entities
Rate Limiting on Auth Endpoints
```

</td>
<td width="50%">

### Course Management
```
Curriculum Builder  ·  Module Sequencing
Material Upload (S3)  ·  Batch Assignment
Multi-Batch Courses  ·  Student Enrollment
Progress Tracking  ·  Resume Playback
```

</td>
</tr>
</table>

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; Architecture

```mermaid
graph LR
    subgraph Frontend
        A[Next.js 13<br/>App Router] --> B[API Client<br/>Auto Case Convert]
    end

    subgraph Backend
        B -->|HTTPS| C[FastAPI<br/>95+ Endpoints]
        C --> D[Services Layer]
        D --> E[(PostgreSQL<br/>20 Tables)]
    end

    subgraph External
        A -->|TUS Upload| F[Bunny.net CDN<br/>Video Streaming]
        C -->|OAuth| G[Zoom API<br/>Live Classes]
        C -->|S3| H[AWS S3<br/>Materials]
        C -->|SMTP| I[Resend<br/>Email]
    end

    style A fill:#0066FF,color:#fff
    style C fill:#003399,color:#fff
    style E fill:#0055CC,color:#fff
    style F fill:#FF6600,color:#fff
    style G fill:#2D8CFF,color:#fff
    style H fill:#FF9900,color:#fff
    style I fill:#0088FF,color:#fff
```

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; Tech Stack

<table>
<tr>
<td align="center" width="33%">

### Frontend
<br/>

<img src="https://skillicons.dev/icons?i=nextjs,typescript,tailwind,vercel&theme=light" alt="Frontend Stack"/>

<br/><br/>

Next.js 13 · TypeScript · Tailwind CSS
Radix UI · Shadcn · Sonner · TUS Client

</td>
<td align="center" width="33%">

### Backend
<br/>

<img src="https://skillicons.dev/icons?i=fastapi,python,postgres,aws&theme=light" alt="Backend Stack"/>

<br/><br/>

FastAPI · SQLModel · PostgreSQL
SQLAlchemy 2.0 · Alembic · Pydantic

</td>
<td align="center" width="33%">

### Infrastructure
<br/>

<img src="https://skillicons.dev/icons?i=aws,nginx,github,linux&theme=light" alt="Infra Stack"/>

<br/><br/>

AWS EC2 · Nginx · GitHub Actions
Bunny CDN · Zoom API · Resend

</td>
</tr>
</table>

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; Quick Start

<details>
<summary><b>Prerequisites</b></summary>
<br/>

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.11+ |
| PostgreSQL | 14+ |

</details>

<br/>

**1. Clone & Install**
```bash
git clone https://github.com/your-org/ICT_LMS_CUSTOM.git
cd ICT_LMS_CUSTOM
```

<table>
<tr>
<td width="50%">

**Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../envs/backend.env .env # configure your values
alembic upgrade head
uvicorn app.main:app --reload
```

</td>
<td width="50%">

**Frontend**
```bash
cd frontend
npm install
cp ../envs/frontend.env .env
npm run dev
```

</td>
</tr>
</table>

**2. Open** → [`http://localhost:3000`](http://localhost:3000)

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; Project Structure

```
ICT_LMS_CUSTOM/
├── backend/
│   ├── app/
│   │   ├── routers/        # 11 API routers (95+ endpoints)
│   │   ├── services/       # Business logic layer
│   │   ├── models/         # 20 SQLModel tables
│   │   ├── schemas/        # Pydantic DTOs
│   │   ├── middleware/     # JWT auth, role guards
│   │   └── utils/          # Bunny, S3, Zoom, email, security
│   ├── migrations/         # Alembic migrations
│   └── main.py             # App entry point
│
├── frontend/
│   ├── app/                # 33+ pages (Next.js App Router)
│   │   ├── admin/          #   Admin dashboard & management
│   │   ├── course-creator/ #   Course & content management
│   │   ├── teacher/        #   Teaching & class scheduling
│   │   └── student/        #   Learning & video playback
│   ├── components/         # Shared UI components
│   ├── lib/api/            # 11 API modules + client
│   └── hooks/              # useApi, useMutation, usePaginatedApi
│
├── envs/                   # Environment variable templates
└── .github/workflows/      # CI/CD pipeline
```

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; API Overview

<table>
<tr>
<td>

| Router | Endpoints | Description |
|--------|:---------:|-------------|
| `auth` | 4 | Login, refresh, logout, session |
| `users` | 8 | CRUD, profile, device management |
| `batches` | 12 | Batches, enrollment, student lists |
| `courses` | 8 | Course CRUD, assignment |
| `curriculum` | 6 | Modules, sequencing, topics |
| `lectures` | 10 | Upload, stream, progress, signed URLs |
| `materials` | 6 | Upload (S3), download, metadata |
| `zoom` | 8 | Classes, schedule, recordings, webhooks |
| `jobs` | 6 | Job postings, applications |
| `announcements` | 6 | Batch announcements, WebSocket |
| `admin` | 15+ | Settings, analytics, system management |

</td>
</tr>
</table>

> All endpoints return `PaginatedResponse<T>` for list operations with server-side pagination.

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; Deployment

```mermaid
graph LR
    A[git push main] -->|GitHub Actions| B{CI Checks}
    B -->|Pass| C[SSH Deploy to EC2]
    C --> D[pip install + alembic migrate]
    D --> E[systemctl restart]
    E --> F[Health Check]
    F -->|Pass| G[Live on apiict.zensbot.site]

    style A fill:#0066FF,color:#fff
    style B fill:#003399,color:#fff
    style C fill:#FF9900,color:#fff
    style G fill:#00CC66,color:#fff
```

| Component | URL | Host |
|-----------|-----|------|
| **API** | `https://apiict.zensbot.site` | AWS EC2 (ap-south-1) |
| **Frontend** | `https://zensbot.online` | Vercel |
| **Database** | AWS RDS PostgreSQL | ap-south-1 (Mumbai) |
| **Video CDN** | Bunny.net Stream | Global Edge |

<br/>

## <img src="https://img.shields.io/badge/-0066FF?style=flat-square" width="12"/> &nbsp; Security

<table>
<tr>
<td width="50%">

- JWT with 15min access + 7-day refresh tokens
- Automatic token refresh with request deduplication
- Device limit enforcement per user
- Role-based endpoint guards
- Rate limiting (5/min login, 10/min refresh)

</td>
<td width="50%">

- Soft-delete on all 20 tables (audit trail)
- Signed video URLs with time-limited tokens
- Anti-piracy watermark (student email overlay)
- S3 presigned URLs for material downloads
- Encrypted Zoom credentials at rest

</td>
</tr>
</table>

<br/>

---

<div align="center">

<br/>

<a href="https://zensbot.com">
<img src="https://capsule-render.vercel.app/api?type=rect&color=0066FF&height=80&section=footer&text=Zensbot.com%20LLC&fontSize=28&fontColor=ffffff&fontAlignY=55" width="300"/>
</a>

<br/><br/>

<img src="https://img.shields.io/badge/Made%20with-FastAPI%20%2B%20Next.js-0066FF?style=flat-square" alt="Made with"/>
<img src="https://img.shields.io/badge/Deployed%20on-AWS-FF9900?style=flat-square&logo=amazon-aws&logoColor=white" alt="AWS"/>
<img src="https://img.shields.io/badge/%C2%A9%202026-Zensbot.com%20LLC-0066FF?style=flat-square" alt="Copyright"/>

<br/><br/>

**[zensbot.com](https://zensbot.com)** · Built with precision for education

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0066FF,003399&height=100&section=footer" width="100%"/>

</div>

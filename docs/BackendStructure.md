# ICT Institute LMS — Backend Project Structure

> Complete folder layout, architectural patterns, and conventions for the FastAPI backend.
> The backend lives in `/backend` inside the monorepo.

---

## Table of Contents

1. [Monorepo Layout](#1-monorepo-layout)
2. [Backend Folder Structure](#2-backend-folder-structure)
3. [Architectural Patterns](#3-architectural-patterns)
4. [Module Responsibilities](#4-module-responsibilities)
5. [Dependency Injection](#5-dependency-injection)
6. [Error Handling](#6-error-handling)
7. [Logging](#7-logging)
8. [Testing Strategy](#8-testing-strategy)
9. [Code Conventions](#9-code-conventions)

---

## 1. Monorepo Layout

```
ICT_LMS_CUSTOM/
├── app/                          # Next.js 13 pages (existing frontend)
├── components/                   # React components (existing)
├── lib/                          # Frontend types + utilities (existing)
├── hooks/                        # React hooks (existing)
├── docs/                         # Documentation (this file and others)
│   ├── stack-tech.md
│   ├── DatabaseSchema.md
│   ├── API.md
│   ├── Security.md
│   ├── Deployment.md
│   ├── BackendStructure.md       # This file
│   └── Features.md
├── backend/                      # FastAPI backend (NEW)
│   ├── app/                      # Application source code
│   ├── migrations/               # Alembic database migrations
│   ├── tests/                    # Test suite
│   ├── .env.example              # Environment variable template
│   ├── alembic.ini               # Alembic configuration
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile                # Container build (for CI/CD)
├── .github/
│   └── workflows/
│       └── deploy-backend.yml    # CI/CD pipeline
├── package.json                  # Frontend dependencies (existing)
├── next.config.js                # Next.js config (existing)
├── tailwind.config.ts            # Tailwind config (existing)
└── tsconfig.json                 # TypeScript config (existing)
```

---

## 2. Backend Folder Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app init, middleware, router registration
│   ├── config.py                 # Pydantic Settings — loads from .env
│   ├── database.py               # Async SQLAlchemy engine + session factory
│   │
│   ├── models/                   # SQLModel table definitions (1 file per domain)
│   │   ├── __init__.py           # Import all models (needed for Alembic discovery)
│   │   ├── user.py               # User, UserSession, SystemSetting
│   │   ├── batch.py              # Batch, StudentBatch, StudentBatchHistory
│   │   ├── course.py             # Course, BatchCourse, Lecture, LectureProgress
│   │   ├── curriculum.py         # CurriculumModule
│   │   ├── material.py           # BatchMaterial
│   │   ├── zoom.py               # ZoomAccount, ZoomClass, ClassRecording, ZoomAttendance
│   │   ├── announcement.py       # Announcement
│   │   ├── job.py                # Job, JobApplication
│   │   └── activity_log.py       # ActivityLog
│   │
│   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── auth.py               # LoginRequest, TokenResponse, RefreshRequest, ChangePasswordRequest
│   │   ├── user.py               # UserCreate, UserUpdate, UserResponse, UnifiedUserResponse
│   │   ├── batch.py              # BatchCreate, BatchUpdate, BatchResponse, BatchWithStatusResponse
│   │   ├── course.py             # CourseCreate, CourseUpdate, CourseResponse
│   │   ├── lecture.py            # LectureCreate, LectureResponse, SignedUrlResponse, ProgressUpdate
│   │   ├── curriculum.py         # ModuleCreate, ModuleUpdate, ModuleResponse
│   │   ├── material.py           # MaterialCreate, MaterialResponse, UploadUrlRequest, UploadUrlResponse
│   │   ├── zoom.py               # ZoomAccountCreate, ZoomClassCreate, ZoomClassResponse
│   │   ├── announcement.py       # AnnouncementCreate, AnnouncementResponse
│   │   ├── job.py                # JobCreate, ApplicationCreate, ApplicationStatusUpdate
│   │   ├── admin.py              # DashboardStats, InsightsResponse, DeviceSummaryResponse
│   │   └── common.py             # PaginatedResponse[T], ErrorResponse
│   │
│   ├── routers/                  # API route handlers (thin — delegate to services)
│   │   ├── __init__.py
│   │   ├── auth.py               # /api/v1/auth/*
│   │   ├── users.py              # /api/v1/users/*
│   │   ├── batches.py            # /api/v1/batches/*
│   │   ├── courses.py            # /api/v1/courses/*
│   │   ├── lectures.py           # /api/v1/lectures/*
│   │   ├── curriculum.py         # /api/v1/curriculum/*
│   │   ├── materials.py          # /api/v1/materials/*
│   │   ├── zoom.py               # /api/v1/zoom/*
│   │   ├── announcements.py      # /api/v1/announcements/*
│   │   ├── jobs.py               # /api/v1/jobs/*
│   │   └── admin.py              # /api/v1/admin/*
│   │
│   ├── services/                 # Business logic layer (all DB queries here)
│   │   ├── __init__.py
│   │   ├── auth_service.py       # Login, refresh, logout, device limit enforcement
│   │   ├── user_service.py       # User CRUD, bulk import, export
│   │   ├── batch_service.py      # Batch CRUD, student enrollment
│   │   ├── course_service.py     # Course CRUD, clone-course
│   │   ├── lecture_service.py    # Lecture CRUD, progress tracking
│   │   ├── curriculum_service.py # Module CRUD, reordering
│   │   ├── material_service.py   # Material CRUD
│   │   ├── zoom_service.py       # Zoom API calls, webhook processing, attendance
│   │   ├── announcement_service.py
│   │   ├── job_service.py        # Job CRUD, application management
│   │   ├── analytics_service.py  # Dashboard stats, insights queries
│   │   └── activity_service.py   # Activity log insertion
│   │
│   ├── middleware/               # Request-level middleware
│   │   ├── __init__.py
│   │   ├── auth.py               # get_current_user, require_roles dependencies
│   │   └── logging.py            # Request/response logging middleware
│   │
│   ├── utils/                    # Utility modules (external service wrappers)
│   │   ├── __init__.py
│   │   ├── s3.py                 # boto3 wrapper — presigned upload/download URLs
│   │   ├── bunny.py              # Bunny.net API — upload video, generate signed URL
│   │   ├── zoom_api.py           # Zoom REST API — create meeting, get participants
│   │   ├── email.py              # Resend wrapper — send_zoom_reminder()
│   │   ├── encryption.py         # Fernet encrypt/decrypt for Zoom secrets
│   │   ├── transformers.py       # Enum mapping (course_creator <-> course-creator)
│   │   └── formatters.py         # Duration, file size, timezone helpers
│   │
│   ├── websockets/               # WebSocket endpoint handlers
│   │   ├── __init__.py
│   │   ├── manager.py            # ConnectionManager class
│   │   ├── class_status.py       # /ws/class-status/{batch_id}
│   │   ├── announcements.py      # /ws/announcements/{user_id}
│   │   └── sessions.py           # /ws/session/{session_id}
│   │
│   └── scheduler/                # APScheduler cron jobs
│       ├── __init__.py
│       └── jobs.py               # Job definitions + scheduler setup
│
├── migrations/                   # Alembic
│   ├── env.py                    # Async engine configuration
│   ├── script.py.mako            # Migration file template
│   └── versions/
│       └── 001_initial_schema.py # First migration (all 20 tables)
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py               # Shared fixtures (test DB, test client, auth headers)
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_batches.py
│   ├── test_courses.py
│   ├── test_lectures.py
│   ├── test_zoom.py
│   └── test_jobs.py
│
├── scripts/
│   ├── seed.py                   # Seed initial data (admin user, system settings)
│   └── generate_secret.py        # Generate SECRET_KEY and ENCRYPTION_KEY
│
├── .env.example
├── alembic.ini
├── requirements.txt
└── Dockerfile
```

---

## 3. Architectural Patterns

### 3.1 Three-Layer Architecture

```
Router (thin)  →  Service (business logic)  →  Model (database)
   ↑                      ↑                        ↑
 Validates input      All queries here        SQLModel table
 Returns response     RBAC fine-grained       definitions
 HTTP concerns only   Business rules
```

**Rule:** Routers never import `sqlmodel.select` or touch the database directly. All DB operations go through the service layer.

### 3.2 Model vs Schema Separation

SQLModel classes with `table=True` are **database models** (in `models/`). SQLModel classes without `table=True` are **API schemas** (in `schemas/`). Never use a `table=True` model as a response schema — it would expose `hashed_password` and other internal fields.

```python
# models/user.py — DATABASE model
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str
    name: str
    hashed_password: str  # NEVER expose this
    role: UserRole
    status: UserStatus = UserStatus.active
    deleted_at: Optional[datetime] = None

# schemas/user.py — API response schema
class UserResponse(SQLModel):
    id: uuid.UUID
    email: str
    name: str
    phone: Optional[str]
    role: str        # Transformed to kebab-case
    status: str
    # No hashed_password field
```

### 3.3 Soft Delete Pattern

Every "delete" operation sets `deleted_at = now()` instead of removing the row. Every query must filter out deleted rows.

```python
# Shared utility in services
from sqlmodel import col

def not_deleted(model_class):
    """Filter condition: WHERE deleted_at IS NULL"""
    return col(model_class.deleted_at).is_(None)

# Usage in any service:
statement = select(User).where(not_deleted(User))
```

### 3.4 Enum Transformation Pattern

The database stores snake_case enums (`course_creator`), the frontend expects kebab-case (`course-creator`). Transformation happens at the API boundary in response schemas.

```python
# utils/transformers.py
DB_TO_FRONTEND = {
    "course_creator": "course-creator",
    "full_time": "full-time",
    "part_time": "part-time",
    "in_progress": "in-progress",
}

FRONTEND_TO_DB = {v: k for k, v in DB_TO_FRONTEND.items()}

def to_frontend_enum(value: str) -> str:
    return DB_TO_FRONTEND.get(value, value)

def to_db_enum(value: str) -> str:
    return FRONTEND_TO_DB.get(value, value)

# Usage in schemas — Pydantic model_validator:
class UserResponse(SQLModel):
    role: str

    @model_validator(mode="after")
    def transform_enums(self):
        self.role = to_frontend_enum(self.role)
        return self
```

### 3.5 Pagination Pattern

All list endpoints return paginated responses with a consistent envelope.

```python
# schemas/common.py
from typing import Generic, TypeVar, List
from sqlmodel import SQLModel

T = TypeVar("T")

class PaginatedResponse(SQLModel, Generic[T]):
    data: List[T]
    total: int
    page: int
    per_page: int
    total_pages: int

# Usage in a service:
async def list_users(db: AsyncSession, page: int = 1, per_page: int = 20, **filters):
    # Count query
    count_stmt = select(func.count()).select_from(User).where(not_deleted(User))
    total = (await db.exec(count_stmt)).one()

    # Data query with offset/limit
    stmt = select(User).where(not_deleted(User)).offset((page-1)*per_page).limit(per_page)
    users = (await db.exec(stmt)).all()

    return PaginatedResponse(
        data=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page)
    )
```

---

## 4. Module Responsibilities

### `main.py` — Application Entry Point

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.scheduler import start_scheduler
from app.routers import auth, users, batches, courses, lectures, ...
from app.middleware.logging import LoggingMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    start_scheduler()
    yield
    # Shutdown

app = FastAPI(
    title="ICT LMS API",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(CORSMiddleware, ...)
app.add_middleware(LoggingMiddleware)

# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(batches.router, prefix="/api/v1/batches", tags=["Batches"])
# ... all 11 routers

# WebSocket endpoints
app.include_router(ws_router)

# Health check
@app.get("/health")
async def health():
    return {"status": "ok"}
```

### `config.py` — Settings

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENCRYPTION_KEY: str
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str
    DATABASE_URL_DIRECT: str  # For Alembic

    # AWS
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET_RESUMES: str = "ict-lms-resumes"
    S3_BUCKET_AVATARS: str = "ict-lms-avatars"
    S3_BUCKET_MATERIALS: str = "ict-lms-materials"
    S3_BUCKET_EXPORTS: str = "ict-lms-exports"

    # Bunny.net
    BUNNY_API_KEY: str
    BUNNY_LIBRARY_ID: str
    BUNNY_CDN_HOSTNAME: str
    BUNNY_SIGNING_KEY: str

    # Zoom
    ZOOM_WEBHOOK_SECRET: str

    # Email
    RESEND_API_KEY: str
    RESEND_FROM_EMAIL: str = "noreply@ictlms.com"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()
```

### `database.py` — Database Engine

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=5,
    max_overflow=10,
)

async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    # Import all models so SQLModel.metadata is populated
    from app.models import __init__  # noqa
```

---

## 5. Dependency Injection

FastAPI's `Depends()` system is used for three concerns, stacked in order:

```python
# 1. Database session
db: AsyncSession = Depends(get_db)

# 2. Current authenticated user
current_user: User = Depends(get_current_user)

# 3. Role-restricted user
current_user: User = Depends(require_roles("admin", "course_creator"))
```

### Auth Dependencies (`middleware/auth.py`)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    user = await db.get(User, uuid.UUID(user_id))
    if not user or user.deleted_at or user.status != UserStatus.active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

def require_roles(*roles: str):
    """Dependency that checks the current user has one of the required roles."""
    async def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker
```

### Usage in a Router

```python
# routers/batches.py
from app.middleware.auth import require_roles

router = APIRouter()

@router.post("/", response_model=BatchResponse)
async def create_batch(
    data: BatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "course_creator")),
):
    return await batch_service.create_batch(db, data, current_user)

@router.get("/", response_model=PaginatedResponse[BatchResponse])
async def list_batches(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await batch_service.list_batches(db, current_user, page, per_page)
```

---

## 6. Error Handling

### Custom Exceptions

```python
# app/exceptions.py
from fastapi import HTTPException

class NotFoundError(HTTPException):
    def __init__(self, entity: str, entity_id: str):
        super().__init__(status_code=404, detail=f"{entity} '{entity_id}' not found")

class PermissionDeniedError(HTTPException):
    def __init__(self, detail: str = "You do not have permission to perform this action"):
        super().__init__(status_code=403, detail=detail)

class EnrollmentRequiredError(HTTPException):
    def __init__(self):
        super().__init__(status_code=403, detail="Student is not enrolled in this batch")

class DeviceLimitExceededError(HTTPException):
    def __init__(self, limit: int):
        super().__init__(status_code=429, detail=f"Device limit ({limit}) exceeded")

class DuplicateError(HTTPException):
    def __init__(self, field: str):
        super().__init__(status_code=409, detail=f"A record with this {field} already exists")
```

### Global Error Response Format

All errors return:
```json
{
    "detail": "Human-readable error message"
}
```

### Validation Errors (Pydantic)

FastAPI automatically returns `422 Unprocessable Entity` with field-level errors when request validation fails:
```json
{
    "detail": [
        {
            "loc": ["body", "email"],
            "msg": "field required",
            "type": "missing"
        }
    ]
}
```

---

## 7. Logging

### Setup

```python
# app/middleware/logging.py
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("ict-lms")

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = round((time.time() - start) * 1000, 2)

        logger.info(
            f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)"
        )
        return response
```

### Log Levels

| Level | Used For |
|-------|----------|
| `INFO` | Every HTTP request/response (method, path, status, duration) |
| `WARNING` | Failed login attempts, rate limit hits, invalid tokens |
| `ERROR` | Unhandled exceptions, external service failures (Zoom, Bunny.net, S3) |
| `DEBUG` | SQL queries (development only, controlled by `echo=True` on engine) |

### Log Format

```
2025-03-05 14:30:00 INFO     POST /api/v1/auth/login → 200 (45.2ms)
2025-03-05 14:30:01 WARNING  Failed login for admin@ict.edu.pk — invalid password
2025-03-05 14:30:02 ERROR    Zoom API error: 429 Too Many Requests
```

---

## 8. Testing Strategy

### Test Layers

| Layer | What's Tested | Tool |
|-------|---------------|------|
| Unit | Service functions with real DB | pytest + pytest-asyncio |
| Integration | Full HTTP request → response cycle | httpx.AsyncClient |
| External | Mocked external APIs (Zoom, Bunny, S3) | unittest.mock / respx |

### Test Database

Use a Neon branch for testing:
```bash
neonctl branches create --name test
# Use this branch's connection URL in tests
```

### Fixtures (`tests/conftest.py`)

```python
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db, engine

@pytest_asyncio.fixture
async def db_session():
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture
async def client(db_session):
    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def admin_headers(client):
    """Login as admin and return auth headers."""
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@ict.edu.pk",
        "password": "admin123"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### Test Example

```python
# tests/test_batches.py

@pytest.mark.asyncio
async def test_create_batch(client, admin_headers):
    response = await client.post(
        "/api/v1/batches/",
        json={
            "name": "Batch 5 - Test",
            "start_date": "2025-04-01",
            "end_date": "2025-07-31",
        },
        headers=admin_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Batch 5 - Test"
    assert data["status"] == "upcoming"

@pytest.mark.asyncio
async def test_student_cannot_create_batch(client, student_headers):
    response = await client.post(
        "/api/v1/batches/",
        json={"name": "Hack", "start_date": "2025-04-01", "end_date": "2025-07-31"},
        headers=student_headers,
    )
    assert response.status_code == 403
```

---

## 9. Code Conventions

| Convention | Rule |
|-----------|------|
| File naming | `snake_case.py` for all Python files |
| Class naming | `PascalCase` for models, schemas, exceptions |
| Function naming | `snake_case` for all functions and methods |
| Router functions | Named after the action: `create_batch`, `list_batches`, `get_batch` |
| Service functions | Same naming as router functions they serve |
| Imports | Absolute imports from `app.` prefix (`from app.models.user import User`) |
| Type hints | All function parameters and return types annotated |
| Docstrings | Only on non-obvious functions. No redundant docstrings on CRUD. |
| Async | All DB operations and external API calls use `async/await` |
| Commits | Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) |

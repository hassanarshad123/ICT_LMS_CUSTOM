from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.routers import auth, users

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="ICT Institute LMS API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [settings.FRONTEND_URL]
if settings.ALLOWED_ORIGINS:
    origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

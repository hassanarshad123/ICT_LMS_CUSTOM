from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlmodel import SQLModel
from app.config import get_settings

settings = get_settings()

# asyncpg uses "ssl" not "sslmode"
_db_url = settings.DATABASE_URL.replace("sslmode=", "ssl=")

engine = create_async_engine(
    _db_url,
    echo=settings.APP_DEBUG,
    pool_size=10,          # max 10 held connections per worker (was 30 — caused OOM on db.t4g.micro)
    max_overflow=5,        # burst up to 15 total per worker; 30 max during blue-green overlap
    pool_pre_ping=True,
    pool_recycle=1800,     # 30 min (avoids stale connections on RDS idle cutoff)
    pool_timeout=10,       # fail fast rather than queue indefinitely
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with async_session() as session:
        yield session

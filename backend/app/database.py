from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlmodel import SQLModel
from app.config import get_settings

settings = get_settings()

# asyncpg uses "ssl" not "sslmode"
_db_url = settings.DATABASE_URL.replace("sslmode=", "ssl=")

engine = create_async_engine(
    _db_url,
    echo=settings.APP_DEBUG,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with async_session() as session:
        yield session

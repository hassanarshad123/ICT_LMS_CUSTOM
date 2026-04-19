import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

from alembic import context

# Import all models so SQLModel.metadata is populated
import app.models  # noqa: F401

from app.config import get_settings

settings = get_settings()
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

# Use direct (non-pooled) URL for migrations
# asyncpg uses "ssl" not "sslmode", so convert if needed
db_url = settings.DATABASE_URL_DIRECT or settings.DATABASE_URL
db_url = db_url.replace("sslmode=", "ssl=")
config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    # transaction_per_migration=True: start a fresh transaction for each
    # migration file instead of wrapping all pending migrations in one big
    # transaction. Required when a later migration uses DDL committed by an
    # earlier one in the same `alembic upgrade` run — notably
    # `ALTER TYPE ... ADD VALUE` followed by a row update using that new
    # enum value. Postgres forbids using a just-added enum value in the
    # same transaction, so we need the ADD VALUE migration to commit
    # before the consuming migration begins.
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        transaction_per_migration=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

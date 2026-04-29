from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_db_url = settings.DATABASE_URL
# Supabase and most managed Postgres providers require SSL.
# asyncpg reads the ssl= parameter from the URL directly.
if "supabase" in _db_url and "ssl=" not in _db_url:
    _db_url += ("&" if "?" in _db_url else "?") + "ssl=require"

engine = create_async_engine(
    _db_url,
    echo=settings.ENVIRONMENT == "development",
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

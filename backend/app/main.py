from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import AsyncSessionLocal, engine, Base
from app.utils.scheduler import start_scheduler, stop_scheduler


async def bootstrap_admin():
    """Create admin employee if none exists"""
    from sqlalchemy import select
    from app.models.employee import Employee

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Employee).where(Employee.role == "admin"))
        if not result.scalar_one_or_none():
            admin = Employee(
                name=settings.ADMIN_NAME,
                phone=settings.ADMIN_PHONE,
                role="admin",
                designation="System Administrator",
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            print(f"[Bootstrap] Admin created: {settings.ADMIN_PHONE}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await bootstrap_admin()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
    await engine.dispose()


app = FastAPI(
    title="Backero COS API",
    version="1.0.0",
    description="Company Operating System for Backero Cosmetics",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "backero-cos-api"}

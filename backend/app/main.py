import re
import uvicorn
import logging
import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

# Ensure 'app' is in path regardless of CWD
current_dir = Path(__file__).resolve().parent
if current_dir.name == "app":
    sys.path.append(str(current_dir.parent))

# Current project imports
from app.api.v1.router import api_router
from app.api.v1.roles.model import Role, RoleModulePermission  # noqa: F401 — registers models with Base
from app.models.task import TaskComment, TaskChecklistItem, TaskTimeLog  # noqa: F401
from app.models.activity_log import ActivityLog  # noqa: F401
from app.models.activity_log_archive import ActivityLogArchive  # noqa: F401
from app.models.payroll import PayrollRecord  # noqa: F401
from app.models.finance import Customer  # noqa: F401
from app.models.employee import AttendanceRegularization  # noqa: F401
from app.core.config import settings
from app.db.init_db import init_db
from app.db.session import Base, engine
from app.utils.scheduler import start_scheduler, stop_scheduler

# Simple logger
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown events."""
    print("Starting server — setting up database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("Seeding initial data...")
    await init_db()

    print("Starting scheduler...")
    start_scheduler()
    
    yield
    
    print("Shutting down...")
    stop_scheduler()
    await engine.dispose()

app = FastAPI(
    title="Backero COS API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None
)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Convert SQLAlchemy unique/FK violations into readable 409 responses."""
    err = str(exc.orig)

    # asyncpg unique violation: Key (col)=(val) already exists.
    match = re.search(r'Key \((.+?)\)=\((.+?)\) already exists', err)
    if match:
        field, value = match.group(1), match.group(2)
        field_label = field.replace("_", " ").capitalize()
        return JSONResponse(
            status_code=409,
            content={"detail": f"{field_label} '{value}' is already taken.", "field": field},
        )

    # FK violation
    if "foreign key" in err.lower() or "violates foreign key" in err.lower():
        return JSONResponse(
            status_code=400,
            content={"detail": "Referenced record does not exist.", "field": None},
        )

    return JSONResponse(
        status_code=409,
        content={"detail": "A record with these details already exists.", "field": None},
    )


# Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Field"],
)

# Unified router inclusion
app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

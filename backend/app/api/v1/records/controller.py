from typing import Optional

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import PaginatedResponse
from app.core.dependencies import SuperAdminUser
from app.db.session import get_db

from . import service
from .schema import ActivityLogResponse, RestoreResponse


async def list_records(
    entity_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: SuperAdminUser = None,
) -> PaginatedResponse[ActivityLogResponse]:
    return await service.list_records(db, entity_type=entity_type, action=action, page=page, limit=limit)


async def restore_record(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    _: SuperAdminUser = None,
) -> RestoreResponse:
    return await service.restore_record(db, log_id)

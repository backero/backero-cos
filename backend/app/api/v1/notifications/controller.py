from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db.session import get_db

from . import service
from .schema import NotificationResponse


async def list_notifications(
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[NotificationResponse]:
    return await service.list_notifications(db, current_user.id, unread_only)


async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> dict:
    count = await service.unread_count(db, current_user.id)
    return {"count": count}


async def mark_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> dict:
    await service.mark_read(db, notification_id, current_user.id)
    return {"message": "Marked as read"}


async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> dict:
    return await service.mark_all_read(db, current_user.id)

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Notification

from .schema import NotificationResponse


async def list_notifications(
    db: AsyncSession, recipient_id: uuid.UUID, unread_only: bool = False
) -> list[NotificationResponse]:
    query = (
        select(Notification)
        .where(Notification.recipient_id == recipient_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    if unread_only:
        query = query.where(Notification.is_read == False)
    result = await db.execute(query)
    return [NotificationResponse.model_validate(n) for n in result.scalars()]


async def mark_read(
    db: AsyncSession, notification_id: str, recipient_id: uuid.UUID
) -> NotificationResponse:
    result = await db.execute(
        select(Notification).where(
            Notification.id == uuid.UUID(notification_id),
            Notification.recipient_id == recipient_id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
    return NotificationResponse.model_validate(notif) if notif else None


async def mark_all_read(db: AsyncSession, recipient_id: uuid.UUID) -> dict:
    await db.execute(
        update(Notification)
        .where(Notification.recipient_id == recipient_id, Notification.is_read == False)
        .values(is_read=True)
    )
    return {"message": "All notifications marked as read"}


async def unread_count(db: AsyncSession, recipient_id: uuid.UUID) -> int:
    result = await db.execute(
        select(Notification).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read == False,
        )
    )
    return len(result.scalars().all())

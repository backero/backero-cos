"""Central helper to write activity log entries."""
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog


async def log(
    db: AsyncSession,
    *,
    actor_id: Optional[uuid.UUID],
    actor_name: str,
    action: str,
    entity_type: str,
    description: str,
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    deleted_data: Optional[dict] = None,
    is_deleted: bool = False,
) -> None:
    entry = ActivityLog(
        actor_id=actor_id,
        actor_name=actor_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        description=description,
        deleted_data=deleted_data,
        is_deleted=is_deleted,
    )
    db.add(entry)

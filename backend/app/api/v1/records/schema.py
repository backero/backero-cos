from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    actor_id: Optional[UUID] = None
    actor_name: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    description: str
    is_deleted: bool


class RestoreResponse(BaseModel):
    message: str
    entity_type: str
    entity_name: Optional[str] = None

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[str] = None
    department_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[str] = None


class ExtensionRequest(BaseModel):
    reason: str
    days: int


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assigned_to_id: Optional[UUID] = None
    created_by_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    extension_requested: bool
    extension_reason: Optional[str] = None
    extension_days: Optional[int] = None
    created_at: datetime


class ComplianceTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    description: Optional[str] = None
    due_date: datetime
    recurrence: Optional[str] = None
    is_completed: bool
    completed_at: Optional[datetime] = None
    category: Optional[str] = None

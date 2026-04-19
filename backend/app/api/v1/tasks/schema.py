from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Assignee/Reporter preview ─────────────────────────────────────────────────

class EmployeePreview(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    avatar_url: Optional[str] = None
    designation: Optional[str] = None


# ── Task ──────────────────────────────────────────────────────────────────────

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


class TaskStatusUpdate(BaseModel):
    status: str


class ExtensionRequest(BaseModel):
    reason: str
    days: int


class TaskCommentCreate(BaseModel):
    content: str


class TaskCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    task_id: UUID
    author_id: UUID
    content: str
    created_at: datetime
    author: Optional[EmployeePreview] = None


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
    updated_at: datetime
    assigned_to: Optional[EmployeePreview] = None
    created_by: Optional[EmployeePreview] = None
    comments: list[TaskCommentResponse] = []
    comments_count: int = 0

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        instance.comments_count = len(instance.comments)
        return instance


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

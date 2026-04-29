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
    depends_on_task_id: Optional[str] = None
    recurrence_type: str = "none"
    recurrence_day: Optional[int] = None
    recurrence_end_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[str] = None
    depends_on_task_id: Optional[str] = None
    recurrence_type: Optional[str] = None
    recurrence_day: Optional[int] = None
    recurrence_end_date: Optional[datetime] = None


class TaskMoveBody(BaseModel):
    status: str
    position: int


class ExtensionRequest(BaseModel):
    reason: str
    days: int


class CompletionSubmit(BaseModel):
    note: Optional[str] = None


class TaskReject(BaseModel):
    note: Optional[str] = None


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
    assigned_to_name: Optional[str] = None
    department_name: Optional[str] = None
    created_by_name: Optional[str] = None
    extension_requested: bool
    extension_reason: Optional[str] = None
    extension_days: Optional[int] = None
    completion_note: Optional[str] = None
    completion_submitted_at: Optional[datetime] = None
    created_at: datetime
    position: int = 0
    depends_on_task_id: Optional[UUID] = None
    recurrence_type: str = "none"
    recurrence_day: Optional[int] = None
    recurrence_end_date: Optional[datetime] = None
    parent_task_id: Optional[UUID] = None
    total_minutes: int = 0
    checklist_total: int = 0
    checklist_done: int = 0


class TaskCommentCreate(BaseModel):
    message: str


class TaskCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    task_id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    employee_role: Optional[str] = None
    message: str
    created_at: datetime


class TaskAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    task_id: UUID
    uploaded_by_id: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None
    filename: str
    file_type: str
    file_size: int
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


# ── Checklist ─────────────────────────────────────────────────────────────────

class ChecklistItemCreate(BaseModel):
    text: str
    position: int = 0


class ChecklistItemUpdate(BaseModel):
    text: Optional[str] = None
    is_done: Optional[bool] = None
    position: Optional[int] = None


class ChecklistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    task_id: UUID
    text: str
    is_done: bool
    position: int
    created_at: datetime


# ── Time Logs ─────────────────────────────────────────────────────────────────

class TimeLogCreate(BaseModel):
    started_at: datetime
    ended_at: Optional[datetime] = None
    minutes: Optional[int] = None
    note: Optional[str] = None


class TimeLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    task_id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    minutes: Optional[int] = None
    note: Optional[str] = None
    created_at: datetime

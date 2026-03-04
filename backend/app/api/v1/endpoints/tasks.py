import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db
from app.models.task import ComplianceTask, Task

router = APIRouter()


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


@router.get("/")
async def list_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(Task)
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    if assigned_to_id:
        query = query.where(Task.assigned_to_id == uuid.UUID(assigned_to_id))
    elif current_user.role == "employee":
        query = query.where(Task.assigned_to_id == current_user.id)
    if department_id:
        query = query.where(Task.department_id == uuid.UUID(department_id))
    query = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
    result = await db.execute(query)
    return [_task_dict(t) for t in result.scalars()]


@router.post("/")
async def create_task(body: TaskCreate, current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    task = Task(
        title=body.title,
        description=body.description,
        priority=body.priority,
        due_date=body.due_date,
        assigned_to_id=uuid.UUID(body.assigned_to_id) if body.assigned_to_id else None,
        department_id=uuid.UUID(body.department_id) if body.department_id else None,
        created_by_id=current_user.id,
        status="pending",
    )
    db.add(task)
    await db.flush()
    return _task_dict(task)


@router.patch("/{task_id}")
async def update_task(task_id: str, body: TaskUpdate, current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "assigned_to_id" and value:
            value = uuid.UUID(value)
        setattr(task, field, value)

    return _task_dict(task)


@router.post("/{task_id}/complete")
async def complete_task(task_id: str, current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    return _task_dict(task)


@router.post("/{task_id}/request-extension")
async def request_extension(task_id: str, body: ExtensionRequest, current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.extension_requested = True
    task.extension_reason = body.reason
    task.extension_days = body.days
    return _task_dict(task)


@router.delete("/{task_id}")
async def delete_task(task_id: str, current_user: ManagerUser = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    return {"message": "Task deleted"}


# ---------- Compliance Tasks ----------

@router.get("/compliance")
async def list_compliance_tasks(db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    result = await db.execute(select(ComplianceTask).order_by(ComplianceTask.due_date.asc()))
    return [_compliance_dict(t) for t in result.scalars()]


def _task_dict(task: Task) -> dict:
    return {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
        "created_by_id": str(task.created_by_id) if task.created_by_id else None,
        "department_id": str(task.department_id) if task.department_id else None,
        "extension_requested": task.extension_requested,
        "extension_reason": task.extension_reason,
        "extension_days": task.extension_days,
        "created_at": task.created_at.isoformat(),
    }


def _compliance_dict(task: ComplianceTask) -> dict:
    return {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date.isoformat(),
        "recurrence": task.recurrence,
        "is_completed": task.is_completed,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "category": task.category,
    }

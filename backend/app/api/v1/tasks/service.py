import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import ComplianceTask, Task
from .schema import (
    ComplianceTaskResponse,
    ExtensionRequest,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)


async def list_tasks(
    db: AsyncSession,
    current_user_id: uuid.UUID,
    current_user_role: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to_id: Optional[str] = None,
    department_id: Optional[str] = None,
) -> list[TaskResponse]:
    query = select(Task)
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    if assigned_to_id:
        query = query.where(Task.assigned_to_id == uuid.UUID(assigned_to_id))
    elif current_user_role == "employee":
        query = query.where(Task.assigned_to_id == current_user_id)
    if department_id:
        query = query.where(Task.department_id == uuid.UUID(department_id))
    query = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
    result = await db.execute(query)
    return [TaskResponse.model_validate(t) for t in result.scalars()]


async def create_task(
    db: AsyncSession, body: TaskCreate, created_by_id: uuid.UUID
) -> TaskResponse:
    task = Task(
        title=body.title,
        description=body.description,
        priority=body.priority,
        due_date=body.due_date,
        assigned_to_id=uuid.UUID(body.assigned_to_id) if body.assigned_to_id else None,
        department_id=uuid.UUID(body.department_id) if body.department_id else None,
        created_by_id=created_by_id,
        status="pending",
    )
    db.add(task)
    await db.flush()
    return TaskResponse.model_validate(task)


async def update_task(
    db: AsyncSession, task_id: str, body: TaskUpdate
) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "assigned_to_id" and value:
            value = uuid.UUID(value)
        setattr(task, field, value)

    return TaskResponse.model_validate(task)


async def complete_task(db: AsyncSession, task_id: str) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    return TaskResponse.model_validate(task)


async def request_extension(
    db: AsyncSession, task_id: str, body: ExtensionRequest
) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.extension_requested = True
    task.extension_reason = body.reason
    task.extension_days = body.days
    return TaskResponse.model_validate(task)


async def delete_task(db: AsyncSession, task_id: str) -> None:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)


async def list_compliance_tasks(db: AsyncSession) -> list[ComplianceTaskResponse]:
    result = await db.execute(select(ComplianceTask).order_by(ComplianceTask.due_date.asc()))
    return [ComplianceTaskResponse.model_validate(t) for t in result.scalars()]

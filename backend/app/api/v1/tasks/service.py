import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employee import Employee
from app.models.task import ComplianceTask, Notification, Task, TaskComment
from app.utils.notifications import send_whatsapp_message

from .schema import (
    ComplianceTaskResponse,
    ExtensionRequest,
    TaskCommentCreate,
    TaskCommentResponse,
    TaskCreate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)

VALID_STATUSES = {"todo", "in_progress", "review", "done", "overdue"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}


def _task_query():
    return select(Task).options(
        selectinload(Task.assigned_to),
        selectinload(Task.created_by),
        selectinload(Task.comments).selectinload(TaskComment.author),
    )


async def _create_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    task_id: Optional[uuid.UUID] = None,
):
    notif = Notification(
        recipient_id=recipient_id,
        type=type,
        title=title,
        message=message,
        task_id=task_id,
    )
    db.add(notif)


async def list_tasks(
    db: AsyncSession,
    current_user_id: uuid.UUID,
    current_user_role: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to_id: Optional[str] = None,
    department_id: Optional[str] = None,
    search: Optional[str] = None,
) -> list[TaskResponse]:
    query = _task_query()
    if status:
        # support legacy 'pending' → 'todo', 'completed' → 'done'
        mapped = {"pending": "todo", "completed": "done"}.get(status, status)
        query = query.where(Task.status == mapped)
    if priority:
        query = query.where(Task.priority == priority)
    if assigned_to_id:
        query = query.where(Task.assigned_to_id == uuid.UUID(assigned_to_id))
    elif current_user_role == "employee":
        query = query.where(Task.assigned_to_id == current_user_id)
    if department_id:
        query = query.where(Task.department_id == uuid.UUID(department_id))
    if search:
        query = query.where(Task.title.ilike(f"%{search}%"))
    query = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
    result = await db.execute(query)
    return [TaskResponse.model_validate(t) for t in result.scalars()]


async def get_task(db: AsyncSession, task_id: str) -> TaskResponse:
    result = await db.execute(
        _task_query().where(Task.id == uuid.UUID(task_id))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


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
        status="todo",
    )
    db.add(task)
    await db.flush()

    # notify assignee
    if task.assigned_to_id and task.assigned_to_id != created_by_id:
        reporter_result = await db.execute(
            select(Employee).where(Employee.id == created_by_id)
        )
        reporter = reporter_result.scalar_one_or_none()
        reporter_name = reporter.name if reporter else "Someone"
        await _create_notification(
            db,
            recipient_id=task.assigned_to_id,
            type="task_assigned",
            title="New Task Assigned",
            message=f'{reporter_name} assigned you "{task.title}"',
            task_id=task.id,
        )
        # WhatsApp alert to assignee
        assignee_result = await db.execute(select(Employee).where(Employee.id == task.assigned_to_id))
        assignee = assignee_result.scalar_one_or_none()
        if assignee:
            due_str = task.due_date.strftime("%d %b %Y") if task.due_date else "No due date"
            await send_whatsapp_message(
                assignee.phone,
                f"Hi {assignee.name}, {reporter_name} assigned you a new task: '{task.title}'. Due: {due_str}.",
                template_name="task_assigned",
            )

    await db.refresh(task)
    result = await db.execute(_task_query().where(Task.id == task.id))
    return TaskResponse.model_validate(result.scalar_one())


async def update_task(
    db: AsyncSession, task_id: str, body: TaskUpdate, current_user_id: uuid.UUID
) -> TaskResponse:
    result = await db.execute(_task_query().where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    old_assignee = task.assigned_to_id

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "assigned_to_id" and value:
            value = uuid.UUID(value)
        setattr(task, field, value)

    # if status changed to done
    if body.status == "done" and old_status != "done":
        task.completed_at = datetime.now(timezone.utc)

    await db.flush()

    # notify on reassignment
    if body.assigned_to_id and task.assigned_to_id != old_assignee:
        reporter_result = await db.execute(
            select(Employee).where(Employee.id == current_user_id)
        )
        reporter = reporter_result.scalar_one_or_none()
        reporter_name = reporter.name if reporter else "Someone"
        await _create_notification(
            db,
            recipient_id=task.assigned_to_id,
            type="task_assigned",
            title="Task Reassigned",
            message=f'{reporter_name} assigned you "{task.title}"',
            task_id=task.id,
        )
        # WhatsApp alert on reassignment
        assignee_result = await db.execute(select(Employee).where(Employee.id == task.assigned_to_id))
        assignee = assignee_result.scalar_one_or_none()
        if assignee:
            due_str = task.due_date.strftime("%d %b %Y") if task.due_date else "No due date"
            await send_whatsapp_message(
                assignee.phone,
                f"Hi {assignee.name}, you have been assigned the task: '{task.title}'. Due: {due_str}.",
                template_name="task_assigned",
            )

    # notify reporter on status change
    if body.status and body.status != old_status and task.created_by_id and task.created_by_id != current_user_id:
        await _create_notification(
            db,
            recipient_id=task.created_by_id,
            type="status_changed",
            title="Task Status Updated",
            message=f'"{task.title}" moved to {body.status.replace("_", " ").title()}',
            task_id=task.id,
        )

    result = await db.execute(_task_query().where(Task.id == task.id))
    return TaskResponse.model_validate(result.scalar_one())


async def update_task_status(
    db: AsyncSession, task_id: str, body: TaskStatusUpdate, current_user_id: uuid.UUID
) -> TaskResponse:
    mapped_status = body.status
    if mapped_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
    return await update_task(
        db, task_id, TaskUpdate(status=mapped_status), current_user_id
    )


async def complete_task(db: AsyncSession, task_id: str) -> TaskResponse:
    result = await db.execute(_task_query().where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "done"
    task.completed_at = datetime.now(timezone.utc)
    result = await db.execute(_task_query().where(Task.id == task.id))
    return TaskResponse.model_validate(result.scalar_one())


async def request_extension(
    db: AsyncSession, task_id: str, body: ExtensionRequest
) -> TaskResponse:
    result = await db.execute(_task_query().where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.extension_requested = True
    task.extension_reason = body.reason
    task.extension_days = body.days
    result = await db.execute(_task_query().where(Task.id == task.id))
    return TaskResponse.model_validate(result.scalar_one())


async def delete_task(db: AsyncSession, task_id: str) -> None:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)


# ── Comments ─────────────────────────────────────────────────────────────────

async def add_comment(
    db: AsyncSession, task_id: str, body: TaskCommentCreate, author_id: uuid.UUID
) -> TaskCommentResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    comment = TaskComment(
        task_id=uuid.UUID(task_id),
        author_id=author_id,
        content=body.content,
    )
    db.add(comment)
    await db.flush()

    # notify task owner
    if task.created_by_id and task.created_by_id != author_id:
        author_result = await db.execute(
            select(Employee).where(Employee.id == author_id)
        )
        author = author_result.scalar_one_or_none()
        await _create_notification(
            db,
            recipient_id=task.created_by_id,
            type="comment_added",
            title="New Comment",
            message=f'{author.name if author else "Someone"} commented on "{task.title}"',
            task_id=task.id,
        )
    # notify assignee if different from author and reporter
    if task.assigned_to_id and task.assigned_to_id != author_id and task.assigned_to_id != task.created_by_id:
        author_result = await db.execute(
            select(Employee).where(Employee.id == author_id)
        )
        author = author_result.scalar_one_or_none()
        await _create_notification(
            db,
            recipient_id=task.assigned_to_id,
            type="comment_added",
            title="New Comment",
            message=f'{author.name if author else "Someone"} commented on "{task.title}"',
            task_id=task.id,
        )

    await db.refresh(comment)
    result2 = await db.execute(
        select(TaskComment)
        .options(selectinload(TaskComment.author))
        .where(TaskComment.id == comment.id)
    )
    return TaskCommentResponse.model_validate(result2.scalar_one())


async def list_compliance_tasks(db: AsyncSession) -> list[ComplianceTaskResponse]:
    result = await db.execute(select(ComplianceTask).order_by(ComplianceTask.due_date.asc()))
    return [ComplianceTaskResponse.model_validate(t) for t in result.scalars()]

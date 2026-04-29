import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.schemas import PaginatedResponse

from app.utils.notifications import (
    send_whatsapp_message,
    build_task_assigned_message,
    build_task_submitted_message,
    build_task_approved_message,
    build_task_rejected_message,
)
from .model import ComplianceTask, Task
from app.models.task import TaskChecklistItem, TaskComment, TaskTimeLog
from .schema import (
    ChecklistItemCreate,
    ChecklistItemResponse,
    ChecklistItemUpdate,
    CompletionSubmit,
    ComplianceTaskResponse,
    ExtensionRequest,
    TaskCommentCreate,
    TaskCommentResponse,
    TaskCreate,
    TaskMoveBody,
    TaskReject,
    TaskResponse,
    TaskUpdate,
    TimeLogCreate,
    TimeLogResponse,
)


async def list_tasks(
    db: AsyncSession,
    current_user_id: uuid.UUID,
    current_user_role: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to_id: Optional[str] = None,
    department_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> PaginatedResponse[TaskResponse]:
    query = select(Task).options(selectinload(Task.assigned_to), selectinload(Task.department), selectinload(Task.created_by))
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    if assigned_to_id:
        query = query.where(Task.assigned_to_id == uuid.UUID(assigned_to_id))
    else:
        role_lower = current_user_role.lower()
        is_super_admin_or_admin = role_lower == "super admin" or role_lower == "admin"
        is_manager = "manager" in role_lower
        if is_super_admin_or_admin:
            pass
        elif is_manager:
            query = query.where(
                or_(Task.created_by_id == current_user_id, Task.assigned_to_id == current_user_id)
            )
        else:
            query = query.where(Task.assigned_to_id == current_user_id)
    if department_id:
        query = query.where(Task.department_id == uuid.UUID(department_id))
    if search:
        term = f"%{search}%"
        query = query.where(Task.title.ilike(term))

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    items = [TaskResponse.model_validate(t) for t in result.scalars()]
    return PaginatedResponse.build(items, total, page, limit)


async def create_task(
    db: AsyncSession, body: TaskCreate, created_by_id: uuid.UUID, creator_name: str = "Manager"
) -> TaskResponse:
    from app.utils.activity import log as activity_log
    task = Task(
        title=body.title,
        description=body.description,
        priority=body.priority,
        due_date=body.due_date,
        assigned_to_id=uuid.UUID(body.assigned_to_id) if body.assigned_to_id else None,
        department_id=uuid.UUID(body.department_id) if body.department_id else None,
        created_by_id=created_by_id,
        status="pending",
        depends_on_task_id=uuid.UUID(body.depends_on_task_id) if body.depends_on_task_id else None,
        recurrence_type=body.recurrence_type or "none",
        recurrence_day=body.recurrence_day,
        recurrence_end_date=body.recurrence_end_date,
    )
    db.add(task)
    await db.flush()
    await _notify_task_assignment(db, task)
    await db.refresh(task, ["assigned_to", "department", "created_by"])

    assignee = task.assigned_to.name if task.assigned_to else "Unassigned"
    await activity_log(
        db,
        actor_id=created_by_id,
        actor_name=creator_name,
        action="create",
        entity_type="task",
        entity_id=str(task.id),
        entity_name=task.title,
        description=f"{creator_name} created task '{task.title}' and assigned it to {assignee}",
    )
    return TaskResponse.model_validate(task)


async def _get_employee(db: AsyncSession, emp_id: uuid.UUID):
    from app.models.employee import Employee
    result = await db.execute(select(Employee).where(Employee.id == emp_id))
    return result.scalar_one_or_none()


async def _get_dept_manager(db: AsyncSession, department_id: uuid.UUID):
    """Return the first active employee in the department whose role name contains 'manager'."""
    from app.models.employee import Employee
    result = await db.execute(
        select(Employee).where(
            Employee.department_id == department_id,
            Employee.is_active == True,
        )
    )
    employees = result.scalars().all()
    for emp in employees:
        if "manager" in (emp.role or "").lower():
            return emp
    return None


async def _notify_task_assignment(db: AsyncSession, task: Task) -> None:
    if not task.assigned_to_id:
        return

    emp = await _get_employee(db, task.assigned_to_id)
    if not emp:
        return

    # Resolve creator name
    creator_name = "Manager"
    creator = None
    if task.created_by_id:
        creator = await _get_employee(db, task.created_by_id)
        if creator:
            creator_name = creator.name

    # Rich message to the assignee
    msg_to_assignee = build_task_assigned_message(
        task_title=task.title,
        priority=task.priority,
        due_date=task.due_date,
        assigned_by=creator_name,
        description=task.description,
    )
    await send_whatsapp_message(emp.phone, msg_to_assignee)
    notified_phones = {emp.phone}

    # Notify task creator (confirmation)
    if creator and creator.phone not in notified_phones:
        await send_whatsapp_message(
            creator.phone,
            f"📋 Task *{task.title}* has been assigned to *{emp.name}*.\nPriority: {task.priority.capitalize()} | Due: {task.due_date.strftime('%d %b %Y').lstrip('0') if task.due_date else 'No deadline'}",
        )
        notified_phones.add(creator.phone)

    # Notify department manager
    if emp.department_id:
        dept_manager = await _get_dept_manager(db, emp.department_id)
        if dept_manager and dept_manager.phone not in notified_phones:
            await send_whatsapp_message(
                dept_manager.phone,
                f"📋 Task *{task.title}* assigned to *{emp.name}* in your department.\nPriority: {task.priority.capitalize()} | Due: {task.due_date.strftime('%d %b %Y').lstrip('0') if task.due_date else 'No deadline'}",
            )
            notified_phones.add(dept_manager.phone)


async def update_task(
    db: AsyncSession,
    task_id: str,
    body: TaskUpdate,
    current_user_id: uuid.UUID,
    current_user_role: str,
) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    role_lower = current_user_role.lower()
    is_manager_or_above = "manager" in role_lower or "admin" in role_lower

    if not is_manager_or_above:
        # Employees can only update their own assigned task's status, and not to "completed"
        if task.assigned_to_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only update tasks assigned to you")
        allowed = body.model_dump(include={"status"}, exclude_none=True)
        if "status" in allowed and allowed["status"] == "completed":
            raise HTTPException(status_code=403, detail="Use submit-completion to request task completion")
        body = TaskUpdate(**allowed)

    original_assigned_to_id = task.assigned_to_id
    assigned_changed = False

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "assigned_to_id":
            if value:
                value = uuid.UUID(value)
            if value != original_assigned_to_id:
                assigned_changed = True
        setattr(task, field, value)

    if assigned_changed and task.assigned_to_id:
        await _notify_task_assignment(db, task)

    await db.refresh(task, ["assigned_to", "department", "created_by"])
    return TaskResponse.model_validate(task)


async def complete_task(db: AsyncSession, task_id: str) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    await db.refresh(task, ["assigned_to", "department", "created_by"])
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
    await db.refresh(task, ["assigned_to", "department", "created_by"])
    await db.refresh(task, ["assigned_to", "department", "created_by"])
    return TaskResponse.model_validate(task)


async def submit_completion(
    db: AsyncSession, task_id: str, body: CompletionSubmit, current_user_id: uuid.UUID
) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.assigned_to_id != current_user_id:
        raise HTTPException(status_code=403, detail="Only the assigned employee can submit completion")

    # Enforce checklist completion
    checklist_result = await db.execute(
        select(TaskChecklistItem).where(
            TaskChecklistItem.task_id == uuid.UUID(task_id),
            TaskChecklistItem.is_done == False,
        )
    )
    pending_items = checklist_result.scalars().all()
    if pending_items:
        raise HTTPException(status_code=400, detail=f"Complete all {len(pending_items)} checklist item(s) before submitting")

    task.status = "pending_approval"
    task.completion_note = body.note
    task.completion_submitted_at = datetime.now(timezone.utc)
    await db.flush()

    # Notify task creator / manager
    notified_phones: set[str] = set()
    emp = await _get_employee(db, current_user_id)
    emp_name = emp.name if emp else "Employee"

    if task.created_by_id and task.created_by_id != current_user_id:
        creator = await _get_employee(db, task.created_by_id)
        if creator:
            await send_whatsapp_message(
                creator.phone,
                build_task_submitted_message(task.title, emp_name, body.note),
            )
            notified_phones.add(creator.phone)

    # Also notify department manager if different
    if emp and emp.department_id:
        dept_manager = await _get_dept_manager(db, emp.department_id)
        if dept_manager and dept_manager.phone not in notified_phones:
            await send_whatsapp_message(
                dept_manager.phone,
                build_task_submitted_message(task.title, emp_name, body.note),
            )

    await db.refresh(task, ["assigned_to", "department", "created_by"])
    return TaskResponse.model_validate(task)


async def approve_task(
    db: AsyncSession, task_id: str, current_user_id: uuid.UUID, current_user_role: str
) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    role_lower = current_user_role.lower()
    is_admin_or_above = role_lower in ("admin", "super admin")
    is_creator = task.created_by_id == current_user_id
    if not is_creator and not is_admin_or_above:
        raise HTTPException(status_code=403, detail="Only the task creator or an admin can approve tasks")

    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    await db.flush()
    await _spawn_recurring_task(db, task)

    if task.assigned_to_id:
        emp = await _get_employee(db, task.assigned_to_id)
        if emp:
            approver = await _get_employee(db, current_user_id)
            approver_name = approver.name if approver else "Manager"
            await send_whatsapp_message(emp.phone, build_task_approved_message(task.title, approver_name))

    from app.utils.activity import log as activity_log
    await activity_log(
        db, actor_id=current_user_id, actor_name=current_user_role,
        action="approve", entity_type="task", entity_id=task_id,
        entity_name=task.title,
        description=f"Task '{task.title}' was approved and marked completed",
    )
    await db.refresh(task, ["assigned_to", "department", "created_by"])
    return TaskResponse.model_validate(task)


async def reject_task(
    db: AsyncSession, task_id: str, body: TaskReject, current_user_id: uuid.UUID, current_user_role: str
) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    role_lower = current_user_role.lower()
    is_admin_or_above = role_lower in ("admin", "super admin")
    is_creator = task.created_by_id == current_user_id
    if not is_creator and not is_admin_or_above:
        raise HTTPException(status_code=403, detail="Only the task creator or an admin can reject tasks")

    task.status = "in_progress"
    task.completion_note = None
    task.completion_submitted_at = None
    await db.flush()

    if task.assigned_to_id:
        emp = await _get_employee(db, task.assigned_to_id)
        if emp:
            await send_whatsapp_message(emp.phone, build_task_rejected_message(task.title, body.note))

    await db.refresh(task, ["assigned_to", "department", "created_by"])
    return TaskResponse.model_validate(task)


async def delete_task(db: AsyncSession, task_id: str, actor_id: uuid.UUID | None = None, actor_name: str = "Manager") -> None:
    from app.utils.activity import log as activity_log
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    snapshot = {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
        "created_by_id": str(task.created_by_id) if task.created_by_id else None,
        "department_id": str(task.department_id) if task.department_id else None,
    }
    await activity_log(
        db,
        actor_id=actor_id,
        actor_name=actor_name,
        action="delete",
        entity_type="task",
        entity_id=task_id,
        entity_name=task.title,
        description=f"{actor_name} deleted task '{task.title}'",
        deleted_data=snapshot,
        is_deleted=True,
    )
    await db.delete(task)


async def list_compliance_tasks(db: AsyncSession) -> list[ComplianceTaskResponse]:
    result = await db.execute(select(ComplianceTask).order_by(ComplianceTask.due_date.asc()))
    return [ComplianceTaskResponse.model_validate(t) for t in result.scalars()]


# ── Kanban move ───────────────────────────────────────────────────────────────

async def move_task(
    db: AsyncSession,
    task_id: str,
    body: TaskMoveBody,
    current_user_id: uuid.UUID,
    current_user_role: str,
) -> TaskResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    role_lower = current_user_role.lower()
    is_manager_or_above = "manager" in role_lower or "admin" in role_lower
    if not is_manager_or_above and task.assigned_to_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Dependency check: can't move to in_progress if blocker not completed
    if body.status == "in_progress" and task.depends_on_task_id:
        dep_result = await db.execute(select(Task).where(Task.id == task.depends_on_task_id))
        dep = dep_result.scalar_one_or_none()
        if dep and dep.status != "completed":
            raise HTTPException(status_code=400, detail=f"Dependency task '{dep.title}' must be completed first")

    task.status = body.status
    task.position = body.position
    await db.refresh(task, ["assigned_to", "department", "created_by"])
    return TaskResponse.model_validate(task)


# ── Recurring task helper ─────────────────────────────────────────────────────

async def _spawn_recurring_task(db: AsyncSession, source: Task) -> None:
    from datetime import timedelta
    if source.recurrence_type == "none" or not source.recurrence_type:
        return
    now = datetime.now(timezone.utc)
    if source.recurrence_end_date and now > source.recurrence_end_date:
        return

    next_due = source.due_date
    if next_due:
        if source.recurrence_type == "daily":
            next_due = next_due + timedelta(days=1)
        elif source.recurrence_type == "weekly":
            next_due = next_due + timedelta(weeks=1)
        elif source.recurrence_type == "monthly":
            import calendar
            month = next_due.month % 12 + 1
            year = next_due.year + (1 if next_due.month == 12 else 0)
            day = min(next_due.day, calendar.monthrange(year, month)[1])
            next_due = next_due.replace(year=year, month=month, day=day)

    new_task = Task(
        title=source.title,
        description=source.description,
        priority=source.priority,
        assigned_to_id=source.assigned_to_id,
        department_id=source.department_id,
        created_by_id=source.created_by_id,
        status="pending",
        due_date=next_due,
        recurrence_type=source.recurrence_type,
        recurrence_day=source.recurrence_day,
        recurrence_end_date=source.recurrence_end_date,
        parent_task_id=source.id,
    )
    db.add(new_task)
    await db.flush()


# ── Checklist ─────────────────────────────────────────────────────────────────

async def list_checklist(db: AsyncSession, task_id: str) -> list[ChecklistItemResponse]:
    result = await db.execute(
        select(TaskChecklistItem)
        .where(TaskChecklistItem.task_id == uuid.UUID(task_id))
        .order_by(TaskChecklistItem.position.asc())
    )
    return [ChecklistItemResponse.model_validate(i) for i in result.scalars()]


async def add_checklist_item(
    db: AsyncSession, task_id: str, body: ChecklistItemCreate
) -> ChecklistItemResponse:
    item = TaskChecklistItem(
        task_id=uuid.UUID(task_id),
        text=body.text,
        position=body.position,
        is_done=False,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return ChecklistItemResponse.model_validate(item)


async def update_checklist_item(
    db: AsyncSession, task_id: str, item_id: str, body: ChecklistItemUpdate
) -> ChecklistItemResponse:
    result = await db.execute(
        select(TaskChecklistItem).where(
            TaskChecklistItem.id == uuid.UUID(item_id),
            TaskChecklistItem.task_id == uuid.UUID(task_id),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.flush()
    await db.refresh(item)
    return ChecklistItemResponse.model_validate(item)


async def delete_checklist_item(db: AsyncSession, task_id: str, item_id: str) -> None:
    result = await db.execute(
        select(TaskChecklistItem).where(
            TaskChecklistItem.id == uuid.UUID(item_id),
            TaskChecklistItem.task_id == uuid.UUID(task_id),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    await db.delete(item)


# ── Time Logs ─────────────────────────────────────────────────────────────────

async def create_time_log(
    db: AsyncSession, task_id: str, body: TimeLogCreate, employee_id: uuid.UUID
) -> TimeLogResponse:
    from sqlalchemy.orm import selectinload as sil
    minutes = body.minutes
    if minutes is None and body.started_at and body.ended_at:
        delta = body.ended_at - body.started_at
        minutes = max(0, int(delta.total_seconds() / 60))

    log = TaskTimeLog(
        task_id=uuid.UUID(task_id),
        employee_id=employee_id,
        started_at=body.started_at,
        ended_at=body.ended_at,
        minutes=minutes,
        note=body.note,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log, ["employee"])
    return TimeLogResponse.model_validate(log)


async def list_time_logs(db: AsyncSession, task_id: str) -> list[TimeLogResponse]:
    from sqlalchemy.orm import selectinload as sil
    result = await db.execute(
        select(TaskTimeLog)
        .options(sil(TaskTimeLog.employee))
        .where(TaskTimeLog.task_id == uuid.UUID(task_id))
        .order_by(TaskTimeLog.started_at.desc())
    )
    return [TimeLogResponse.model_validate(l) for l in result.scalars()]


async def add_comment(
    db: AsyncSession,
    task_id: str,
    body: TaskCommentCreate,
    current_user_id: uuid.UUID,
    current_user_role: str,
) -> TaskCommentResponse:
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    role_lower = current_user_role.lower()
    is_manager_or_above = "manager" in role_lower or "admin" in role_lower
    if not is_manager_or_above and task.assigned_to_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only comment on your own tasks")

    comment = TaskComment(
        task_id=uuid.UUID(task_id),
        employee_id=current_user_id,
        message=body.message,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment, ["employee"])
    await db.commit()

    # Notify manager/creator about the update if posted by employee
    if not is_manager_or_above and task.created_by_id and task.created_by_id != current_user_id:
        poster = await _get_employee(db, current_user_id)
        creator = await _get_employee(db, task.created_by_id)
        if creator and poster:
            await send_whatsapp_message(
                creator.phone,
                f"Update on task '{task.title}' from {poster.name}: {body.message}",
            )

    return TaskCommentResponse.model_validate(comment)


async def list_comments(
    db: AsyncSession,
    task_id: str,
    current_user_id: uuid.UUID,
    current_user_role: str,
) -> list[TaskCommentResponse]:
    from sqlalchemy.orm import selectinload as sil
    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    role_lower = current_user_role.lower()
    is_manager_or_above = "manager" in role_lower or "admin" in role_lower
    if not is_manager_or_above and task.assigned_to_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    comments_result = await db.execute(
        select(TaskComment)
        .options(sil(TaskComment.employee))
        .where(TaskComment.task_id == uuid.UUID(task_id))
        .order_by(TaskComment.created_at.asc())
    )
    return [TaskCommentResponse.model_validate(c) for c in comments_result.scalars()]


# ── Attachments ───────────────────────────────────────────────────────────────

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/quicktime", "video/webm",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


async def upload_attachment(
    db: AsyncSession,
    task_id: str,
    file,  # UploadFile
    current_user_id: uuid.UUID,
) -> "TaskAttachmentResponse":
    import os, io
    from fastapi import UploadFile
    from app.models.task import TaskAttachment
    from .schema import TaskAttachmentResponse

    result = await db.execute(select(Task).where(Task.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"File type '{content_type}' is not allowed")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 25 MB)")

    # Store file on disk
    upload_dir = os.path.join(os.path.dirname(__file__), "../../../../uploads", "task_attachments")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "file")[1]
    stored_name = f"{uuid.uuid4()}{ext}"
    dest = os.path.join(upload_dir, stored_name)
    with open(dest, "wb") as f:
        f.write(data)

    attachment = TaskAttachment(
        task_id=uuid.UUID(task_id),
        uploaded_by_id=current_user_id,
        filename=file.filename or stored_name,
        stored_filename=stored_name,
        file_type=content_type,
        file_size=len(data),
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment, ["uploaded_by"])
    return TaskAttachmentResponse.model_validate(attachment)


async def list_attachments(db: AsyncSession, task_id: str) -> list["TaskAttachmentResponse"]:
    from sqlalchemy.orm import selectinload as sil
    from app.models.task import TaskAttachment
    from .schema import TaskAttachmentResponse

    result = await db.execute(
        select(TaskAttachment)
        .options(sil(TaskAttachment.uploaded_by))
        .where(TaskAttachment.task_id == uuid.UUID(task_id))
        .order_by(TaskAttachment.created_at.asc())
    )
    return [TaskAttachmentResponse.model_validate(a) for a in result.scalars()]


async def download_attachment(db: AsyncSession, task_id: str, attachment_id: str):
    import os
    from fastapi.responses import FileResponse
    from app.models.task import TaskAttachment

    result = await db.execute(
        select(TaskAttachment).where(
            TaskAttachment.id == uuid.UUID(attachment_id),
            TaskAttachment.task_id == uuid.UUID(task_id),
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    upload_dir = os.path.join(os.path.dirname(__file__), "../../../../uploads", "task_attachments")
    path = os.path.join(upload_dir, att.stored_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(path, media_type=att.file_type, filename=att.filename)

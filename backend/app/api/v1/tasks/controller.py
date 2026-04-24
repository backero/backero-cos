from typing import Optional

from fastapi import Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db
from app.utils import excel as xl

from . import service
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

_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def list_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[TaskResponse]:
    return await service.list_tasks(
        db, current_user.id, current_user.role, status, priority,
        assigned_to_id, department_id, search,
    )


async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> TaskResponse:
    return await service.get_task(db, task_id)


async def create_task(
    body: TaskCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.create_task(db, body, current_user.id)


async def update_task(
    task_id: str,
    body: TaskUpdate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.update_task(db, task_id, body, current_user.id)


async def update_task_status(
    task_id: str,
    body: TaskStatusUpdate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.update_task_status(db, task_id, body, current_user.id)


async def complete_task(
    task_id: str,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.complete_task(db, task_id)


async def request_extension(
    task_id: str,
    body: ExtensionRequest,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.request_extension(db, task_id, body)


async def delete_task(
    task_id: str,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
):
    await service.delete_task(db, task_id)
    return {"message": "Task deleted"}


async def add_comment(
    task_id: str,
    body: TaskCommentCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskCommentResponse:
    return await service.add_comment(db, task_id, body, current_user.id)


async def list_compliance_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[ComplianceTaskResponse]:
    return await service.list_compliance_tasks(db)


async def export_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    tasks = await service.list_tasks(db, current_user.id, current_user.role, status, priority)
    rows = []
    for t in tasks:
        rows.append({
            "title": t.title,
            "priority": t.priority,
            "status": t.status,
            "due_date": t.due_date.strftime("%Y-%m-%d") if t.due_date else "",
            "assigned_to": t.assigned_to.name if t.assigned_to else "",
            "created_by": t.created_by.name if t.created_by else "",
            "description": t.description or "",
        })
    data = xl.export_tasks(rows)
    return Response(content=data, media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=tasks.xlsx"})

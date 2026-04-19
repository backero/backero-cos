from typing import Optional

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db

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

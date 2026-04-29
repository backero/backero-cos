from typing import Optional

from fastapi import Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import PaginatedResponse
from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db

from . import service
from .schema import (
    CompletionSubmit,
    ComplianceTaskResponse,
    ExtensionRequest,
    TaskAttachmentResponse,
    TaskCommentCreate,
    TaskCommentResponse,
    TaskCreate,
    TaskReject,
    TaskResponse,
    TaskUpdate,
)


async def list_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> PaginatedResponse[TaskResponse]:
    return await service.list_tasks(
        db, current_user.id, current_user.role, status, priority, assigned_to_id, department_id, search, page, limit
    )


async def create_task(
    body: TaskCreate,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.create_task(db, body, current_user.id, current_user.name)


async def update_task(
    task_id: str,
    body: TaskUpdate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.update_task(db, task_id, body, current_user.id, current_user.role)


async def complete_task(
    task_id: str,
    current_user: ManagerUser = None,
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
    await service.delete_task(db, task_id, current_user.id, current_user.name)
    return {"message": "Task deleted"}


async def submit_completion(
    task_id: str,
    body: CompletionSubmit,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.submit_completion(db, task_id, body, current_user.id)


async def approve_task(
    task_id: str,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.approve_task(db, task_id, current_user.id, current_user.role)


async def reject_task(
    task_id: str,
    body: TaskReject,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    return await service.reject_task(db, task_id, body, current_user.id, current_user.role)


async def list_compliance_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[ComplianceTaskResponse]:
    return await service.list_compliance_tasks(db)


async def add_comment(
    task_id: str,
    body: TaskCommentCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskCommentResponse:
    return await service.add_comment(db, task_id, body, current_user.id, current_user.role)


async def list_comments(
    task_id: str,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> list[TaskCommentResponse]:
    return await service.list_comments(db, task_id, current_user.id, current_user.role)


async def upload_attachment(
    task_id: str,
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> TaskAttachmentResponse:
    return await service.upload_attachment(db, task_id, file, current_user.id)


async def list_attachments(
    task_id: str,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> list[TaskAttachmentResponse]:
    return await service.list_attachments(db, task_id)


async def download_attachment(
    task_id: str,
    attachment_id: str,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    return await service.download_attachment(db, task_id, attachment_id)

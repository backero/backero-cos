from fastapi import APIRouter

from app.api.v1.schemas import PaginatedResponse
from . import controller
from .schema import ComplianceTaskResponse, TaskAttachmentResponse, TaskCommentResponse, TaskResponse

router = APIRouter()

router.get("/compliance", response_model=list[ComplianceTaskResponse])(controller.list_compliance_tasks)
router.get("/", response_model=PaginatedResponse[TaskResponse])(controller.list_tasks)
router.post("/", response_model=TaskResponse)(controller.create_task)
router.patch("/{task_id}", response_model=TaskResponse)(controller.update_task)
router.post("/{task_id}/complete", response_model=TaskResponse)(controller.complete_task)
router.post("/{task_id}/submit-completion", response_model=TaskResponse)(controller.submit_completion)
router.post("/{task_id}/approve", response_model=TaskResponse)(controller.approve_task)
router.post("/{task_id}/reject", response_model=TaskResponse)(controller.reject_task)
router.post("/{task_id}/request-extension", response_model=TaskResponse)(controller.request_extension)
router.delete("/{task_id}")(controller.delete_task)
router.get("/{task_id}/comments", response_model=list[TaskCommentResponse])(controller.list_comments)
router.post("/{task_id}/comments", response_model=TaskCommentResponse)(controller.add_comment)
router.get("/{task_id}/attachments", response_model=list[TaskAttachmentResponse])(controller.list_attachments)
router.post("/{task_id}/attachments", response_model=TaskAttachmentResponse)(controller.upload_attachment)
router.get("/{task_id}/attachments/{attachment_id}/download")(controller.download_attachment)

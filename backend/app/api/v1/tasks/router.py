from fastapi import APIRouter

from . import controller
from .schema import ComplianceTaskResponse, TaskCommentResponse, TaskResponse

router = APIRouter()

router.get("/compliance", response_model=list[ComplianceTaskResponse])(controller.list_compliance_tasks)
router.get("/export")(controller.export_tasks)
router.get("/", response_model=list[TaskResponse])(controller.list_tasks)
router.post("/", response_model=TaskResponse)(controller.create_task)
router.get("/{task_id}", response_model=TaskResponse)(controller.get_task)
router.patch("/{task_id}", response_model=TaskResponse)(controller.update_task)
router.patch("/{task_id}/status", response_model=TaskResponse)(controller.update_task_status)
router.post("/{task_id}/complete", response_model=TaskResponse)(controller.complete_task)
router.post("/{task_id}/request-extension", response_model=TaskResponse)(controller.request_extension)
router.post("/{task_id}/comments", response_model=TaskCommentResponse)(controller.add_comment)
router.delete("/{task_id}")(controller.delete_task)

from fastapi import APIRouter

from . import controller
from .schema import ComplianceTaskResponse, TaskResponse

router = APIRouter()

router.get("/compliance", response_model=list[ComplianceTaskResponse])(controller.list_compliance_tasks)
router.get("/", response_model=list[TaskResponse])(controller.list_tasks)
router.post("/", response_model=TaskResponse)(controller.create_task)
router.patch("/{task_id}", response_model=TaskResponse)(controller.update_task)
router.post("/{task_id}/complete", response_model=TaskResponse)(controller.complete_task)
router.post("/{task_id}/request-extension", response_model=TaskResponse)(controller.request_extension)
router.delete("/{task_id}")(controller.delete_task)

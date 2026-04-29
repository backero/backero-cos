from fastapi import APIRouter

from app.api.v1.schemas import PaginatedResponse
from . import controller
from .schema import ActivityLogResponse, RestoreResponse

router = APIRouter()

router.get("/", response_model=PaginatedResponse[ActivityLogResponse])(controller.list_records)
router.post("/{log_id}/restore", response_model=RestoreResponse)(controller.restore_record)

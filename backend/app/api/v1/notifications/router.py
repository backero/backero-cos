from fastapi import APIRouter

from . import controller
from .schema import NotificationResponse

router = APIRouter()

router.get("/", response_model=list[NotificationResponse])(controller.list_notifications)
router.get("/unread-count")(controller.get_unread_count)
router.patch("/mark-all-read")(controller.mark_all_read)
router.patch("/{notification_id}/read")(controller.mark_read)

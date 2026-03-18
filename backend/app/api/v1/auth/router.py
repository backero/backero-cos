from fastapi import APIRouter

from . import controller

router = APIRouter()

router.post("/send-otp")(controller.send_otp)
router.post("/verify-otp")(controller.verify_otp)
router.post("/refresh")(controller.refresh_token)
router.post("/logout")(controller.logout)
router.get("/me")(controller.get_me)

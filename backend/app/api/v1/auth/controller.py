from fastapi import Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import CurrentUser
from app.db.session import get_db

from . import service
from .schema import ProfileUpdate, RefreshRequest, SendOTPRequest, VerifyOTPRequest


async def send_otp(body: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    otp = await service.send_otp(db, body.phone)
    return {"message": "OTP sent successfully", "otp": otp}


async def verify_otp(body: VerifyOTPRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await service.verify_otp_and_login(db, body.phone, body.otp)
    response.set_cookie(
        key="access_token",
        value=result["access_token"],
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return result


async def refresh_token(body: RefreshRequest, response: Response, db: AsyncSession = Depends(get_db)):
    access_token = await service.refresh_access_token(db, body.refresh_token)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"access_token": access_token, "token_type": "bearer"}


async def logout(response: Response, current_user: CurrentUser):
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}


async def get_me(current_user: CurrentUser):
    from app.api.v1.auth.service import _permissions_for_employee, _employee_dict
    permissions = await _permissions_for_employee(current_user)
    return _employee_dict(current_user, permissions)


async def update_me(body: ProfileUpdate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return await service.update_profile(db, current_user, body.model_dump(exclude_none=True))

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    store_otp,
    verify_otp,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.employee import Employee
from app.utils.notifications import send_otp_sms

router = APIRouter()


class SendOTPRequest(BaseModel):
    phone: str


class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/send-otp")
async def send_otp(body: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Employee).where(Employee.phone == body.phone, Employee.is_active == True)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Phone number not registered")

    otp = generate_otp()
    await store_otp(body.phone, otp)
    await send_otp_sms(body.phone, otp)

    if settings.ENVIRONMENT == "development":
        print(f"\n{'='*40}\n[DEV LOGIN] Phone: {body.phone}  OTP: {otp}\n{'='*40}\n")

    return {"message": "OTP sent successfully"}


@router.post("/verify-otp")
async def verify_otp_endpoint(body: VerifyOTPRequest, response: Response, db: AsyncSession = Depends(get_db)):
    valid = await verify_otp(body.phone, body.otp)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    result = await db.execute(
        select(Employee).where(Employee.phone == body.phone, Employee.is_active == True)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    access_token = create_access_token(str(employee.phone), employee.role)
    refresh_token = create_refresh_token(str(employee.phone), employee.role)

    # Set HTTP-only cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "employee": {
            "id": str(employee.id),
            "name": employee.name,
            "phone": employee.phone,
            "role": employee.role,
            "designation": employee.designation,
        },
    }


@router.post("/refresh")
async def refresh_token(body: RefreshRequest, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid token type")
        phone = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(
        select(Employee).where(Employee.phone == phone, Employee.is_active == True)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    access_token = create_access_token(str(employee.phone), employee.role)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response, current_user: CurrentUser):
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: CurrentUser):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "phone": current_user.phone,
        "email": current_user.email,
        "role": current_user.role,
        "designation": current_user.designation,
        "department_id": str(current_user.department_id) if current_user.department_id else None,
        "avatar_url": current_user.avatar_url,
        "is_active": current_user.is_active,
    }

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    store_otp,
    verify_otp,
)
from app.utils.notifications import send_otp_sms

from .model import Employee


async def send_otp(db: AsyncSession, phone: str) -> None:
    result = await db.execute(
        select(Employee).where(Employee.phone == phone, Employee.is_active == True)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Phone number not registered")

    otp = generate_otp()
    await store_otp(phone, otp)
    await send_otp_sms(phone, otp)

    if settings.ENVIRONMENT == "development":
        print(f"\n{'='*40}\n[DEV LOGIN] Phone: {phone}  OTP: {otp}\n{'='*40}\n")


async def verify_otp_and_login(db: AsyncSession, phone: str, otp: str) -> dict:
    valid = await verify_otp(phone, otp)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    result = await db.execute(
        select(Employee).where(Employee.phone == phone, Employee.is_active == True)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    access_token = create_access_token(str(employee.phone), employee.role)
    refresh_token = create_refresh_token(str(employee.phone), employee.role)

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


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> str:
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid token type")
        phone = payload.get("sub")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(
        select(Employee).where(Employee.phone == phone, Employee.is_active == True)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Employee not found")

    return create_access_token(phone, payload.get("role", "employee"))

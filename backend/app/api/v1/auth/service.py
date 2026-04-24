from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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


async def _permissions_for_employee(employee: Employee) -> dict:
    """Build permissions map from the employee's loaded role_obj."""
    role = employee.role_obj
    if not role:
        return {}
    return {
        p.module: {"can_view": p.can_view, "can_create": p.can_create, "can_edit": p.can_edit}
        for p in role.permissions
        if p.can_view or p.can_create or p.can_edit
    }


def _employee_dict(employee: Employee, permissions: dict) -> dict:
    return {
        "id": str(employee.id),
        "name": employee.name,
        "phone": employee.phone,
        "email": employee.email,
        "role": employee.role,
        "role_id": str(employee.role_id) if employee.role_id else None,
        "designation": employee.designation,
        "department_id": str(employee.department_id) if employee.department_id else None,
        "avatar_url": employee.avatar_url,
        "is_active": employee.is_active,
        "permissions": permissions,
    }


async def send_otp(db: AsyncSession, phone: str) -> str:
    result = await db.execute(
        select(Employee).where(Employee.phone == phone, Employee.is_active == True)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Phone number not registered")

    otp = generate_otp()
    await store_otp(phone, otp)
    await send_otp_sms(phone, otp)

    print(f"\n{'='*40}\n[OTP] Phone: {phone}  OTP: {otp}\n{'='*40}\n")
    return otp


async def verify_otp_and_login(db: AsyncSession, phone: str, otp: str) -> dict:
    valid = await verify_otp(phone, otp)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.role_obj))
        .where(Employee.phone == phone, Employee.is_active == True)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    access_token = create_access_token(str(employee.phone), employee.role)
    refresh_token = create_refresh_token(str(employee.phone), employee.role)
    permissions = await _permissions_for_employee(employee)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "employee": _employee_dict(employee, permissions),
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
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    return create_access_token(phone, emp.role)


async def update_profile(db: AsyncSession, employee: Employee, data: dict) -> dict:
    allowed = {"name", "email", "designation", "avatar_url"}
    for field, value in data.items():
        if field in allowed and value is not None:
            setattr(employee, field, value)
    await db.commit()
    await db.refresh(employee)
    permissions = await _permissions_for_employee(employee)
    return _employee_dict(employee, permissions)

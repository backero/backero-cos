from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.employee import Employee


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> Employee:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not access_token:
        raise credentials_exc
    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise credentials_exc
        phone: str = payload.get("sub", "")
        if not phone:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(select(Employee).where(Employee.phone == phone, Employee.is_active == True))
    employee = result.scalar_one_or_none()
    if not employee:
        raise credentials_exc
    return employee


CurrentUser = Annotated[Employee, Depends(get_current_user)]


async def require_admin(current_user: CurrentUser) -> Employee:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_manager_or_admin(current_user: CurrentUser) -> Employee:
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager or Admin access required")
    return current_user


AdminUser = Annotated[Employee, Depends(require_admin)]
ManagerUser = Annotated[Employee, Depends(require_manager_or_admin)]

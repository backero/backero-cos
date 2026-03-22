from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token
from app.db.session import get_db
from app.models.employee import Employee
from jose import JWTError


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

    result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.role_obj))
        .where(Employee.phone == phone, Employee.is_active == True)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise credentials_exc
    return employee


CurrentUser = Annotated[Employee, Depends(get_current_user)]


async def require_super_admin(current_user: CurrentUser) -> Employee:
    role = current_user.role_obj
    if not role or not role.is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return current_user


async def require_admin(current_user: CurrentUser) -> Employee:
    role = current_user.role_obj
    # Allow if system role (super admin) or role has full access (is_system check is enough)
    if not role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    # Check if the role has edit access on employees module (proxy for admin level)
    if not role.is_system:
        from app.api.v1.roles.model import MODULES
        has_employees_edit = any(
            p.module == "employees" and p.can_edit for p in role.permissions
        )
        if not has_employees_edit:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_manager_or_admin(current_user: CurrentUser) -> Employee:
    role = current_user.role_obj
    if not role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if not role.is_system:
        has_employees_view = any(p.module == "employees" and p.can_view for p in role.permissions)
        if not has_employees_view:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager or Admin access required")
    return current_user


SuperAdminUser = Annotated[Employee, Depends(require_super_admin)]
AdminUser = Annotated[Employee, Depends(require_admin)]
ManagerUser = Annotated[Employee, Depends(require_manager_or_admin)]

from typing import Optional

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import AdminUser, CurrentUser
from app.db.session import get_db

from . import service
from .schema import (
    AttendanceResponse,
    CheckInRequest,
    DepartmentCreate,
    DepartmentResponse,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
)


async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[DepartmentResponse]:
    return await service.list_departments(db)


async def create_department(
    body: DepartmentCreate,
    current_user: AdminUser = None,
    db: AsyncSession = Depends(get_db),
) -> DepartmentResponse:
    return await service.create_department(db, body)


async def list_employees(
    department_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[EmployeeResponse]:
    return await service.list_employees(db, department_id, is_active)


async def create_employee(
    body: EmployeeCreate,
    current_user: AdminUser = None,
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    return await service.create_employee(db, body)


async def get_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> EmployeeResponse:
    return await service.get_employee(db, employee_id)


async def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    current_user: AdminUser = None,
    db: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    return await service.update_employee(db, employee_id, body)


async def check_in(
    employee_id: str,
    body: CheckInRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> AttendanceResponse:
    return await service.check_in(db, employee_id, body)


async def check_out(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> AttendanceResponse:
    return await service.check_out(db, employee_id)


async def get_attendance(
    employee_id: str,
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[AttendanceResponse]:
    return await service.get_attendance(db, employee_id, month, year)

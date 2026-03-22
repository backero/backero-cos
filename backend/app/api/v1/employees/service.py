import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .model import Attendance, Department, Employee
from .schema import (
    AttendanceResponse,
    CheckInRequest,
    DepartmentCreate,
    DepartmentResponse,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
)


def _employee_response(emp: Employee) -> EmployeeResponse:
    return EmployeeResponse(
        id=emp.id,
        name=emp.name,
        phone=emp.phone,
        email=emp.email,
        role=emp.role,
        role_id=emp.role_id,
        designation=emp.designation,
        department_id=emp.department_id,
        department_name=emp.department.name if emp.department else None,
        salary=float(emp.salary) if emp.salary else None,
        join_date=emp.join_date,
        is_active=emp.is_active,
        avatar_url=emp.avatar_url,
        created_at=emp.created_at,
    )


def _attendance_response(att: Attendance) -> AttendanceResponse:
    return AttendanceResponse.model_validate(att)


async def list_departments(db: AsyncSession) -> list[DepartmentResponse]:
    result = await db.execute(select(Department).order_by(Department.name))
    return [DepartmentResponse.model_validate(d) for d in result.scalars()]


async def create_department(db: AsyncSession, body: DepartmentCreate) -> DepartmentResponse:
    existing = await db.execute(select(Department).where(Department.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Department '{body.name}' already exists.", headers={"X-Field": "name"})
    dept = Department(name=body.name, description=body.description)
    db.add(dept)
    await db.flush()
    return DepartmentResponse.model_validate(dept)


async def list_employees(
    db: AsyncSession,
    department_id: Optional[str] = None,
    is_active: Optional[bool] = True,
) -> list[EmployeeResponse]:
    query = select(Employee).options(selectinload(Employee.department))
    if department_id:
        query = query.where(Employee.department_id == uuid.UUID(department_id))
    if is_active is not None:
        query = query.where(Employee.is_active == is_active)
    query = query.order_by(Employee.name)
    result = await db.execute(query)
    return [_employee_response(e) for e in result.scalars()]


async def create_employee(db: AsyncSession, body: EmployeeCreate) -> EmployeeResponse:
    from app.api.v1.roles.model import Role

    existing = await db.execute(select(Employee).where(Employee.phone == body.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    # Resolve role name from role_id
    role_name = "Employee"
    if body.role_id:
        role_result = await db.execute(select(Role).where(Role.id == body.role_id))
        role_obj = role_result.scalar_one_or_none()
        if not role_obj:
            raise HTTPException(status_code=400, detail="Invalid role_id")
        role_name = role_obj.name

    emp = Employee(
        name=body.name,
        phone=body.phone,
        email=body.email,
        role=role_name,
        role_id=body.role_id,
        designation=body.designation,
        department_id=uuid.UUID(body.department_id) if body.department_id else None,
        salary=body.salary,
        join_date=body.join_date,
    )
    db.add(emp)
    await db.flush()
    await db.refresh(emp, ["department"])
    return _employee_response(emp)


async def get_employee(db: AsyncSession, employee_id: str) -> EmployeeResponse:
    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == uuid.UUID(employee_id))
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _employee_response(emp)


async def update_employee(db: AsyncSession, employee_id: str, body: EmployeeUpdate) -> EmployeeResponse:
    from app.api.v1.roles.model import Role

    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == uuid.UUID(employee_id))
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    updates = body.model_dump(exclude_none=True)

    if "role_id" in updates:
        role_result = await db.execute(select(Role).where(Role.id == updates["role_id"]))
        role_obj = role_result.scalar_one_or_none()
        if not role_obj:
            raise HTTPException(status_code=400, detail="Invalid role_id")
        emp.role_id = updates.pop("role_id")
        emp.role = role_obj.name

    for field, value in updates.items():
        if field == "department_id" and value:
            value = uuid.UUID(value)
        setattr(emp, field, value)

    return _employee_response(emp)


async def check_in(db: AsyncSession, employee_id: str, body: CheckInRequest) -> AttendanceResponse:
    today = date.today()
    existing = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == uuid.UUID(employee_id),
            Attendance.date == today,
        )
    )
    att = existing.scalar_one_or_none()
    if att and att.check_in:
        raise HTTPException(status_code=400, detail="Already checked in today")

    if not att:
        att = Attendance(
            employee_id=uuid.UUID(employee_id),
            date=today,
            check_in=datetime.now(timezone.utc),
            status="present",
            notes=body.notes,
        )
        db.add(att)
    else:
        att.check_in = datetime.now(timezone.utc)

    await db.flush()
    return _attendance_response(att)


async def check_out(db: AsyncSession, employee_id: str) -> AttendanceResponse:
    today = date.today()
    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == uuid.UUID(employee_id),
            Attendance.date == today,
        )
    )
    att = result.scalar_one_or_none()
    if not att or not att.check_in:
        raise HTTPException(status_code=400, detail="No check-in found for today")
    if att.check_out:
        raise HTTPException(status_code=400, detail="Already checked out today")

    att.check_out = datetime.now(timezone.utc)
    return _attendance_response(att)


async def get_attendance(
    db: AsyncSession,
    employee_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
) -> list[AttendanceResponse]:
    query = select(Attendance).where(Attendance.employee_id == uuid.UUID(employee_id))
    if month and year:
        query = query.where(
            func.extract("month", Attendance.date) == month,
            func.extract("year", Attendance.date) == year,
        )
    query = query.order_by(Attendance.date.desc())
    result = await db.execute(query)
    return [_attendance_response(a) for a in result.scalars()]

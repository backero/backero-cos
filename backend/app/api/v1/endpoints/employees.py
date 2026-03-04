import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import AdminUser, CurrentUser, ManagerUser
from app.db.session import get_db
from app.models.employee import Attendance, Department, Employee

router = APIRouter()


# ---------- Departments ----------

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


@router.get("/departments")
async def list_departments(db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    result = await db.execute(select(Department).order_by(Department.name))
    return [{"id": str(d.id), "name": d.name, "description": d.description} for d in result.scalars()]


@router.post("/departments")
async def create_department(body: DepartmentCreate, current_user: AdminUser = None, db: AsyncSession = Depends(get_db)):
    dept = Department(name=body.name, description=body.description)
    db.add(dept)
    await db.flush()
    return {"id": str(dept.id), "name": dept.name, "description": dept.description}


# ---------- Employees ----------

class EmployeeCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    role: str = "employee"
    designation: Optional[str] = None
    department_id: Optional[str] = None
    salary: Optional[float] = None
    join_date: Optional[date] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    designation: Optional[str] = None
    department_id: Optional[str] = None
    salary: Optional[float] = None
    is_active: Optional[bool] = None


@router.get("/")
async def list_employees(
    department_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(Employee).options(selectinload(Employee.department))
    if department_id:
        query = query.where(Employee.department_id == uuid.UUID(department_id))
    if is_active is not None:
        query = query.where(Employee.is_active == is_active)
    query = query.order_by(Employee.name)
    result = await db.execute(query)
    employees = result.scalars().all()
    return [_employee_dict(e) for e in employees]


@router.post("/")
async def create_employee(body: EmployeeCreate, current_user: AdminUser = None, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Employee).where(Employee.phone == body.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    emp = Employee(
        name=body.name,
        phone=body.phone,
        email=body.email,
        role=body.role,
        designation=body.designation,
        department_id=uuid.UUID(body.department_id) if body.department_id else None,
        salary=body.salary,
        join_date=body.join_date,
    )
    db.add(emp)
    await db.flush()
    return _employee_dict(emp)


@router.get("/{employee_id}")
async def get_employee(employee_id: str, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == uuid.UUID(employee_id))
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _employee_dict(emp)


@router.patch("/{employee_id}")
async def update_employee(
    employee_id: str, body: EmployeeUpdate, current_user: AdminUser = None, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Employee).where(Employee.id == uuid.UUID(employee_id)))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "department_id" and value:
            value = uuid.UUID(value)
        setattr(emp, field, value)

    return _employee_dict(emp)


# ---------- Attendance ----------

class CheckInRequest(BaseModel):
    notes: Optional[str] = None


@router.post("/{employee_id}/check-in")
async def check_in(employee_id: str, body: CheckInRequest, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
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
    return _attendance_dict(att)


@router.post("/{employee_id}/check-out")
async def check_out(employee_id: str, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
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
    return _attendance_dict(att)


@router.get("/{employee_id}/attendance")
async def get_attendance(
    employee_id: str,
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(Attendance).where(Attendance.employee_id == uuid.UUID(employee_id))
    if month and year:
        query = query.where(
            func.extract("month", Attendance.date) == month,
            func.extract("year", Attendance.date) == year,
        )
    query = query.order_by(Attendance.date.desc())
    result = await db.execute(query)
    return [_attendance_dict(a) for a in result.scalars()]


def _employee_dict(emp: Employee) -> dict:
    return {
        "id": str(emp.id),
        "name": emp.name,
        "phone": emp.phone,
        "email": emp.email,
        "role": emp.role,
        "designation": emp.designation,
        "department_id": str(emp.department_id) if emp.department_id else None,
        "department_name": emp.department.name if emp.department else None,
        "salary": float(emp.salary) if emp.salary else None,
        "join_date": emp.join_date.isoformat() if emp.join_date else None,
        "is_active": emp.is_active,
        "avatar_url": emp.avatar_url,
        "created_at": emp.created_at.isoformat(),
    }


def _attendance_dict(att: Attendance) -> dict:
    return {
        "id": str(att.id),
        "employee_id": str(att.employee_id),
        "date": att.date.isoformat(),
        "check_in": att.check_in.isoformat() if att.check_in else None,
        "check_out": att.check_out.isoformat() if att.check_out else None,
        "status": att.status,
        "notes": att.notes,
    }

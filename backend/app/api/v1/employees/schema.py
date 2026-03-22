from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: Optional[str] = None


class EmployeeCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    role_id: Optional[UUID] = None       # dynamic role assignment
    designation: Optional[str] = None
    department_id: Optional[str] = None
    salary: Optional[float] = None
    join_date: Optional[date] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role_id: Optional[UUID] = None
    designation: Optional[str] = None
    department_id: Optional[str] = None
    salary: Optional[float] = None
    is_active: Optional[bool] = None


class EmployeeResponse(BaseModel):
    id: UUID
    name: str
    phone: str
    email: Optional[str] = None
    role: str                            # role name (display)
    role_id: Optional[UUID] = None
    designation: Optional[str] = None
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    salary: Optional[float] = None
    join_date: Optional[date] = None
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: datetime


class CheckInRequest(BaseModel):
    notes: Optional[str] = None


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    employee_id: UUID
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: str
    notes: Optional[str] = None

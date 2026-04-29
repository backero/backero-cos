from datetime import date
from typing import Optional
import uuid

from pydantic import BaseModel


class PayrollGenerate(BaseModel):
    month: int
    year: int
    working_days: int = 26
    hra_pct: float = 40.0
    allowances: float = 0.0
    pf_pct: float = 12.0
    esi_pct: float = 0.75
    tds: float = 0.0
    other_deductions: float = 0.0
    notes: Optional[str] = None


class PayrollUpdate(BaseModel):
    allowances: Optional[float] = None
    tds: Optional[float] = None
    other_deductions: Optional[float] = None
    payment_mode: Optional[str] = None
    payment_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PayrollResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str] = None
    employee_designation: Optional[str] = None
    month: int
    year: int
    working_days: int
    present_days: int
    paid_leave_days: int
    half_days: int
    basic_salary: float
    hra: float
    allowances: float
    gross_salary: float
    pf_employee: float
    pf_employer: float
    esi_employee: float
    esi_employer: float
    tds: float
    other_deductions: float
    total_deductions: float
    net_salary: float
    payment_mode: str
    payment_date: Optional[date] = None
    status: str
    notes: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


class PayrollSummary(BaseModel):
    month: int
    year: int
    total_employees: int
    total_gross: float
    total_deductions: float
    total_net: float
    paid_count: int
    draft_count: int
    approved_count: int

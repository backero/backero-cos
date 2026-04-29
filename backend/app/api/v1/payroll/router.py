from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.employee import Employee
from .schema import PayrollGenerate, PayrollResponse, PayrollSummary, PayrollUpdate
from . import service

router = APIRouter(prefix="/payroll", tags=["payroll"])


@router.get("/", response_model=list[PayrollResponse])
async def list_payroll(
    month: Optional[int] = None,
    year: Optional[int] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    return await service.list_payroll(db, month=month, year=year, employee_id=employee_id, status=status)


@router.post("/generate", response_model=list[PayrollResponse])
async def generate_payroll(
    body: PayrollGenerate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    return await service.generate_payroll(db, body, actor_id=current_user.id, actor_name=current_user.name)


@router.patch("/{record_id}", response_model=PayrollResponse)
async def update_payroll(
    record_id: str,
    body: PayrollUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    return await service.update_payroll(db, record_id, body)


@router.get("/summary", response_model=PayrollSummary)
async def payroll_summary(
    month: int,
    year: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    return await service.get_payroll_summary(db, month, year)


@router.get("/{record_id}/payslip")
async def download_payslip(
    record_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    return await service.generate_payslip_pdf(db, record_id)

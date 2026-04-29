import uuid
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employee import Attendance, Employee
from app.models.payroll import PayrollRecord
from .schema import PayrollGenerate, PayrollResponse, PayrollSummary, PayrollUpdate


def _to_response(r: PayrollRecord) -> PayrollResponse:
    emp = r.employee
    return PayrollResponse(
        id=r.id,
        employee_id=r.employee_id,
        employee_name=emp.name if emp else None,
        employee_designation=emp.designation if emp else None,
        month=r.month,
        year=r.year,
        working_days=r.working_days,
        present_days=r.present_days,
        paid_leave_days=r.paid_leave_days,
        half_days=r.half_days,
        basic_salary=float(r.basic_salary),
        hra=float(r.hra),
        allowances=float(r.allowances),
        gross_salary=float(r.gross_salary),
        pf_employee=float(r.pf_employee),
        pf_employer=float(r.pf_employer),
        esi_employee=float(r.esi_employee),
        esi_employer=float(r.esi_employer),
        tds=float(r.tds),
        other_deductions=float(r.other_deductions),
        total_deductions=float(r.total_deductions),
        net_salary=float(r.net_salary),
        payment_mode=r.payment_mode,
        payment_date=r.payment_date,
        status=r.status,
        notes=r.notes,
        created_at=r.created_at.isoformat(),
    )


async def generate_payroll(
    db: AsyncSession,
    body: PayrollGenerate,
    actor_id: uuid.UUID,
    actor_name: str,
) -> list[PayrollResponse]:
    """Generate payroll records for all active employees for the given month/year."""
    from app.utils.activity import log as activity_log

    # Load all active employees
    emp_result = await db.execute(
        select(Employee).where(Employee.is_active == True)
    )
    employees = emp_result.scalars().all()

    results = []
    for emp in employees:
        # Skip if payroll already exists for this employee/month/year
        existing = await db.execute(
            select(PayrollRecord).where(
                PayrollRecord.employee_id == emp.id,
                PayrollRecord.month == body.month,
                PayrollRecord.year == body.year,
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Count attendance for the month
        att_result = await db.execute(
            select(Attendance).where(
                Attendance.employee_id == emp.id,
                extract("month", Attendance.date) == body.month,
                extract("year", Attendance.date) == body.year,
            )
        )
        attendances = att_result.scalars().all()

        present_days = sum(1 for a in attendances if a.status in ("present", "wfh"))
        half_days = sum(1 for a in attendances if a.status == "half_day")
        paid_leave_days = 0  # Can extend with leave management

        # Salary calculation
        monthly_salary = float(emp.salary or 0)
        if monthly_salary == 0:
            continue  # skip employees with no salary set

        # Pro-rate based on attendance
        effective_days = present_days + (half_days * 0.5) + paid_leave_days
        attendance_ratio = min(effective_days / body.working_days, 1.0) if body.working_days > 0 else 1.0

        basic = round(monthly_salary * 0.6 * attendance_ratio, 2)
        hra = round(basic * (body.hra_pct / 100), 2)
        allowances = round(body.allowances * attendance_ratio, 2)
        gross = round(basic + hra + allowances, 2)

        # PF: 12% of basic (employee + employer)
        pf_emp = round(basic * (body.pf_pct / 100), 2)
        pf_employer = round(basic * (body.pf_pct / 100), 2)

        # ESI: 0.75% of gross (employee), 3.25% employer — only if gross <= 21000
        esi_emp = round(gross * (body.esi_pct / 100), 2) if gross <= 21000 else 0.0
        esi_employer = round(gross * 3.25 / 100, 2) if gross <= 21000 else 0.0

        total_deductions = round(pf_emp + esi_emp + body.tds + body.other_deductions, 2)
        net = round(gross - total_deductions, 2)

        record = PayrollRecord(
            employee_id=emp.id,
            month=body.month,
            year=body.year,
            working_days=body.working_days,
            present_days=present_days,
            paid_leave_days=paid_leave_days,
            half_days=half_days,
            basic_salary=basic,
            hra=hra,
            allowances=allowances,
            gross_salary=gross,
            pf_employee=pf_emp,
            pf_employer=pf_employer,
            esi_employee=esi_emp,
            esi_employer=esi_employer,
            tds=body.tds,
            other_deductions=body.other_deductions,
            total_deductions=total_deductions,
            net_salary=net,
            notes=body.notes,
        )
        db.add(record)
        await db.flush()
        await db.refresh(record, ["employee"])
        results.append(_to_response(record))

    await activity_log(
        db,
        actor_id=actor_id,
        actor_name=actor_name,
        action="create",
        entity_type="payroll",
        entity_name=f"{body.month}/{body.year}",
        description=f"{actor_name} generated payroll for {len(results)} employees ({body.month}/{body.year})",
    )

    return results


async def list_payroll(
    db: AsyncSession,
    month: Optional[int] = None,
    year: Optional[int] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
) -> list[PayrollResponse]:
    query = select(PayrollRecord).options(selectinload(PayrollRecord.employee))
    if month:
        query = query.where(PayrollRecord.month == month)
    if year:
        query = query.where(PayrollRecord.year == year)
    if employee_id:
        query = query.where(PayrollRecord.employee_id == uuid.UUID(employee_id))
    if status:
        query = query.where(PayrollRecord.status == status)
    query = query.order_by(PayrollRecord.year.desc(), PayrollRecord.month.desc())
    result = await db.execute(query)
    return [_to_response(r) for r in result.scalars()]


async def update_payroll(
    db: AsyncSession, record_id: str, body: PayrollUpdate
) -> PayrollResponse:
    result = await db.execute(
        select(PayrollRecord).options(selectinload(PayrollRecord.employee))
        .where(PayrollRecord.id == uuid.UUID(record_id))
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")

    updates = body.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(record, field, value)

    # Recalculate totals if deductions changed
    record.total_deductions = float(record.pf_employee) + float(record.esi_employee) + float(record.tds) + float(record.other_deductions)
    record.net_salary = float(record.gross_salary) - float(record.total_deductions)

    await db.flush()
    return _to_response(record)


async def get_payroll_summary(
    db: AsyncSession, month: int, year: int
) -> PayrollSummary:
    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(PayrollRecord.gross_salary).label("total_gross"),
            func.sum(PayrollRecord.total_deductions).label("total_deductions"),
            func.sum(PayrollRecord.net_salary).label("total_net"),
            func.sum(
                func.cast(PayrollRecord.status == "paid", db.bind.dialect.INTEGER if hasattr(db.bind, "dialect") else "int")
            ).label("paid_count"),
        ).where(
            PayrollRecord.month == month,
            PayrollRecord.year == year,
        )
    )
    row = result.one()

    # Count by status
    status_result = await db.execute(
        select(PayrollRecord.status, func.count().label("cnt"))
        .where(PayrollRecord.month == month, PayrollRecord.year == year)
        .group_by(PayrollRecord.status)
    )
    status_counts = {r.status: r.cnt for r in status_result.all()}

    return PayrollSummary(
        month=month,
        year=year,
        total_employees=row.total or 0,
        total_gross=float(row.total_gross or 0),
        total_deductions=float(row.total_deductions or 0),
        total_net=float(row.total_net or 0),
        paid_count=status_counts.get("paid", 0),
        draft_count=status_counts.get("draft", 0),
        approved_count=status_counts.get("approved", 0),
    )


async def generate_payslip_pdf(db: AsyncSession, record_id: str):
    """Generate a PDF payslip for a payroll record."""
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm

    result = await db.execute(
        select(PayrollRecord).options(selectinload(PayrollRecord.employee))
        .where(PayrollRecord.id == uuid.UUID(record_id))
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")

    emp = record.employee
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=18, textColor=colors.HexColor("#1E3A5F"), spaceAfter=4)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10, textColor=colors.grey)
    label_style = ParagraphStyle("label", parent=styles["Normal"], fontSize=9, textColor=colors.grey)

    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    month_name = month_names[record.month - 1]

    elements = [
        Paragraph("BACKERO PRIVATE LIMITED", title_style),
        Paragraph("Pay Slip", sub_style),
        Paragraph(f"Period: {month_name} {record.year}", sub_style),
        Spacer(1, 0.5*cm),
    ]

    # Employee info table
    emp_data = [
        ["Employee Name", emp.name if emp else "—", "Month/Year", f"{month_name} {record.year}"],
        ["Designation", emp.designation or "—" if emp else "—", "Status", record.status.upper()],
        ["Working Days", str(record.working_days), "Present Days", str(record.present_days)],
        ["Half Days", str(record.half_days), "Payment Mode", record.payment_mode.upper()],
    ]
    emp_table = Table(emp_data, colWidths=[4*cm, 6*cm, 4*cm, 4*cm])
    emp_table.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0,0), (0,-1), colors.HexColor("#1E3A5F")),
        ("TEXTCOLOR", (2,0), (2,-1), colors.HexColor("#1E3A5F")),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.HexColor("#F8F9FA"), colors.white]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ("PADDING", (0,0), (-1,-1), 6),
    ]))
    elements.append(emp_table)
    elements.append(Spacer(1, 0.5*cm))

    # Earnings & deductions
    earnings_data = [
        ["EARNINGS", "Amount (₹)", "DEDUCTIONS", "Amount (₹)"],
        ["Basic Salary", f"{record.basic_salary:,.2f}", "PF (Employee)", f"{record.pf_employee:,.2f}"],
        ["HRA", f"{record.hra:,.2f}", "ESI (Employee)", f"{record.esi_employee:,.2f}"],
        ["Allowances", f"{record.allowances:,.2f}", "TDS", f"{record.tds:,.2f}"],
        ["", "", "Other Deductions", f"{record.other_deductions:,.2f}"],
        ["GROSS SALARY", f"{record.gross_salary:,.2f}", "TOTAL DEDUCTIONS", f"{record.total_deductions:,.2f}"],
    ]
    sal_table = Table(earnings_data, colWidths=[5*cm, 4*cm, 5*cm, 4*cm])
    sal_table.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1E3A5F")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#E8F5E9")),
        ("TEXTCOLOR", (0,-1), (-1,-1), colors.HexColor("#1E3A5F")),
        ("ROWBACKGROUNDS", (0,1), (-1,-2), [colors.white, colors.HexColor("#F8F9FA")]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ("PADDING", (0,0), (-1,-1), 6),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("ALIGN", (3,0), (3,-1), "RIGHT"),
    ]))
    elements.append(sal_table)
    elements.append(Spacer(1, 0.5*cm))

    # Net pay
    net_data = [["NET PAY", f"₹ {record.net_salary:,.2f}"]]
    net_table = Table(net_data, colWidths=[14*cm, 4*cm])
    net_table.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 12),
        ("FONTNAME", (0,0), (-1,-1), "Helvetica-Bold"),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#1E3A5F")),
        ("TEXTCOLOR", (0,0), (-1,-1), colors.white),
        ("ALIGN", (1,0), (1,0), "RIGHT"),
        ("PADDING", (0,0), (-1,-1), 10),
    ]))
    elements.append(net_table)

    doc.build(elements)
    buf.seek(0)
    emp_name_safe = (emp.name if emp else "employee").replace(" ", "_")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Payslip_{emp_name_safe}_{month_name}_{record.year}.pdf"},
    )

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.finance.model import AccountEntry, Invoice
from app.api.v1.inventory.model import Inventory
from app.models.employee import Attendance, Department, Employee
from app.models.task import Task
from .schema import (
    DepartmentProductivityItem,
    KPIResponse,
    MonthlyTrendItem,
    TaskStats,
)


async def get_kpis(db: AsyncSession) -> KPIResponse:
    today = date.today()
    month_start = today.replace(day=1)

    revenue_result = await db.execute(
        select(func.sum(AccountEntry.amount)).where(
            AccountEntry.type == "income",
            AccountEntry.date >= month_start,
        )
    )
    revenue = float(revenue_result.scalar() or 0)

    expense_result = await db.execute(
        select(func.sum(AccountEntry.amount)).where(
            AccountEntry.type == "expense",
            AccountEntry.date >= month_start,
        )
    )
    expenses = float(expense_result.scalar() or 0)

    pending_inv = await db.execute(
        select(func.count(), func.sum(Invoice.total)).where(Invoice.status == "pending")
    )
    pending_row = pending_inv.one()

    task_result = await db.execute(
        select(Task.status, func.count()).group_by(Task.status)
    )
    task_stats = {r[0]: r[1] for r in task_result.all()}

    emp_count = await db.execute(select(func.count()).where(Employee.is_active == True))
    att_count = await db.execute(select(func.count()).where(Attendance.date == today))
    low_stock = await db.execute(
        select(func.count()).select_from(Inventory).where(
            Inventory.current_stock <= Inventory.reorder_level
        )
    )

    return KPIResponse(
        revenue_this_month=revenue,
        expenses_this_month=expenses,
        net_profit=revenue - expenses,
        pending_invoices_count=pending_row[0],
        pending_invoices_amount=float(pending_row[1] or 0),
        tasks=TaskStats(
            total=sum(task_stats.values()),
            pending=task_stats.get("pending", 0),
            in_progress=task_stats.get("in_progress", 0),
            completed=task_stats.get("completed", 0),
            overdue=task_stats.get("overdue", 0),
        ),
        total_employees=emp_count.scalar(),
        present_today=att_count.scalar(),
        low_stock_products=low_stock.scalar(),
    )


async def get_department_productivity(db: AsyncSession) -> list[DepartmentProductivityItem]:
    dept_result = await db.execute(
        select(Department).options(selectinload(Department.employees)).order_by(Department.name)
    )
    departments = dept_result.scalars().all()

    task_result = await db.execute(select(Task).where(Task.department_id.is_not(None)))
    tasks = task_result.scalars().all()

    tasks_by_dept = defaultdict(list)
    for task in tasks:
        tasks_by_dept[task.department_id].append(task)

    items: list[DepartmentProductivityItem] = []
    for dept in departments:
        dept_tasks = tasks_by_dept.get(dept.id, [])
        total = len(dept_tasks)
        pending = sum(1 for t in dept_tasks if t.status == "pending")
        in_progress = sum(1 for t in dept_tasks if t.status == "in_progress")
        completed = sum(1 for t in dept_tasks if t.status == "completed")
        overdue = sum(1 for t in dept_tasks if t.status == "overdue")

        completed_tasks = [t for t in dept_tasks if t.completed_at is not None]
        avg_completion_days = 0.0
        if completed_tasks:
            total_days = sum(
                (t.completed_at - t.created_at).total_seconds() / 86400
                for t in completed_tasks
                if t.completed_at and t.created_at
            )
            avg_completion_days = round(total_days / len(completed_tasks), 2)

        completion_rate = round((completed / total) * 100, 2) if total else 0.0
        overdue_rate = round((overdue / total) * 100, 2) if total else 0.0
        active_employees = sum(1 for emp in dept.employees if emp.is_active)

        items.append(
            DepartmentProductivityItem(
                department_id=dept.id,
                department_name=dept.name,
                total_tasks=total,
                pending_tasks=pending,
                in_progress_tasks=in_progress,
                completed_tasks=completed,
                overdue_tasks=overdue,
                completion_rate=completion_rate,
                overdue_rate=overdue_rate,
                average_completion_days=avg_completion_days,
                active_employees=active_employees,
            )
        )

    return items


async def monthly_trend(db: AsyncSession) -> list[MonthlyTrendItem]:
    today = date.today()
    results = []
    for i in range(5, -1, -1):
        month_date = (today.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        next_month = (month_date.replace(day=28) + timedelta(days=4)).replace(day=1)

        inc = await db.execute(
            select(func.sum(AccountEntry.amount)).where(
                AccountEntry.type == "income",
                AccountEntry.date >= month_date,
                AccountEntry.date < next_month,
            )
        )
        exp = await db.execute(
            select(func.sum(AccountEntry.amount)).where(
                AccountEntry.type == "expense",
                AccountEntry.date >= month_date,
                AccountEntry.date < next_month,
            )
        )
        results.append(MonthlyTrendItem(
            month=month_date.strftime("%b %Y"),
            income=float(inc.scalar() or 0),
            expense=float(exp.scalar() or 0),
        ))
    return results

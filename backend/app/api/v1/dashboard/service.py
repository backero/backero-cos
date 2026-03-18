from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import AccountEntry, Attendance, Employee, Invoice, Inventory, Task
from .schema import KPIResponse, MonthlyTrendItem, TaskStats


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

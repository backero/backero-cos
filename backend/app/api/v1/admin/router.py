from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, SuperAdminUser
from app.db.session import get_db

router = APIRouter()


@router.get("/health")
async def admin_health(
    db: AsyncSession = Depends(get_db),
    current_user: SuperAdminUser = None,
):
    from app.models.task import Task
    from app.models.inventory import Inventory
    from app.models.payroll import Payroll

    # DB connectivity
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    # Overdue tasks count
    overdue_result = await db.execute(
        select(func.count()).select_from(Task).where(Task.status == "overdue", Task.is_deleted == False)
    )
    overdue_tasks = overdue_result.scalar_one()

    # Low stock count
    low_stock_result = await db.execute(
        select(func.count()).select_from(Inventory).where(
            Inventory.current_stock <= Inventory.reorder_level
        )
    )
    low_stock = low_stock_result.scalar_one()

    # Pending payroll count
    try:
        pending_payroll_result = await db.execute(
            select(func.count()).select_from(Payroll).where(Payroll.status == "pending")
        )
        pending_payroll = pending_payroll_result.scalar_one()
    except Exception:
        pending_payroll = 0

    # Failed WhatsApp count from system_counters
    try:
        counter_result = await db.execute(
            text("SELECT value FROM system_counters WHERE key = 'failed_wa_count'")
        )
        row = counter_result.fetchone()
        failed_wa = int(row[0]) if row else 0
    except Exception:
        failed_wa = 0

    from app.utils.scheduler import scheduler
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "next_run": next_run.isoformat() if next_run else None,
        })

    return {
        "db_status": db_status,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "scheduler_jobs": jobs,
        "overdue_tasks_count": overdue_tasks,
        "low_stock_count": low_stock,
        "pending_payroll_count": pending_payroll,
        "failed_wa_count": failed_wa,
    }

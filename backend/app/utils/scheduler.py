from datetime import date, datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update

from app.db.session import AsyncSessionLocal
from app.models.task import Task
from app.utils.notifications import send_whatsapp_message

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


async def _get_supervisors(db) -> list:
    """Return all active employees with Manager, Admin, or Super Admin roles."""
    from app.models.employee import Employee
    result = await db.execute(select(Employee).where(Employee.is_active == True))
    all_employees = result.scalars().all()
    return [
        e for e in all_employees
        if any(kw in (e.role or "").lower() for kw in ("manager", "admin"))
    ]


async def scan_overdue_tasks():
    """Mark tasks as overdue if past due date and notify assignee + all managers/admins/super admins."""
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Task).where(
                Task.status.in_(["pending", "in_progress"]),
                Task.due_date < now,
                Task.due_date.is_not(None),
            )
        )
        tasks = result.scalars().all()

        supervisors = await _get_supervisors(db)
        supervisor_phones = {s.phone for s in supervisors}

        for task in tasks:
            task.status = "overdue"
            notified: set[str] = set()

            if task.assigned_to_id:
                from app.models.employee import Employee
                emp_result = await db.execute(select(Employee).where(Employee.id == task.assigned_to_id))
                emp = emp_result.scalar_one_or_none()
                if emp:
                    await send_whatsapp_message(emp.phone, f"Overdue task: '{task.title}'. Please complete it immediately.")
                    notified.add(emp.phone)

                emp_name = emp.name if emp else "An employee"
                for supervisor in supervisors:
                    if supervisor.phone not in notified:
                        await send_whatsapp_message(
                            supervisor.phone,
                            f"Task '{task.title}' assigned to {emp_name} is now overdue.",
                        )
                        notified.add(supervisor.phone)

        await db.commit()
        print(f"[Scheduler] Marked {len(tasks)} tasks as overdue and notified assignees + {len(supervisors)} supervisors")


async def send_task_reminders():
    """Send WhatsApp reminders for tasks due in next 24h"""
    tomorrow = datetime.now(timezone.utc) + timedelta(hours=24)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Task).where(
                Task.status.in_(["pending", "in_progress"]),
                Task.due_date <= tomorrow,
                Task.due_date > datetime.now(timezone.utc),
            )
        )
        tasks = result.scalars().all()
        for task in tasks:
            if task.assigned_to_id:
                from app.models.employee import Employee
                emp_result = await db.execute(
                    select(Employee).where(Employee.id == task.assigned_to_id)
                )
                emp = emp_result.scalar_one_or_none()
                if emp:
                    msg = f"Reminder: Task '{task.title}' is due soon!"
                    await send_whatsapp_message(emp.phone, msg)
        print(f"[Scheduler] Sent reminders for {len(tasks)} tasks")


async def send_reorder_alerts():
    """Alert managers when product stock drops at or below reorder level."""
    from app.models.inventory import Inventory, Product
    from sqlalchemy.orm import selectinload
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Inventory)
            .options(selectinload(Inventory.product))
            .where(Inventory.current_stock <= Inventory.reorder_level)
        )
        low = result.scalars().all()
        if not low:
            return

        supervisors = await _get_supervisors(db)
        for item in low:
            product_name = item.product.name if item.product else "Unknown"
            msg = (
                f"Low stock alert: '{product_name}' has {float(item.current_stock)} units "
                f"(reorder level: {float(item.reorder_level)}). Please reorder."
            )
            for sup in supervisors:
                await send_whatsapp_message(sup.phone, msg)
        print(f"[Scheduler] Sent reorder alerts for {len(low)} products to {len(supervisors)} supervisors")


async def archive_old_activity_logs():
    """Move activity logs older than 90 days to archive table."""
    from datetime import timedelta
    from sqlalchemy import insert, delete, text
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(
                text(
                    "INSERT INTO activity_log_archives "
                    "(id, actor_id, actor_name, action, entity_type, entity_id, entity_name, description, created_at, archived_at) "
                    "SELECT id, actor_id, actor_name, action, entity_type, entity_id, entity_name, description, created_at, NOW() "
                    "FROM activity_logs WHERE created_at < :cutoff "
                    "ON CONFLICT (id) DO NOTHING"
                ),
                {"cutoff": cutoff},
            )
            result = await db.execute(
                text("DELETE FROM activity_logs WHERE created_at < :cutoff"), {"cutoff": cutoff}
            )
            await db.commit()
            print(f"[Scheduler] Archived old activity logs (rows deleted: {result.rowcount})")
        except Exception as e:
            print(f"[Scheduler] Archive failed: {e}")


def start_scheduler():
    scheduler.add_job(scan_overdue_tasks, "interval", hours=1, id="overdue_scanner")
    scheduler.add_job(send_task_reminders, "cron", hour=9, minute=0, id="task_reminders")
    scheduler.add_job(send_reorder_alerts, "cron", hour=8, minute=0, id="reorder_alerts")
    scheduler.add_job(archive_old_activity_logs, "cron", hour=0, minute=0, id="log_archival")
    scheduler.start()
    print("[Scheduler] Started")


def stop_scheduler():
    scheduler.shutdown()
    print("[Scheduler] Stopped")

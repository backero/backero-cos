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


def start_scheduler():
    scheduler.add_job(scan_overdue_tasks, "interval", hours=1, id="overdue_scanner")
    scheduler.add_job(send_task_reminders, "cron", hour=9, minute=0, id="task_reminders")
    scheduler.start()
    print("[Scheduler] Started")


def stop_scheduler():
    scheduler.shutdown()
    print("[Scheduler] Stopped")

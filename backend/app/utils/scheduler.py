from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.task import Notification, Task
from app.utils.notifications import send_whatsapp_message

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


async def scan_overdue_tasks():
    """Mark tasks as overdue if past due date (excludes done tasks)"""
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Task).where(
                Task.status.in_(["todo", "in_progress", "review", "pending"]),
                Task.due_date < now,
                Task.due_date.is_not(None),
            )
        )
        tasks = result.scalars().all()
        for task in tasks:
            old_status = task.status
            task.status = "overdue"
            # notify assignee
            if task.assigned_to_id:
                notif = Notification(
                    recipient_id=task.assigned_to_id,
                    type="task_overdue",
                    title="Task Overdue",
                    message=f'"{task.title}" is now overdue!',
                    task_id=task.id,
                )
                db.add(notif)
            # notify reporter
            if task.created_by_id and task.created_by_id != task.assigned_to_id:
                notif = Notification(
                    recipient_id=task.created_by_id,
                    type="task_overdue",
                    title="Task Overdue",
                    message=f'"{task.title}" is now overdue!',
                    task_id=task.id,
                )
                db.add(notif)
        await db.commit()
        print(f"[Scheduler] Marked {len(tasks)} tasks as overdue")


async def send_task_reminders():
    """Send WhatsApp reminders for tasks due in next 24h"""
    tomorrow = datetime.now(timezone.utc) + timedelta(hours=24)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Task).where(
                Task.status.in_(["todo", "in_progress", "review"]),
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
                    msg = f"Reminder: Task '{task.title}' is due in less than 24 hours!"
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

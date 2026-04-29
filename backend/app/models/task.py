import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin
from app.db.session import Base


class Task(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __table_args__ = (
        Index("ix_tasks_status_created", "status", "created_at"),
        Index("ix_tasks_assigned_status", "assigned_to_id", "status"),
    )
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    assigned_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True
    )
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
    )

    extension_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    extension_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extension_days: Mapped[int] = mapped_column(Integer, default=0)

    completion_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completion_submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Kanban ordering
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Task dependencies
    depends_on_task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )

    # Recurrence
    recurrence_type: Mapped[str] = mapped_column(String(20), default="none", nullable=False)  # none/daily/weekly/monthly
    recurrence_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recurrence_end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    parent_task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )

    assigned_to = relationship("Employee", foreign_keys=[assigned_to_id])
    created_by = relationship("Employee", foreign_keys=[created_by_id])
    department = relationship("Department")
    depends_on = relationship("Task", foreign_keys=[depends_on_task_id], remote_side="Task.id", uselist=False)
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan", order_by="TaskComment.created_at")
    attachments = relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan", order_by="TaskAttachment.created_at")
    checklist_items = relationship("TaskChecklistItem", back_populates="task", cascade="all, delete-orphan", order_by="TaskChecklistItem.position")
    time_logs = relationship("TaskTimeLog", back_populates="task", cascade="all, delete-orphan")

    @property
    def assigned_to_name(self) -> Optional[str]:
        from sqlalchemy import inspect as sa_inspect
        if "assigned_to" in sa_inspect(self).unloaded:
            return None
        return self.assigned_to.name if self.assigned_to else None

    @property
    def department_name(self) -> Optional[str]:
        from sqlalchemy import inspect as sa_inspect
        if "department" in sa_inspect(self).unloaded:
            return None
        return self.department.name if self.department else None

    @property
    def created_by_name(self) -> Optional[str]:
        from sqlalchemy import inspect as sa_inspect
        if "created_by" in sa_inspect(self).unloaded:
            return None
        return self.created_by.name if self.created_by else None

    @property
    def total_minutes(self) -> int:
        from sqlalchemy import inspect as sa_inspect
        if "time_logs" in sa_inspect(self).unloaded:
            return 0
        return sum((tl.minutes or 0) for tl in self.time_logs)

    @property
    def checklist_total(self) -> int:
        from sqlalchemy import inspect as sa_inspect
        if "checklist_items" in sa_inspect(self).unloaded:
            return 0
        return len(self.checklist_items)

    @property
    def checklist_done(self) -> int:
        from sqlalchemy import inspect as sa_inspect
        if "checklist_items" in sa_inspect(self).unloaded:
            return 0
        return sum(1 for item in self.checklist_items if item.is_done)


class TaskChecklistItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "task_checklist_items"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    task = relationship("Task", back_populates="checklist_items")


class TaskTimeLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "task_time_logs"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    task = relationship("Task", back_populates="time_logs")
    employee = relationship("Employee", foreign_keys=[employee_id])

    @property
    def employee_name(self) -> Optional[str]:
        return self.employee.name if self.employee else None


class TaskComment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "task_comments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)

    task = relationship("Task", back_populates="comments")
    employee = relationship("Employee", foreign_keys=[employee_id])

    @property
    def employee_name(self) -> Optional[str]:
        return self.employee.name if self.employee else None

    @property
    def employee_role(self) -> Optional[str]:
        return self.employee.role if self.employee else None


class TaskAttachment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "task_attachments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    filename: Mapped[str] = mapped_column(String(300), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(300), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)

    task = relationship("Task", back_populates="attachments")
    uploaded_by = relationship("Employee", foreign_keys=[uploaded_by_id])

    @property
    def uploaded_by_name(self) -> Optional[str]:
        return self.uploaded_by.name if self.uploaded_by else None


class ComplianceTask(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "compliance_tasks"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recurrence: Mapped[str] = mapped_column(String(20), default="monthly", nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="gst", nullable=False)


class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

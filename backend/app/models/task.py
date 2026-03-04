import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.mixins import TimestampMixin, UUIDMixin
from app.db.session import Base


class Task(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)  # low/medium/high/urgent
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending/in_progress/completed/overdue
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

    assigned_to = relationship("Employee", foreign_keys=[assigned_to_id])
    created_by = relationship("Employee", foreign_keys=[created_by_id])


class ComplianceTask(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "compliance_tasks"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recurrence: Mapped[str] = mapped_column(String(20), default="monthly", nullable=False)  # monthly/quarterly/annual
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="gst", nullable=False)  # gst/tds/roc/other

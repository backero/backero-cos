import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.mixins import TimestampMixin, UUIDMixin
from app.db.session import Base


class PayrollRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payroll_records"
    __table_args__ = (
        Index("ix_payroll_employee_month", "employee_id", "month", "year"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    month: Mapped[int] = mapped_column(nullable=False)
    year: Mapped[int] = mapped_column(nullable=False)

    working_days: Mapped[int] = mapped_column(default=0)
    present_days: Mapped[int] = mapped_column(default=0)
    paid_leave_days: Mapped[int] = mapped_column(default=0)
    half_days: Mapped[int] = mapped_column(default=0)

    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    pf_employee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    pf_employer: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    esi_employee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    esi_employer: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tds: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    payment_mode: Mapped[str] = mapped_column(String(30), default="bank")
    payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/approved/paid
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    employee = relationship("Employee", foreign_keys=[employee_id])

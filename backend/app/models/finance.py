import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.mixins import TimestampMixin, UUIDMixin
from app.db.session import Base


class Invoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Customer
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    customer_gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Amounts
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    igst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    is_gst: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending/paid/overdue/cancelled
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True
    )

    items: Mapped[list["InvoiceItem"]] = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    created_by = relationship("Employee", foreign_keys=[created_by_id])


class InvoiceItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 3), default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=18)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    invoice: Mapped[Invoice] = relationship("Invoice", back_populates="items")


class AccountEntry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "account_entries"

    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # income/expense
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(30), default="cash")  # cash/bank/upi/cheque
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True
    )
    created_by = relationship("Employee", foreign_keys=[created_by_id])

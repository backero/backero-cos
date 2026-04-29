import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin
from app.db.session import Base


class Product(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __table_args__ = (
        Index("ix_products_category_active", "category", "is_active"),
    )
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="pcs")
    mrp: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cost_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=18)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    inventory: Mapped[Optional["Inventory"]] = relationship("Inventory", back_populates="product", uselist=False)


class Inventory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "inventory"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), unique=True, nullable=False
    )
    current_stock: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    reserved_stock: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    reorder_level: Mapped[float] = mapped_column(Numeric(12, 3), default=10)
    max_stock: Mapped[float] = mapped_column(Numeric(12, 3), default=1000)

    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    product: Mapped[Product] = relationship("Product", back_populates="inventory")


class RawMaterial(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "raw_materials"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="kg")
    current_stock: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    reorder_level: Mapped[float] = mapped_column(Numeric(12, 3), default=5)
    cost_per_unit: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    supplier: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class ProductionBatch(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "production_batches"

    batch_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    planned_quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    produced_quantity: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    status: Mapped[str] = mapped_column(String(20), default="planned", nullable=False)  # planned/in_progress/completed/rejected
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    product = relationship("Product", foreign_keys=[product_id])


class PlatformOrder(Base, UUIDMixin, TimestampMixin):
    __table_args__ = (
        Index("ix_platform_orders_platform_date", "platform", "order_date"),
    )
    __tablename__ = "platform_orders"

    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # amazon/flipkart/meesho/website/offline
    order_id: Mapped[str] = mapped_column(String(100), nullable=False)
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=True
    )
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/shipped/delivered/returned/cancelled
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    tracking_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status_history: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)

    product = relationship("Product", foreign_keys=[product_id])

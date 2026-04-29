from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProductCreate(BaseModel):
    name: str
    sku: str
    category: Optional[str] = None
    description: Optional[str] = None
    unit: str = "pcs"
    mrp: float = 0
    cost_price: float = 0
    gst_rate: float = 18
    hsn_code: Optional[str] = None
    reorder_level: float = 10
    max_stock: float = 1000


class StockAdjust(BaseModel):
    quantity: float
    reason: str


class RawMaterialCreate(BaseModel):
    name: str
    unit: str = "kg"
    current_stock: float = 0
    reorder_level: float = 5
    cost_per_unit: float = 0
    supplier: Optional[str] = None
    notes: Optional[str] = None


class BatchCreate(BaseModel):
    batch_number: str
    product_id: str
    planned_quantity: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None


class PlatformOrderCreate(BaseModel):
    platform: str
    order_id: str
    product_id: Optional[str] = None
    product_name: str
    quantity: float
    amount: float
    status: str = "pending"
    order_date: date


class ProductResponse(BaseModel):
    id: UUID
    name: str
    sku: str
    category: Optional[str] = None
    description: Optional[str] = None
    unit: str
    mrp: float
    cost_price: float
    gst_rate: float
    hsn_code: Optional[str] = None
    is_active: bool
    image_url: Optional[str] = None
    current_stock: float
    reserved_stock: float
    reorder_level: float
    max_stock: float
    is_low_stock: bool


class RawMaterialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    unit: str
    current_stock: float
    reorder_level: float
    cost_per_unit: float
    supplier: Optional[str] = None
    notes: Optional[str] = None
    is_low_stock: bool = False


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    batch_number: str
    product_id: UUID
    planned_quantity: float
    produced_quantity: float
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime


class PlatformOrderStatusUpdate(BaseModel):
    status: str
    tracking_number: Optional[str] = None
    note: Optional[str] = None


class PlatformOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    platform: str
    order_id: str
    product_name: str
    quantity: float
    amount: float
    status: str
    order_date: date
    tracking_number: Optional[str] = None
    status_history: Optional[list] = None
    is_returned: bool = False
    return_reason: Optional[str] = None

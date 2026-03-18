from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class InvoiceItemCreate(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float
    gst_rate: float = 18


class InvoiceCreate(BaseModel):
    invoice_number: str
    invoice_date: date
    due_date: Optional[date] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_gstin: Optional[str] = None
    is_gst: bool = True
    notes: Optional[str] = None
    items: list[InvoiceItemCreate]


class EntryCreate(BaseModel):
    date: date
    type: str
    category: str
    description: str
    amount: float
    payment_mode: str = "cash"
    reference: Optional[str] = None


class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    description: str
    quantity: float
    unit_price: float
    gst_rate: float
    amount: float


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    invoice_number: str
    invoice_date: date
    due_date: Optional[date] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_gstin: Optional[str] = None
    subtotal: float
    cgst: float
    sgst: float
    igst: float
    total: float
    is_gst: bool
    status: str
    notes: Optional[str] = None
    items: list[InvoiceItemResponse] = []
    created_at: datetime


class EntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    date: date
    type: str
    category: str
    description: str
    amount: float
    payment_mode: str
    reference: Optional[str] = None
    created_at: datetime


class FinanceSummaryResponse(BaseModel):
    income: float
    expense: float
    net: float
    invoices: dict

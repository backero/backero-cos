import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db
from app.models.finance import AccountEntry, Invoice, InvoiceItem

router = APIRouter()


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
    type: str  # income/expense
    category: str
    description: str
    amount: float
    payment_mode: str = "cash"
    reference: Optional[str] = None


@router.get("/invoices")
async def list_invoices(
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(Invoice).options(selectinload(Invoice.items))
    if status:
        query = query.where(Invoice.status == status)
    if from_date:
        query = query.where(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.where(Invoice.invoice_date <= to_date)
    query = query.order_by(Invoice.invoice_date.desc())
    result = await db.execute(query)
    return [_invoice_dict(inv) for inv in result.scalars()]


@router.post("/invoices")
async def create_invoice(body: InvoiceCreate, current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    inv = Invoice(
        invoice_number=body.invoice_number,
        invoice_date=body.invoice_date,
        due_date=body.due_date,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_email=body.customer_email,
        customer_address=body.customer_address,
        customer_gstin=body.customer_gstin,
        is_gst=body.is_gst,
        notes=body.notes,
        created_by_id=current_user.id,
    )

    subtotal = 0.0
    cgst = sgst = igst = 0.0
    for item_data in body.items:
        amount = item_data.quantity * item_data.unit_price
        subtotal += amount
        if body.is_gst:
            half_gst = amount * item_data.gst_rate / 200
            cgst += half_gst
            sgst += half_gst
        item = InvoiceItem(
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            gst_rate=item_data.gst_rate,
            amount=amount,
        )
        inv.items.append(item)

    inv.subtotal = subtotal
    inv.cgst = cgst
    inv.sgst = sgst
    inv.igst = igst
    inv.total = subtotal + cgst + sgst + igst

    db.add(inv)
    await db.flush()
    return _invoice_dict(inv)


@router.patch("/invoices/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    status: str,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Invoice).where(Invoice.id == uuid.UUID(invoice_id)))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv.status = status
    return _invoice_dict(inv)


@router.get("/entries")
async def list_entries(
    type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(AccountEntry)
    if type:
        query = query.where(AccountEntry.type == type)
    if from_date:
        query = query.where(AccountEntry.date >= from_date)
    if to_date:
        query = query.where(AccountEntry.date <= to_date)
    query = query.order_by(AccountEntry.date.desc())
    result = await db.execute(query)
    return [_entry_dict(e) for e in result.scalars()]


@router.post("/entries")
async def create_entry(body: EntryCreate, current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    entry = AccountEntry(
        date=body.date,
        type=body.type,
        category=body.category,
        description=body.description,
        amount=body.amount,
        payment_mode=body.payment_mode,
        reference=body.reference,
        created_by_id=current_user.id,
    )
    db.add(entry)
    await db.flush()
    return _entry_dict(entry)


@router.get("/summary")
async def finance_summary(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    entry_query = select(
        AccountEntry.type,
        func.sum(AccountEntry.amount).label("total"),
    ).group_by(AccountEntry.type)
    if from_date:
        entry_query = entry_query.where(AccountEntry.date >= from_date)
    if to_date:
        entry_query = entry_query.where(AccountEntry.date <= to_date)

    result = await db.execute(entry_query)
    rows = result.all()
    totals = {r.type: float(r.total) for r in rows}

    invoice_query = select(
        Invoice.status,
        func.sum(Invoice.total).label("total"),
        func.count().label("count"),
    ).group_by(Invoice.status)
    inv_result = await db.execute(invoice_query)
    invoice_stats = {r.status: {"total": float(r.total), "count": r.count} for r in inv_result.all()}

    return {
        "income": totals.get("income", 0),
        "expense": totals.get("expense", 0),
        "net": totals.get("income", 0) - totals.get("expense", 0),
        "invoices": invoice_stats,
    }


def _invoice_dict(inv: Invoice) -> dict:
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date.isoformat(),
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "customer_name": inv.customer_name,
        "customer_phone": inv.customer_phone,
        "customer_email": inv.customer_email,
        "customer_address": inv.customer_address,
        "customer_gstin": inv.customer_gstin,
        "subtotal": float(inv.subtotal),
        "cgst": float(inv.cgst),
        "sgst": float(inv.sgst),
        "igst": float(inv.igst),
        "total": float(inv.total),
        "is_gst": inv.is_gst,
        "status": inv.status,
        "notes": inv.notes,
        "items": [_item_dict(i) for i in (inv.items or [])],
        "created_at": inv.created_at.isoformat(),
    }


def _item_dict(item: InvoiceItem) -> dict:
    return {
        "id": str(item.id),
        "description": item.description,
        "quantity": float(item.quantity),
        "unit_price": float(item.unit_price),
        "gst_rate": float(item.gst_rate),
        "amount": float(item.amount),
    }


def _entry_dict(entry: AccountEntry) -> dict:
    return {
        "id": str(entry.id),
        "date": entry.date.isoformat(),
        "type": entry.type,
        "category": entry.category,
        "description": entry.description,
        "amount": float(entry.amount),
        "payment_mode": entry.payment_mode,
        "reference": entry.reference,
        "created_at": entry.created_at.isoformat(),
    }

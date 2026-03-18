import uuid
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .model import AccountEntry, Invoice, InvoiceItem
from .schema import (
    EntryCreate,
    EntryResponse,
    FinanceSummaryResponse,
    InvoiceCreate,
    InvoiceResponse,
)


async def list_invoices(
    db: AsyncSession,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[InvoiceResponse]:
    query = select(Invoice).options(selectinload(Invoice.items))
    if status:
        query = query.where(Invoice.status == status)
    if from_date:
        query = query.where(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.where(Invoice.invoice_date <= to_date)
    query = query.order_by(Invoice.invoice_date.desc())
    result = await db.execute(query)
    return [InvoiceResponse.model_validate(inv) for inv in result.scalars()]


async def create_invoice(
    db: AsyncSession, body: InvoiceCreate, created_by_id: uuid.UUID
) -> InvoiceResponse:
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
        created_by_id=created_by_id,
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
    return InvoiceResponse.model_validate(inv)


async def update_invoice_status(
    db: AsyncSession, invoice_id: str, status: str
) -> InvoiceResponse:
    result = await db.execute(select(Invoice).where(Invoice.id == uuid.UUID(invoice_id)))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv.status = status
    return InvoiceResponse.model_validate(inv)


async def list_entries(
    db: AsyncSession,
    type: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[EntryResponse]:
    query = select(AccountEntry)
    if type:
        query = query.where(AccountEntry.type == type)
    if from_date:
        query = query.where(AccountEntry.date >= from_date)
    if to_date:
        query = query.where(AccountEntry.date <= to_date)
    query = query.order_by(AccountEntry.date.desc())
    result = await db.execute(query)
    return [EntryResponse.model_validate(e) for e in result.scalars()]


async def create_entry(
    db: AsyncSession, body: EntryCreate, created_by_id: uuid.UUID
) -> EntryResponse:
    entry = AccountEntry(
        date=body.date,
        type=body.type,
        category=body.category,
        description=body.description,
        amount=body.amount,
        payment_mode=body.payment_mode,
        reference=body.reference,
        created_by_id=created_by_id,
    )
    db.add(entry)
    await db.flush()
    return EntryResponse.model_validate(entry)


async def finance_summary(
    db: AsyncSession,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> FinanceSummaryResponse:
    entry_query = select(
        AccountEntry.type,
        func.sum(AccountEntry.amount).label("total"),
    ).group_by(AccountEntry.type)
    if from_date:
        entry_query = entry_query.where(AccountEntry.date >= from_date)
    if to_date:
        entry_query = entry_query.where(AccountEntry.date <= to_date)

    result = await db.execute(entry_query)
    totals = {r.type: float(r.total) for r in result.all()}

    invoice_query = select(
        Invoice.status,
        func.sum(Invoice.total).label("total"),
        func.count().label("count"),
    ).group_by(Invoice.status)
    inv_result = await db.execute(invoice_query)
    invoice_stats = {r.status: {"total": float(r.total), "count": r.count} for r in inv_result.all()}

    return FinanceSummaryResponse(
        income=totals.get("income", 0),
        expense=totals.get("expense", 0),
        net=totals.get("income", 0) - totals.get("expense", 0),
        invoices=invoice_stats,
    )

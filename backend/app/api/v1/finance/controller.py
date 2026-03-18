from datetime import date
from typing import Optional

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db

from . import service
from .schema import (
    EntryCreate,
    EntryResponse,
    FinanceSummaryResponse,
    InvoiceCreate,
    InvoiceResponse,
)


async def list_invoices(
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[InvoiceResponse]:
    return await service.list_invoices(db, status, from_date, to_date)


async def create_invoice(
    body: InvoiceCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> InvoiceResponse:
    return await service.create_invoice(db, body, current_user.id)


async def update_invoice_status(
    invoice_id: str,
    status: str,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> InvoiceResponse:
    return await service.update_invoice_status(db, invoice_id, status)


async def list_entries(
    type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[EntryResponse]:
    return await service.list_entries(db, type, from_date, to_date)


async def create_entry(
    body: EntryCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> EntryResponse:
    return await service.create_entry(db, body, current_user.id)


async def finance_summary(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> FinanceSummaryResponse:
    return await service.finance_summary(db, from_date, to_date)

from datetime import date
from typing import Optional

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import PaginatedResponse
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
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> PaginatedResponse[InvoiceResponse]:
    return await service.list_invoices(db, status, from_date, to_date, search, page, limit)


async def create_invoice(
    body: InvoiceCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> InvoiceResponse:
    return await service.create_invoice(db, body, current_user.id, current_user.name)


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
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> PaginatedResponse[EntryResponse]:
    return await service.list_entries(db, type, from_date, to_date, search, page, limit)


async def create_entry(
    body: EntryCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> EntryResponse:
    return await service.create_entry(db, body, current_user.id, current_user.name)


async def finance_summary(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> FinanceSummaryResponse:
    return await service.finance_summary(db, from_date, to_date)


async def download_invoice_pdf(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    return await service.generate_invoice_pdf(db, invoice_id)

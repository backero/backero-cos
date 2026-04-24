from datetime import date
from typing import Optional

from fastapi import Depends, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db
from app.utils import excel as xl
from app.utils.pdf import generate_invoice_pdf

from . import service
from .schema import (
    EntryCreate,
    EntryResponse,
    FinanceSummaryResponse,
    InvoiceCreate,
    InvoiceResponse,
)

_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


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


async def get_invoice_pdf(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    inv = await service.get_invoice(db, invoice_id)
    pdf_bytes = generate_invoice_pdf(inv.model_dump())
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice-{inv.invoice_number}.pdf"},
    )


async def export_invoices(
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    invoices = await service.list_invoices(db, status, from_date, to_date)
    data = xl.export_invoices([i.model_dump() for i in invoices])
    return Response(content=data, media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=invoices.xlsx"})


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


async def export_entries(
    type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    entries = await service.list_entries(db, type, from_date, to_date)
    data = xl.export_entries([e.model_dump() for e in entries])
    return Response(content=data, media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=finance_entries.xlsx"})


async def entries_sample():
    return Response(content=xl.entries_sample(), media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=entries_sample.xlsx"})


async def import_entries(
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    contents = await file.read()
    rows, errors = xl.parse_entries(contents)
    created, skipped = [], []
    for row in rows:
        try:
            await service.create_entry(db, EntryCreate(**row), current_user.id)
            created.append(row["description"])
            await db.commit()
        except Exception as e:
            skipped.append(f"{row.get('description', '?')}: {str(e)}")
    return {"created": len(created), "skipped": len(skipped), "errors": errors + skipped}

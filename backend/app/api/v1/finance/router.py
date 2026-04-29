from fastapi import APIRouter

from app.api.v1.schemas import PaginatedResponse
from . import controller
from .schema import EntryResponse, FinanceSummaryResponse, InvoiceResponse

router = APIRouter()

router.get("/invoices", response_model=PaginatedResponse[InvoiceResponse])(controller.list_invoices)
router.post("/invoices", response_model=InvoiceResponse)(controller.create_invoice)
router.get("/invoices/{invoice_id}/pdf")(controller.download_invoice_pdf)
router.patch("/invoices/{invoice_id}/status", response_model=InvoiceResponse)(controller.update_invoice_status)
router.get("/entries", response_model=PaginatedResponse[EntryResponse])(controller.list_entries)
router.post("/entries", response_model=EntryResponse)(controller.create_entry)
router.get("/summary", response_model=FinanceSummaryResponse)(controller.finance_summary)

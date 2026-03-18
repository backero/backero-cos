from fastapi import APIRouter

from . import controller
from .schema import EntryResponse, FinanceSummaryResponse, InvoiceResponse

router = APIRouter()

router.get("/invoices", response_model=list[InvoiceResponse])(controller.list_invoices)
router.post("/invoices", response_model=InvoiceResponse)(controller.create_invoice)
router.patch("/invoices/{invoice_id}/status", response_model=InvoiceResponse)(controller.update_invoice_status)
router.get("/entries", response_model=list[EntryResponse])(controller.list_entries)
router.post("/entries", response_model=EntryResponse)(controller.create_entry)
router.get("/summary", response_model=FinanceSummaryResponse)(controller.finance_summary)

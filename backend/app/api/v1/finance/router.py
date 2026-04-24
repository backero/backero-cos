from fastapi import APIRouter

from . import controller
from .schema import EntryResponse, FinanceSummaryResponse, InvoiceResponse

router = APIRouter()

router.get("/invoices", response_model=list[InvoiceResponse])(controller.list_invoices)
router.post("/invoices", response_model=InvoiceResponse)(controller.create_invoice)
router.get("/invoices/export")(controller.export_invoices)
router.get("/invoices/{invoice_id}/pdf")(controller.get_invoice_pdf)
router.patch("/invoices/{invoice_id}/status", response_model=InvoiceResponse)(controller.update_invoice_status)

router.get("/entries", response_model=list[EntryResponse])(controller.list_entries)
router.post("/entries", response_model=EntryResponse)(controller.create_entry)
router.get("/entries/export")(controller.export_entries)
router.get("/entries/sample")(controller.entries_sample)
router.post("/entries/import")(controller.import_entries)

router.get("/summary", response_model=FinanceSummaryResponse)(controller.finance_summary)

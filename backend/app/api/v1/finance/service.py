import uuid
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.schemas import PaginatedResponse
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
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> PaginatedResponse[InvoiceResponse]:
    query = select(Invoice).options(selectinload(Invoice.items))
    if status:
        query = query.where(Invoice.status == status)
    if from_date:
        query = query.where(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.where(Invoice.invoice_date <= to_date)
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(Invoice.customer_name.ilike(term), Invoice.invoice_number.ilike(term))
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Invoice.invoice_date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    items = [InvoiceResponse.model_validate(inv) for inv in result.scalars()]
    return PaginatedResponse.build(items, total, page, limit)


async def create_invoice(
    db: AsyncSession, body: InvoiceCreate, created_by_id: uuid.UUID, actor_name: str = "User"
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

    from app.utils.activity import log as activity_log
    await activity_log(
        db,
        actor_id=created_by_id,
        actor_name=actor_name,
        action="create",
        entity_type="invoice",
        entity_id=str(inv.id),
        entity_name=inv.invoice_number,
        description=f"{actor_name} created invoice {inv.invoice_number} for {inv.customer_name} — ₹{float(inv.total):,.2f}",
    )

    return InvoiceResponse.model_validate(inv)


async def get_invoice(db: AsyncSession, invoice_id: str) -> InvoiceResponse:
    from fastapi import HTTPException
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.items)).where(Invoice.id == uuid.UUID(invoice_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
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
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> PaginatedResponse[EntryResponse]:
    query = select(AccountEntry)
    if type:
        query = query.where(AccountEntry.type == type)
    if from_date:
        query = query.where(AccountEntry.date >= from_date)
    if to_date:
        query = query.where(AccountEntry.date <= to_date)
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(AccountEntry.description.ilike(term), AccountEntry.category.ilike(term))
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(AccountEntry.date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    items = [EntryResponse.model_validate(e) for e in result.scalars()]
    return PaginatedResponse.build(items, total, page, limit)


async def create_entry(
    db: AsyncSession, body: EntryCreate, created_by_id: uuid.UUID, actor_name: str = "User"
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

    from app.utils.activity import log as activity_log
    await activity_log(
        db,
        actor_id=created_by_id,
        actor_name=actor_name,
        action="create",
        entity_type="entry",
        entity_id=str(entry.id),
        entity_name=body.description,
        description=f"{actor_name} recorded {body.type} entry '{body.description}' — ₹{float(body.amount):,.2f} via {body.payment_mode}",
    )

    return EntryResponse.model_validate(entry)


async def generate_invoice_pdf(db: AsyncSession, invoice_id: str):
    """Generate a professional PDF invoice with company branding."""
    import io
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.items)).where(Invoice.id == uuid.UUID(invoice_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=15*mm, bottomMargin=20*mm, leftMargin=15*mm, rightMargin=15*mm)

    styles = getSampleStyleSheet()
    navy = colors.HexColor("#1E3A5F")
    green = colors.HexColor("#16A34A")
    light_gray = colors.HexColor("#F8FAFC")
    border_gray = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle("title", parent=styles["Normal"], fontSize=22, textColor=navy, fontName="Helvetica-Bold", spaceAfter=2)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#64748B"))
    label_style = ParagraphStyle("label", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748B"), fontName="Helvetica-Bold")
    value_style = ParagraphStyle("value", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#0F172A"))
    right_style = ParagraphStyle("right", parent=styles["Normal"], fontSize=9, alignment=TA_RIGHT)
    total_style = ParagraphStyle("total", parent=styles["Normal"], fontSize=13, fontName="Helvetica-Bold", textColor=navy, alignment=TA_RIGHT)

    story = []

    # ── Header ──
    header_data = [[
        [Paragraph("BACKERO", title_style), Paragraph("Backero Private Limited", sub_style), Paragraph("backero.in | founder@backero.in", sub_style)],
        [Paragraph("INVOICE", ParagraphStyle("inv", parent=styles["Normal"], fontSize=28, textColor=navy, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
         Paragraph(f"# {inv.invoice_number}", ParagraphStyle("invnum", parent=styles["Normal"], fontSize=10, textColor=green, alignment=TA_RIGHT, fontName="Helvetica-Bold"))],
    ]]
    header_table = Table(header_data, colWidths=[95*mm, 85*mm])
    header_table.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 0), ("RIGHTPADDING", (0,0), (-1,-1), 0)]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=2, color=navy, spaceAfter=6))

    # ── Bill To / Invoice Details ──
    status_color = green if inv.status == "paid" else colors.HexColor("#F97316") if inv.status == "pending" else colors.red
    detail_data = [[
        [Paragraph("BILL TO", label_style), Spacer(1, 2),
         Paragraph(inv.customer_name, ParagraphStyle("cn", parent=styles["Normal"], fontSize=11, fontName="Helvetica-Bold", textColor=navy)),
         Paragraph(inv.customer_phone or "", value_style),
         Paragraph(inv.customer_email or "", value_style),
         Paragraph(inv.customer_address or "", value_style),
         Paragraph(f"GSTIN: {inv.customer_gstin}" if inv.customer_gstin else "", value_style)],
        [Paragraph("Date:", label_style), Paragraph(str(inv.invoice_date), value_style), Spacer(1,4),
         Paragraph("Due Date:", label_style), Paragraph(str(inv.due_date) if inv.due_date else "On Receipt", value_style), Spacer(1,4),
         Paragraph("Status:", label_style), Paragraph(inv.status.upper(), ParagraphStyle("stat", parent=styles["Normal"], fontSize=9, textColor=status_color, fontName="Helvetica-Bold"))],
    ]]
    detail_table = Table(detail_data, colWidths=[110*mm, 70*mm])
    detail_table.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 0), ("RIGHTPADDING", (0,0), (-1,-1), 0)]))
    story.append(Spacer(1, 4*mm))
    story.append(detail_table)
    story.append(Spacer(1, 5*mm))

    # ── Line Items Table ──
    item_header = ["#", "Description", "Qty", "Unit Price (₹)", "GST %", "Amount (₹)"]
    item_rows = [item_header]
    for idx, item in enumerate(inv.items, 1):
        item_rows.append([
            str(idx),
            item.description,
            f"{float(item.quantity):g}",
            f"{float(item.unit_price):,.2f}",
            f"{float(item.gst_rate)}%",
            f"{float(item.amount):,.2f}",
        ])

    col_widths = [10*mm, 75*mm, 15*mm, 27*mm, 17*mm, 27*mm]
    items_table = Table(item_rows, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), navy),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,0), 9),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("ALIGN", (1,1), (1,-1), "LEFT"),
        ("ALIGN", (3,1), (5,-1), "RIGHT"),
        ("FONTSIZE", (0,1), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, light_gray]),
        ("GRID", (0,0), (-1,-1), 0.5, border_gray),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 4*mm))

    # ── Totals ──
    totals_data = [
        ["Subtotal:", f"₹ {float(inv.subtotal):,.2f}"],
        ["CGST:", f"₹ {float(inv.cgst):,.2f}"],
        ["SGST:", f"₹ {float(inv.sgst):,.2f}"],
        ["IGST:", f"₹ {float(inv.igst):,.2f}"],
    ]
    if float(inv.cgst) == 0 and float(inv.sgst) == 0:
        totals_data = [r for r in totals_data if r[0] not in ("CGST:", "SGST:")]
    if float(inv.igst) == 0:
        totals_data = [r for r in totals_data if r[0] != "IGST:"]

    totals_table_data = [[Paragraph(r[0], right_style), Paragraph(r[1], right_style)] for r in totals_data]
    totals_table_data.append([
        Paragraph("<b>TOTAL</b>", ParagraphStyle("totl", parent=styles["Normal"], fontSize=12, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=navy)),
        Paragraph(f"<b>₹ {float(inv.total):,.2f}</b>", ParagraphStyle("totlv", parent=styles["Normal"], fontSize=12, fontName="Helvetica-Bold", alignment=TA_RIGHT, textColor=navy)),
    ])

    totals_wrapper = Table([[Table(totals_table_data, colWidths=[60*mm, 40*mm])]], colWidths=[180*mm])
    totals_wrapper.setStyle(TableStyle([("ALIGN", (0,0), (-1,-1), "RIGHT")]))
    story.append(totals_wrapper)

    # ── Notes ──
    if inv.notes:
        story.append(Spacer(1, 4*mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=border_gray))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph("Notes:", label_style))
        story.append(Paragraph(inv.notes, value_style))

    # ── Signature ──
    story.append(Spacer(1, 10*mm))
    sig_data = [[
        [Paragraph("Bank Details", label_style), Spacer(1,2),
         Paragraph("Bank: HDFC Bank", value_style),
         Paragraph("A/C: 50200012345678", value_style),
         Paragraph("IFSC: HDFC0001234", value_style),
         Paragraph("Branch: Coimbatore", value_style)],
        [Paragraph("For Backero Private Limited", ParagraphStyle("sigco", parent=styles["Normal"], fontSize=9, textColor=navy, alignment=TA_RIGHT, fontName="Helvetica-Bold")),
         Spacer(1, 14*mm),
         HRFlowable(width=50*mm, thickness=0.5, color=navy),
         Paragraph("Authorised Signatory", ParagraphStyle("signame", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748B"), alignment=TA_RIGHT))],
    ]]
    sig_table = Table(sig_data, colWidths=[100*mm, 80*mm])
    sig_table.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "BOTTOM"), ("LEFTPADDING", (0,0), (-1,-1), 0)]))
    story.append(sig_table)

    # ── Footer ──
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=navy))
    story.append(Paragraph("Thank you for your business! — backero.in", ParagraphStyle("footer", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER, spaceBefore=3)))

    doc.build(story)
    buf.seek(0)
    filename = f"Invoice_{inv.invoice_number}.pdf"
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


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

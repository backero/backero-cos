import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_BRAND = colors.HexColor("#1E3A5F")
_ACCENT = colors.HexColor("#2D6A4F")
_LIGHT = colors.HexColor("#F8FAFC")
_BORDER = colors.HexColor("#E2E8F0")
_TEXT = colors.HexColor("#1E293B")
_MUTED = colors.HexColor("#64748B")


def _style(name="Normal", **kwargs):
    styles = getSampleStyleSheet()
    base = styles["Normal"]
    s = ParagraphStyle(name, parent=base, **kwargs)
    return s


def generate_invoice_pdf(inv: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )
    story = []

    h1 = _style("h1", fontSize=20, textColor=_BRAND, fontName="Helvetica-Bold", spaceAfter=2)
    h2 = _style("h2", fontSize=11, textColor=_BRAND, fontName="Helvetica-Bold")
    body = _style("body", fontSize=9, textColor=_TEXT, leading=14)
    muted = _style("muted", fontSize=8, textColor=_MUTED, leading=12)
    right = _style("right", fontSize=9, textColor=_TEXT, alignment=2)
    bold_right = _style("br", fontSize=10, textColor=_TEXT, fontName="Helvetica-Bold", alignment=2)
    big_total = _style("bt", fontSize=13, textColor=_BRAND, fontName="Helvetica-Bold", alignment=2)

    # ── Header: Company + Invoice tag ────────────────────────────────────────
    header_data = [
        [
            Paragraph("BACKERO PRIVATE LIMITED", h1),
            Paragraph(
                f"<b>INVOICE</b><br/><font color='grey' size='8'>#{inv.get('invoice_number', '')}</font>",
                _style("ir", fontSize=18, textColor=_BRAND, fontName="Helvetica-Bold", alignment=2),
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[100 * mm, 75 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Paragraph("Cosmetics & Personal Care | GSTIN: 22AAAAA0000A1Z5", muted))
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=_BRAND))
    story.append(Spacer(1, 4 * mm))

    # ── Invoice meta + Customer side by side ─────────────────────────────────
    invoice_date = inv.get("invoice_date", "")
    due_date = inv.get("due_date", "") or "—"
    cust_name = inv.get("customer_name", "")
    cust_phone = inv.get("customer_phone", "") or ""
    cust_email = inv.get("customer_email", "") or ""
    cust_addr = inv.get("customer_address", "") or ""
    cust_gstin = inv.get("customer_gstin", "") or "—"

    meta_data = [
        [
            Paragraph("<b>BILL TO</b>", _style("bt2", fontSize=8, textColor=_MUTED, fontName="Helvetica-Bold")),
            Paragraph("", body),
            Paragraph("<b>INVOICE DETAILS</b>", _style("bt3", fontSize=8, textColor=_MUTED, fontName="Helvetica-Bold")),
        ],
        [
            Paragraph(f"<b>{cust_name}</b>", _style("cn", fontSize=10, textColor=_TEXT, fontName="Helvetica-Bold")),
            "",
            Paragraph(f"Date: {invoice_date}", body),
        ],
        [
            Paragraph(cust_phone + (" | " + cust_email if cust_email else ""), muted),
            "",
            Paragraph(f"Due: {due_date}", body),
        ],
        [
            Paragraph(cust_addr, muted) if cust_addr else Paragraph("", muted),
            "",
            Paragraph(f"Status: <b>{inv.get('status', 'pending').upper()}</b>", body),
        ],
        [
            Paragraph(f"GSTIN: {cust_gstin}", muted),
            "",
            Paragraph(f"GST Invoice: {'Yes' if inv.get('is_gst') else 'No'}", muted),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[90 * mm, 10 * mm, 75 * mm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("BACKGROUND", (0, 0), (0, -1), _LIGHT),
        ("BACKGROUND", (2, 0), (2, -1), _LIGHT),
        ("BOX", (0, 0), (0, -1), 0.5, _BORDER),
        ("BOX", (2, 0), (2, -1), 0.5, _BORDER),
        ("LEFTPADDING", (0, 0), (0, -1), 6),
        ("LEFTPADDING", (2, 0), (2, -1), 6),
        ("RIGHTPADDING", (0, 0), (0, -1), 6),
        ("RIGHTPADDING", (2, 0), (2, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6 * mm))

    # ── Line Items Table ─────────────────────────────────────────────────────
    items = inv.get("items", [])
    is_gst = inv.get("is_gst", True)

    if is_gst:
        item_headers = ["#", "Description", "Qty", "Unit Price", "GST %", "GST Amt", "Total"]
        col_widths = [8 * mm, 65 * mm, 15 * mm, 22 * mm, 15 * mm, 20 * mm, 22 * mm]
    else:
        item_headers = ["#", "Description", "Qty", "Unit Price", "Total"]
        col_widths = [8 * mm, 85 * mm, 18 * mm, 27 * mm, 27 * mm]

    item_data = [item_headers]
    for idx, item in enumerate(items, 1):
        qty = float(item.get("quantity", 0))
        unit_price = float(item.get("unit_price", 0))
        gst_rate = float(item.get("gst_rate", 0))
        line_amt = qty * unit_price
        line_gst = line_amt * gst_rate / 100 if is_gst else 0

        if is_gst:
            item_data.append([
                str(idx),
                item.get("description", ""),
                f"{qty:.2f}",
                f"₹{unit_price:,.2f}",
                f"{gst_rate:.0f}%",
                f"₹{line_gst:,.2f}",
                f"₹{line_amt + line_gst:,.2f}",
            ])
        else:
            item_data.append([
                str(idx),
                item.get("description", ""),
                f"{qty:.2f}",
                f"₹{unit_price:,.2f}",
                f"₹{line_amt:,.2f}",
            ])

    item_table = Table(item_data, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), _BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.4, _BORDER),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (1, 0), (1, -1), 4),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 4 * mm))

    # ── Totals ────────────────────────────────────────────────────────────────
    subtotal = float(inv.get("subtotal", 0))
    cgst = float(inv.get("cgst", 0))
    sgst = float(inv.get("sgst", 0))
    igst = float(inv.get("igst", 0))
    total = float(inv.get("total", 0))

    totals_rows = [
        ["Subtotal", f"₹{subtotal:,.2f}"],
    ]
    if is_gst:
        if cgst > 0:
            totals_rows.append(["CGST", f"₹{cgst:,.2f}"])
        if sgst > 0:
            totals_rows.append(["SGST", f"₹{sgst:,.2f}"])
        if igst > 0:
            totals_rows.append(["IGST", f"₹{igst:,.2f}"])
    totals_rows.append(["TOTAL", f"₹{total:,.2f}"])

    totals_table_data = [[Paragraph(r[0], muted), Paragraph(r[1], right)] for r in totals_rows[:-1]]
    totals_table_data.append([
        Paragraph("<b>GRAND TOTAL</b>", _style("gt", fontSize=11, textColor=_BRAND, fontName="Helvetica-Bold")),
        Paragraph(f"<b>₹{total:,.2f}</b>", _style("gv", fontSize=12, textColor=_BRAND, fontName="Helvetica-Bold", alignment=2)),
    ])

    totals_wrapper = Table(
        [[Table(
            [["", ""]] + [[Paragraph("", body), Paragraph("", body)] for _ in range(3)],
            colWidths=[95 * mm, None],
        ), Table(totals_table_data, colWidths=[40 * mm, 40 * mm])]],
        colWidths=[97 * mm, 80 * mm],
    )
    totals_inner = Table(totals_table_data, colWidths=[40 * mm, 40 * mm])
    totals_inner.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, -2), (-1, -2), 0.5, _BORDER),
        ("LINEABOVE", (0, -1), (-1, -1), 1, _BRAND),
        ("BACKGROUND", (0, -1), (-1, -1), _LIGHT),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))

    right_block = Table([[totals_inner]], colWidths=[85 * mm])
    full_totals = Table([[Paragraph("", body), right_block]], colWidths=[95 * mm, 85 * mm])
    story.append(full_totals)

    # ── Notes ─────────────────────────────────────────────────────────────────
    notes = inv.get("notes", "") or ""
    if notes:
        story.append(Spacer(1, 4 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("<b>Notes</b>", _style("nb", fontSize=9, textColor=_MUTED, fontName="Helvetica-Bold")))
        story.append(Paragraph(notes, muted))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "This is a computer-generated invoice. No signature required. | Backero Private Limited",
        _style("footer", fontSize=7, textColor=_MUTED, alignment=1),
    ))

    doc.build(story)
    return buf.getvalue()

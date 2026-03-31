"""PDF generation for invoices using ReportLab."""
import base64
import io
from dataclasses import dataclass, field

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

import qrcode


def _decode_data_url(data_url: str) -> io.BytesIO:
    _, encoded = data_url.split(",", 1)
    raw = base64.b64decode(encoded)
    buf = io.BytesIO(raw)
    buf.seek(0)
    return buf


def _fmt_pkr(amount: int) -> str:
    return f"Rs. {amount:,}"


@dataclass
class InvoiceDesign:
    accent_color: str = "#C5D86D"
    company_name: str = ""
    company_email: str = ""
    company_phone: str = ""
    company_address: str = ""
    company_logo: str | None = None
    payment_methods: list[dict] = field(default_factory=list)


def generate_invoice_pdf(
    design: InvoiceDesign,
    invoice_number: str,
    institute_name: str,
    institute_email: str,
    period_start: str,
    period_end: str,
    due_date: str,
    line_items: list[dict],
    subtotal: int,
    discount_label: str | None,
    discount_amount: int,
    total_amount: int,
    notes: str | None,
    verification_url: str,
) -> bytes:
    """Generate a portrait A4 invoice PDF and return as bytes."""
    buf = io.BytesIO()
    width, height = A4
    c = canvas.Canvas(buf, pagesize=A4)

    accent = HexColor(design.accent_color)
    dark = HexColor("#1A1A1A")
    gray = HexColor("#666666")
    light_gray = HexColor("#999999")
    table_header_bg = HexColor("#F4F4F5")
    white = HexColor("#FFFFFF")

    margin_x = 20 * mm
    content_width = width - 2 * margin_x

    # ── Accent Bar (top) ──
    c.setFillColor(accent)
    c.rect(0, height - 8 * mm, width, 8 * mm, fill=1, stroke=0)

    # ── Header: Logo + Company Info ──
    y = height - 22 * mm
    logo_drawn = False

    if design.company_logo:
        try:
            logo_buf = _decode_data_url(design.company_logo)
            logo_h = 14 * mm
            logo_w = 14 * mm
            c.drawImage(
                ImageReader(logo_buf),
                margin_x, y - logo_h + 4 * mm,
                width=logo_w, height=logo_h,
                mask='auto',
            )
            logo_drawn = True
        except Exception:
            pass

    info_x = margin_x + (18 * mm if logo_drawn else 0)

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(dark)
    c.drawString(info_x, y, design.company_name or "Company Name")

    c.setFont("Helvetica", 8)
    c.setFillColor(gray)
    details = []
    if design.company_email:
        details.append(design.company_email)
    if design.company_phone:
        details.append(design.company_phone)
    if details:
        c.drawString(info_x, y - 5 * mm, " | ".join(details))
    if design.company_address:
        c.drawString(info_x, y - 9 * mm, design.company_address)

    # ── INVOICE title + number (right side) ──
    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(dark)
    c.drawRightString(width - margin_x, y, "INVOICE")

    c.setFont("Helvetica", 9)
    c.setFillColor(gray)
    c.drawRightString(width - margin_x, y - 6 * mm, invoice_number)

    # ── Divider ──
    y -= 18 * mm
    c.setStrokeColor(HexColor("#E4E4E7"))
    c.setLineWidth(0.5)
    c.line(margin_x, y, width - margin_x, y)

    # ── Invoice Details + Bill To (two columns) ──
    y -= 8 * mm

    # Left: Invoice details
    c.setFont("Helvetica", 8)
    c.setFillColor(light_gray)
    c.drawString(margin_x, y, "INVOICE DATE")
    c.drawString(margin_x, y - 12 * mm, "DUE DATE")
    c.drawString(margin_x, y - 24 * mm, "PERIOD")

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(dark)
    c.drawString(margin_x, y - 4 * mm, _format_date(period_start))
    c.drawString(margin_x, y - 16 * mm, _format_date(due_date))
    c.drawString(margin_x, y - 28 * mm, f"{_format_date(period_start)} - {_format_date(period_end)}")

    # Right: Bill To
    bill_x = width / 2 + 10 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(light_gray)
    c.drawString(bill_x, y, "BILL TO")

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(dark)
    c.drawString(bill_x, y - 5 * mm, institute_name)

    c.setFont("Helvetica", 8)
    c.setFillColor(gray)
    c.drawString(bill_x, y - 10 * mm, institute_email)

    # ── Line Items Table ──
    y -= 42 * mm

    # Table header
    col_positions = [margin_x, margin_x + 8 * mm, margin_x + 95 * mm, margin_x + 120 * mm, width - margin_x - 25 * mm]
    col_labels = ["#", "Description", "Qty", "Rate", "Amount"]
    header_h = 8 * mm

    c.setFillColor(table_header_bg)
    c.rect(margin_x, y - header_h, content_width, header_h, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(gray)
    for i, label in enumerate(col_labels):
        if i == len(col_labels) - 1:
            c.drawRightString(width - margin_x - 2 * mm, y - 5.5 * mm, label)
        else:
            c.drawString(col_positions[i] + 2 * mm, y - 5.5 * mm, label)

    y -= header_h

    # Table rows
    c.setFont("Helvetica", 9)
    row_h = 7 * mm
    for idx, item in enumerate(line_items):
        row_y = y - row_h * (idx + 1)

        if idx % 2 == 1:
            c.setFillColor(HexColor("#FAFAFA"))
            c.rect(margin_x, row_y, content_width, row_h, fill=1, stroke=0)

        c.setFillColor(gray)
        c.drawString(col_positions[0] + 2 * mm, row_y + 2 * mm, str(idx + 1))

        c.setFillColor(dark)
        desc = str(item.get("description", ""))
        if len(desc) > 45:
            desc = desc[:45] + "..."
        c.drawString(col_positions[1] + 2 * mm, row_y + 2 * mm, desc)

        c.setFillColor(gray)
        qty = item.get("quantity", 1)
        qty_str = str(int(qty)) if qty == int(qty) else f"{qty:.2f}"
        c.drawString(col_positions[2] + 2 * mm, row_y + 2 * mm, qty_str)
        c.drawString(col_positions[3] + 2 * mm, row_y + 2 * mm, _fmt_pkr(item.get("unit_price", 0)))

        c.setFillColor(dark)
        c.drawRightString(width - margin_x - 2 * mm, row_y + 2 * mm, _fmt_pkr(item.get("amount", 0)))

    y -= row_h * (len(line_items) + 1) + 2 * mm

    # ── Totals Section ──
    totals_x = width - margin_x - 60 * mm

    c.setStrokeColor(HexColor("#E4E4E7"))
    c.setLineWidth(0.5)
    c.line(totals_x, y, width - margin_x, y)
    y -= 5 * mm

    c.setFont("Helvetica", 9)
    c.setFillColor(gray)
    c.drawString(totals_x, y, "Subtotal")
    c.setFillColor(dark)
    c.drawRightString(width - margin_x - 2 * mm, y, _fmt_pkr(subtotal))

    if discount_amount > 0 and discount_label:
        y -= 5 * mm
        c.setFillColor(HexColor("#DC2626"))
        c.drawString(totals_x, y, discount_label)
        c.drawRightString(width - margin_x - 2 * mm, y, f"- {_fmt_pkr(discount_amount)}")

    y -= 3 * mm
    c.setStrokeColor(dark)
    c.setLineWidth(1)
    c.line(totals_x, y, width - margin_x, y)
    y -= 6 * mm

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(dark)
    c.drawString(totals_x, y, "TOTAL")
    c.drawRightString(width - margin_x - 2 * mm, y, _fmt_pkr(total_amount))

    y -= 12 * mm

    # ── Payment Details ──
    if design.payment_methods:
        c.setStrokeColor(HexColor("#E4E4E7"))
        c.setLineWidth(0.5)
        c.line(margin_x, y, width - margin_x, y)
        y -= 6 * mm

        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(dark)
        c.drawString(margin_x, y, "PAYMENT DETAILS")
        y -= 5 * mm

        c.setFont("Helvetica", 8)
        for method in design.payment_methods:
            c.setFillColor(accent)
            c.drawString(margin_x, y, f"\u25cf  {method.get('label', method.get('type', ''))}")

            details = method.get("details", {})
            detail_parts = []
            for k, v in details.items():
                if v:
                    label = k.replace("_", " ").title()
                    detail_parts.append(f"{label}: {v}")

            c.setFillColor(gray)
            if detail_parts:
                # Split into lines of ~80 chars
                detail_text = "   ".join(detail_parts)
                c.drawString(margin_x + 5 * mm, y - 4 * mm, detail_text[:100])
                if len(detail_text) > 100:
                    c.drawString(margin_x + 5 * mm, y - 8 * mm, detail_text[100:200])
                    y -= 4 * mm

            y -= 10 * mm

    # ── Notes ──
    if notes:
        c.setStrokeColor(HexColor("#E4E4E7"))
        c.setLineWidth(0.5)
        c.line(margin_x, y, width - margin_x, y)
        y -= 6 * mm

        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(dark)
        c.drawString(margin_x, y, "NOTES")
        y -= 5 * mm

        c.setFont("Helvetica", 8)
        c.setFillColor(gray)
        # Wrap notes text
        words = notes.split()
        line = ""
        for word in words:
            test = f"{line} {word}".strip()
            if c.stringWidth(test, "Helvetica", 8) > content_width - 5 * mm:
                c.drawString(margin_x, y, line)
                y -= 4 * mm
                line = word
            else:
                line = test
        if line:
            c.drawString(margin_x, y, line)
            y -= 4 * mm

    # ── QR Code (bottom-right) ──
    qr = qrcode.QRCode(version=1, box_size=4, border=1)
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

    qr_size = 18 * mm
    qr_y = 15 * mm
    c.drawImage(
        ImageReader(qr_buf),
        width - margin_x - qr_size,
        qr_y,
        width=qr_size,
        height=qr_size,
    )

    c.setFont("Helvetica", 6)
    c.setFillColor(light_gray)
    c.drawRightString(width - margin_x, qr_y - 2 * mm, f"Verify: {verification_url}")

    # ── Footer ──
    c.setFont("Helvetica", 7)
    c.setFillColor(light_gray)
    c.drawString(margin_x, 18 * mm, f"Invoice {invoice_number}")

    # ── Accent Bar (bottom) ──
    c.setFillColor(accent)
    c.rect(0, 0, width, 4 * mm, fill=1, stroke=0)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


def _format_date(date_str: str) -> str:
    """Format ISO date string to human readable."""
    try:
        from datetime import date as dt_date
        if isinstance(date_str, dt_date):
            d = date_str
        else:
            d = dt_date.fromisoformat(str(date_str))
        return d.strftime("%d %b %Y")
    except (ValueError, TypeError):
        return str(date_str)

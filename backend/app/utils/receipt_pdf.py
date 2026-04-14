"""PDF generation for student fee payment receipts.

Single-page A4 receipt produced with ReportLab. Layout borrows the visual
grammar of ``invoice_pdf`` (accent bars, company header, QR code) but drops
line-item tables in favour of a simple money-received summary.
"""
from __future__ import annotations

import base64
import io
from dataclasses import dataclass, field
from datetime import date as _date_cls, datetime

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def _decode_data_url(data_url: str) -> io.BytesIO:
    _, encoded = data_url.split(",", 1)
    raw = base64.b64decode(encoded)
    buf = io.BytesIO(raw)
    buf.seek(0)
    return buf


def _fmt_money(amount: int, currency: str = "PKR") -> str:
    return f"{currency} {amount:,}"


def _fmt_date(value) -> str:
    if value is None:
        return ""
    if isinstance(value, _date_cls) and not isinstance(value, datetime):
        return value.strftime("%d %b %Y")
    if isinstance(value, datetime):
        return value.strftime("%d %b %Y %H:%M")
    try:
        parsed = datetime.fromisoformat(str(value))
        return parsed.strftime("%d %b %Y %H:%M")
    except (ValueError, TypeError):
        return str(value)


@dataclass
class ReceiptDesign:
    accent_color: str = "#C5D86D"
    company_name: str = ""
    company_email: str = ""
    company_phone: str = ""
    company_address: str = ""
    company_logo: str | None = None


@dataclass
class ReceiptContent:
    receipt_number: str
    issued_at: datetime
    student_name: str
    student_email: str
    student_phone: str | None
    batch_name: str
    plan_label: str
    installment_label: str | None
    amount: int
    currency: str
    payment_method: str
    reference_number: str | None
    notes: str | None
    total_fee: int
    total_paid_to_date: int
    balance_remaining: int
    verification_url: str | None = None
    extra_rows: list[tuple[str, str]] = field(default_factory=list)


def generate_receipt_pdf(design: ReceiptDesign, content: ReceiptContent) -> bytes:
    """Render a single-page A4 receipt and return the PDF bytes."""
    buf = io.BytesIO()
    width, height = A4
    c = canvas.Canvas(buf, pagesize=A4)

    accent = HexColor(design.accent_color)
    dark = HexColor("#1A1A1A")
    gray = HexColor("#666666")
    light = HexColor("#999999")
    subtle = HexColor("#E4E4E7")
    highlight_bg = HexColor("#ECFDF5")
    highlight_fg = HexColor("#047857")

    margin_x = 20 * mm
    content_width = width - 2 * margin_x

    # ── Top accent bar ──
    c.setFillColor(accent)
    c.rect(0, height - 8 * mm, width, 8 * mm, fill=1, stroke=0)

    y = height - 22 * mm

    # ── Logo + company ──
    info_x = margin_x
    if design.company_logo:
        try:
            logo_buf = _decode_data_url(design.company_logo)
            c.drawImage(
                ImageReader(logo_buf),
                margin_x, y - 14 * mm + 4 * mm,
                width=14 * mm, height=14 * mm, mask="auto",
            )
            info_x = margin_x + 18 * mm
        except Exception:
            pass

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(dark)
    c.drawString(info_x, y, design.company_name or "Institute")

    c.setFont("Helvetica", 8)
    c.setFillColor(gray)
    details = [d for d in (design.company_email, design.company_phone) if d]
    if details:
        c.drawString(info_x, y - 5 * mm, " · ".join(details))
    if design.company_address:
        c.drawString(info_x, y - 9 * mm, design.company_address)

    # ── Title + receipt number ──
    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(dark)
    c.drawRightString(width - margin_x, y, "RECEIPT")
    c.setFont("Helvetica", 9)
    c.setFillColor(gray)
    c.drawRightString(width - margin_x, y - 6 * mm, content.receipt_number)

    # Divider
    y -= 18 * mm
    c.setStrokeColor(subtle)
    c.setLineWidth(0.5)
    c.line(margin_x, y, width - margin_x, y)

    # ── Paid to + Issued on ──
    y -= 8 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(light)
    c.drawString(margin_x, y, "ISSUED ON")
    c.drawString(margin_x, y - 12 * mm, "RECEIVED FROM")

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(dark)
    c.drawString(margin_x, y - 4 * mm, _fmt_date(content.issued_at))
    c.drawString(margin_x, y - 16 * mm, content.student_name)

    c.setFont("Helvetica", 8)
    c.setFillColor(gray)
    ident_line = content.student_email
    if content.student_phone:
        ident_line = f"{ident_line} · {content.student_phone}"
    c.drawString(margin_x, y - 20 * mm, ident_line)

    # Right column — enrollment context
    right_x = width / 2 + 10 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(light)
    c.drawString(right_x, y, "BATCH")
    c.drawString(right_x, y - 12 * mm, "FEE PLAN")

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(dark)
    c.drawString(right_x, y - 4 * mm, content.batch_name)
    c.drawString(right_x, y - 16 * mm, content.plan_label)

    if content.installment_label:
        c.setFont("Helvetica", 8)
        c.setFillColor(gray)
        c.drawString(right_x, y - 20 * mm, content.installment_label)

    # ── Amount paid hero block ──
    y -= 36 * mm
    c.setFillColor(highlight_bg)
    c.roundRect(margin_x, y - 22 * mm, content_width, 22 * mm, 4, fill=1, stroke=0)

    c.setFont("Helvetica", 9)
    c.setFillColor(highlight_fg)
    c.drawString(margin_x + 6 * mm, y - 6 * mm, "AMOUNT RECEIVED")
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(highlight_fg)
    c.drawString(margin_x + 6 * mm, y - 16 * mm, _fmt_money(content.amount, content.currency))

    c.setFont("Helvetica", 8)
    c.setFillColor(gray)
    c.drawRightString(
        width - margin_x - 6 * mm,
        y - 6 * mm,
        f"METHOD: {content.payment_method.replace('_', ' ').upper()}",
    )
    if content.reference_number:
        c.drawRightString(
            width - margin_x - 6 * mm,
            y - 12 * mm,
            f"REF: {content.reference_number}",
        )

    y -= 32 * mm

    # ── Balance summary table ──
    c.setStrokeColor(subtle)
    c.setLineWidth(0.5)
    c.line(margin_x, y, width - margin_x, y)
    y -= 6 * mm

    def _row(label: str, value: str, highlight: bool = False) -> None:
        nonlocal y
        c.setFont("Helvetica", 9)
        c.setFillColor(gray)
        c.drawString(margin_x, y, label)
        c.setFont("Helvetica-Bold" if highlight else "Helvetica", 10)
        c.setFillColor(dark)
        c.drawRightString(width - margin_x, y, value)
        y -= 6 * mm

    _row("Total fee (after discount)", _fmt_money(content.total_fee, content.currency))
    _row("Paid to date (incl. this receipt)", _fmt_money(content.total_paid_to_date, content.currency))
    _row(
        "Balance remaining",
        _fmt_money(content.balance_remaining, content.currency),
        highlight=True,
    )

    for label, value in content.extra_rows:
        _row(label, value)

    if content.notes:
        y -= 4 * mm
        c.setStrokeColor(subtle)
        c.line(margin_x, y, width - margin_x, y)
        y -= 6 * mm
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(dark)
        c.drawString(margin_x, y, "NOTES")
        y -= 5 * mm
        c.setFont("Helvetica", 8)
        c.setFillColor(gray)
        # Simple word-wrap
        words = str(content.notes).split()
        line = ""
        for word in words:
            test = f"{line} {word}".strip()
            if c.stringWidth(test, "Helvetica", 8) > content_width - 4 * mm:
                c.drawString(margin_x, y, line)
                y -= 4 * mm
                line = word
            else:
                line = test
        if line:
            c.drawString(margin_x, y, line)
            y -= 4 * mm

    # ── QR (optional) ──
    if content.verification_url:
        try:
            import qrcode

            qr = qrcode.QRCode(version=1, box_size=4, border=1)
            qr.add_data(content.verification_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")
            qr_buf = io.BytesIO()
            qr_img.save(qr_buf, format="PNG")
            qr_buf.seek(0)

            qr_size = 18 * mm
            qr_y = 15 * mm
            c.drawImage(
                ImageReader(qr_buf),
                width - margin_x - qr_size, qr_y,
                width=qr_size, height=qr_size,
            )
            c.setFont("Helvetica", 6)
            c.setFillColor(light)
            c.drawRightString(width - margin_x, qr_y - 2 * mm, f"Verify: {content.verification_url}")
        except Exception:
            pass

    # ── Footer ──
    c.setFont("Helvetica", 7)
    c.setFillColor(light)
    c.drawString(margin_x, 18 * mm, f"Receipt {content.receipt_number}")
    c.drawString(margin_x, 14 * mm, "This is a computer-generated receipt. Please retain for your records.")

    c.setFillColor(accent)
    c.rect(0, 0, width, 4 * mm, fill=1, stroke=0)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()

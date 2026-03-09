"""PDF generation for course completion certificates."""
import io

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

import qrcode


def generate_certificate_pdf(
    student_name: str,
    course_title: str,
    batch_name: str,
    certificate_id: str,
    verification_code: str,
    issue_date: str,
    verification_url: str,
) -> bytes:
    """Generate a landscape A4 certificate PDF and return as bytes."""
    buf = io.BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buf, pagesize=landscape(A4))

    dark = HexColor("#1A1A1A")
    accent = HexColor("#C5D86D")
    gray = HexColor("#666666")
    light_gray = HexColor("#999999")

    # ── Outer border ──
    c.setStrokeColor(dark)
    c.setLineWidth(3)
    c.rect(15 * mm, 15 * mm, width - 30 * mm, height - 30 * mm)

    # ── Inner decorative border ──
    c.setLineWidth(0.5)
    c.rect(20 * mm, 20 * mm, width - 40 * mm, height - 40 * mm)

    # ── Header: ICT INSTITUTE ──
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(dark)
    c.drawCentredString(width / 2, height - 45 * mm, "ICT INSTITUTE")

    c.setFont("Helvetica", 9)
    c.setFillColor(light_gray)
    c.drawCentredString(width / 2, height - 52 * mm, "https://ict.net.pk")

    # ── Title ──
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(dark)
    c.drawCentredString(width / 2, height - 72 * mm, "CERTIFICATE OF COMPLETION")

    # ── Accent line ──
    line_width = 80 * mm
    c.setStrokeColor(accent)
    c.setLineWidth(2)
    c.line(width / 2 - line_width / 2, height - 78 * mm, width / 2 + line_width / 2, height - 78 * mm)

    # ── "This is to certify that" ──
    c.setFont("Helvetica", 12)
    c.setFillColor(gray)
    c.drawCentredString(width / 2, height - 92 * mm, "This is to certify that")

    # ── Student name ──
    c.setFont("Helvetica-Bold", 30)
    c.setFillColor(dark)
    c.drawCentredString(width / 2, height - 108 * mm, student_name)

    # ── Underline accent below name ──
    name_width = c.stringWidth(student_name, "Helvetica-Bold", 30)
    c.setStrokeColor(accent)
    c.setLineWidth(1.5)
    c.line(
        width / 2 - name_width / 2 - 10,
        height - 112 * mm,
        width / 2 + name_width / 2 + 10,
        height - 112 * mm,
    )

    # ── "has successfully completed the course" ──
    c.setFont("Helvetica", 12)
    c.setFillColor(gray)
    c.drawCentredString(width / 2, height - 124 * mm, "has successfully completed the course")

    # ── Course title ──
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(dark)
    c.drawCentredString(width / 2, height - 138 * mm, course_title)

    # ── Batch + date ──
    c.setFont("Helvetica", 11)
    c.setFillColor(gray)
    c.drawCentredString(width / 2, height - 152 * mm, f"Batch: {batch_name}")
    c.drawCentredString(width / 2, height - 160 * mm, f"Date of Completion: {issue_date}")

    # ── Signature placeholders ──
    sig_y = 38 * mm
    sig_line_width = 60 * mm

    # Left signature — Director
    left_x = width * 0.25
    c.setStrokeColor(dark)
    c.setLineWidth(0.5)
    c.line(left_x - sig_line_width / 2, sig_y, left_x + sig_line_width / 2, sig_y)
    c.setFont("Helvetica", 10)
    c.setFillColor(dark)
    c.drawCentredString(left_x, sig_y - 5 * mm, "Director")

    # Right signature — Course Instructor
    right_x = width * 0.75
    c.line(right_x - sig_line_width / 2, sig_y, right_x + sig_line_width / 2, sig_y)
    c.drawCentredString(right_x, sig_y - 5 * mm, "Course Instructor")

    # ── QR code (center-bottom) ──
    qr = qrcode.QRCode(version=1, box_size=4, border=1)
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

    from reportlab.lib.utils import ImageReader
    qr_size = 15 * mm
    c.drawImage(
        ImageReader(qr_buf),
        width / 2 - qr_size / 2,
        22 * mm,
        width=qr_size,
        height=qr_size,
    )

    # ── Footer text ──
    c.setFont("Helvetica", 7)
    c.setFillColor(light_gray)
    footer_y = 17 * mm
    c.drawCentredString(
        width / 2,
        footer_y,
        f"Certificate ID: {certificate_id}  |  Verification Code: {verification_code}  |  Verify at: {verification_url}",
    )

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()

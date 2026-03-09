"""PDF generation for course completion certificates."""
import base64
import io
from dataclasses import dataclass, field

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

import qrcode


@dataclass
class CertDesign:
    primary_color: str = "#1A1A1A"
    accent_color: str = "#C5D86D"
    institute_name: str = "ICT INSTITUTE"
    website_url: str = "https://ict.net.pk"
    logo_data_url: str | None = None
    title: str = "CERTIFICATE OF COMPLETION"
    body_line1: str = "This is to certify that"
    body_line2: str = "has successfully completed the course"
    sig1_label: str = "Director"
    sig1_name: str = ""
    sig1_image_data_url: str | None = None
    sig2_label: str = "Course Instructor"
    sig2_name: str = ""
    sig2_image_data_url: str | None = None
    border_style: str = "classic"


def _decode_data_url(data_url: str) -> io.BytesIO:
    """Decode a data URL (data:image/png;base64,...) into a BytesIO."""
    # Strip the prefix: data:image/png;base64,
    _, encoded = data_url.split(",", 1)
    raw = base64.b64decode(encoded)
    buf = io.BytesIO(raw)
    buf.seek(0)
    return buf


# ── Border Styles ─────────────────────────────────────────────────────

def _draw_border_classic(c, width, height, dark, accent):
    """Double border: outer 3pt + inner 0.5pt."""
    c.setStrokeColor(dark)
    c.setLineWidth(3)
    c.rect(15 * mm, 15 * mm, width - 30 * mm, height - 30 * mm)
    c.setLineWidth(0.5)
    c.rect(20 * mm, 20 * mm, width - 40 * mm, height - 40 * mm)


def _draw_border_modern(c, width, height, dark, accent):
    """Single thick rounded border."""
    c.setStrokeColor(dark)
    c.setLineWidth(4)
    c.roundRect(15 * mm, 15 * mm, width - 30 * mm, height - 30 * mm, 8 * mm)


def _draw_border_ornate(c, width, height, dark, accent):
    """Double border + L-shaped accent corner decorations."""
    # Outer border
    c.setStrokeColor(dark)
    c.setLineWidth(3)
    c.rect(15 * mm, 15 * mm, width - 30 * mm, height - 30 * mm)
    # Inner border
    c.setLineWidth(0.5)
    c.rect(20 * mm, 20 * mm, width - 40 * mm, height - 40 * mm)
    # Corner decorations in accent color
    c.setStrokeColor(accent)
    c.setLineWidth(2.5)
    corner_len = 15 * mm
    inset = 17.5 * mm
    # Top-left
    c.line(inset, height - inset, inset + corner_len, height - inset)
    c.line(inset, height - inset, inset, height - inset - corner_len)
    # Top-right
    c.line(width - inset, height - inset, width - inset - corner_len, height - inset)
    c.line(width - inset, height - inset, width - inset, height - inset - corner_len)
    # Bottom-left
    c.line(inset, inset, inset + corner_len, inset)
    c.line(inset, inset, inset, inset + corner_len)
    # Bottom-right
    c.line(width - inset, inset, width - inset - corner_len, inset)
    c.line(width - inset, inset, width - inset, inset + corner_len)


_BORDER_FUNCS = {
    "classic": _draw_border_classic,
    "modern": _draw_border_modern,
    "ornate": _draw_border_ornate,
}


def generate_certificate_pdf(
    student_name: str,
    course_title: str,
    batch_name: str,
    certificate_id: str,
    verification_code: str,
    issue_date: str,
    verification_url: str,
    design: CertDesign | None = None,
) -> bytes:
    """Generate a landscape A4 certificate PDF and return as bytes."""
    if design is None:
        design = CertDesign()

    buf = io.BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buf, pagesize=landscape(A4))

    dark = HexColor(design.primary_color)
    accent = HexColor(design.accent_color)
    gray = HexColor("#666666")
    light_gray = HexColor("#999999")

    # ── Border ──
    border_fn = _BORDER_FUNCS.get(design.border_style, _draw_border_classic)
    border_fn(c, width, height, dark, accent)

    # ── Header: Logo + Institute Name ──
    header_y = height - 45 * mm
    if design.logo_data_url:
        try:
            logo_buf = _decode_data_url(design.logo_data_url)
            logo_height = 12 * mm
            logo_width = 12 * mm
            c.drawImage(
                ImageReader(logo_buf),
                width / 2 - logo_width / 2,
                header_y + 2 * mm,
                width=logo_width,
                height=logo_height,
                mask='auto',
            )
            header_y -= 14 * mm  # Shift text down
        except Exception:
            pass  # Skip logo if decoding fails

    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(dark)
    c.drawCentredString(width / 2, header_y, design.institute_name)

    c.setFont("Helvetica", 9)
    c.setFillColor(light_gray)
    c.drawCentredString(width / 2, header_y - 7 * mm, design.website_url)

    # ── Title ──
    title_y = header_y - 27 * mm
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(dark)
    c.drawCentredString(width / 2, title_y, design.title)

    # ── Accent line ──
    line_width = 80 * mm
    accent_line_y = title_y - 6 * mm
    c.setStrokeColor(accent)
    c.setLineWidth(2)
    c.line(width / 2 - line_width / 2, accent_line_y, width / 2 + line_width / 2, accent_line_y)

    # ── Body line 1 ──
    body1_y = accent_line_y - 14 * mm
    c.setFont("Helvetica", 12)
    c.setFillColor(gray)
    c.drawCentredString(width / 2, body1_y, design.body_line1)

    # ── Student name ──
    name_y = body1_y - 16 * mm
    c.setFont("Helvetica-Bold", 30)
    c.setFillColor(dark)
    c.drawCentredString(width / 2, name_y, student_name)

    # ── Underline accent below name ──
    name_width = c.stringWidth(student_name, "Helvetica-Bold", 30)
    c.setStrokeColor(accent)
    c.setLineWidth(1.5)
    c.line(
        width / 2 - name_width / 2 - 10,
        name_y - 4 * mm,
        width / 2 + name_width / 2 + 10,
        name_y - 4 * mm,
    )

    # ── Body line 2 ──
    body2_y = name_y - 16 * mm
    c.setFont("Helvetica", 12)
    c.setFillColor(gray)
    c.drawCentredString(width / 2, body2_y, design.body_line2)

    # ── Course title ──
    course_y = body2_y - 14 * mm
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(dark)
    c.drawCentredString(width / 2, course_y, course_title)

    # ── Batch + date ──
    info_y = course_y - 14 * mm
    c.setFont("Helvetica", 11)
    c.setFillColor(gray)
    c.drawCentredString(width / 2, info_y, f"Batch: {batch_name}")
    c.drawCentredString(width / 2, info_y - 8 * mm, f"Date of Completion: {issue_date}")

    # ── Signature blocks ──
    sig_y = 38 * mm
    sig_line_width = 60 * mm

    for pos, (sig_label, sig_name, sig_image_data_url, center_x) in enumerate([
        (design.sig1_label, design.sig1_name, design.sig1_image_data_url, width * 0.25),
        (design.sig2_label, design.sig2_name, design.sig2_image_data_url, width * 0.75),
    ]):
        # Signature image above line
        if sig_image_data_url:
            try:
                sig_buf = _decode_data_url(sig_image_data_url)
                sig_img_h = 18 * mm
                sig_img_w = 40 * mm
                c.drawImage(
                    ImageReader(sig_buf),
                    center_x - sig_img_w / 2,
                    sig_y + 3 * mm,
                    width=sig_img_w,
                    height=sig_img_h,
                    mask='auto',
                    preserveAspectRatio=True,
                    anchor='c',
                )
            except Exception:
                pass

        # Signature line
        c.setStrokeColor(dark)
        c.setLineWidth(0.5)
        c.line(center_x - sig_line_width / 2, sig_y, center_x + sig_line_width / 2, sig_y)

        # Signer name (between line and role label)
        name_offset = 0
        if sig_name:
            c.setFont("Helvetica", 9)
            c.setFillColor(gray)
            c.drawCentredString(center_x, sig_y - 4 * mm, sig_name)
            name_offset = 4 * mm

        # Role label
        c.setFont("Helvetica", 10)
        c.setFillColor(dark)
        c.drawCentredString(center_x, sig_y - 5 * mm - name_offset, sig_label)

    # ── QR code (center-bottom) ──
    qr = qrcode.QRCode(version=1, box_size=4, border=1)
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

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

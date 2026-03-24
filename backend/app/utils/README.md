# Utils

External service integrations and standalone utilities.

- `security.py` — JWT encode/decode, bcrypt, impersonation tokens
- `s3.py` — AWS S3 file upload/download
- `bunny.py` — Bunny.net video CDN (TUS upload, signed URLs)
- `zoom_api.py` — Zoom meeting creation, recordings
- `email.py` — Resend email with institute branding
- `certificate_pdf.py` — ReportLab PDF generation
- `encryption.py` — Fernet encryption (Zoom credentials)
- `transformers.py` — snake_case <-> kebab-case conversion
- `rate_limit.py` — slowapi rate limiter with X-Real-IP

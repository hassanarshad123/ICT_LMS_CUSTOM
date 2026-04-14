# Bulk CSV Import

Load existing institute data (students, fee plans, past payments) into the
LMS in one upload. Use this when onboarding an institute that's been running
on a different system — Frappe, Excel sheets, another LMS, etc.

## Supported entities

| Entity | Endpoint | Template |
|--------|----------|----------|
| `students` | `POST /api/v1/admin/bulk-import/students` | `GET /api/v1/admin/bulk-import/template/students` |
| `fee_plans` | `POST /api/v1/admin/bulk-import/fee_plans` | `GET /api/v1/admin/bulk-import/template/fee_plans` |
| `payments` | `POST /api/v1/admin/bulk-import/payments` | `GET /api/v1/admin/bulk-import/template/payments` |

## Limits

- **Max 5,000 rows per upload.** Larger imports: split into multiple CSVs.
- **Max 10 MB per file.**
- **10 uploads per hour per admin.**
- CSV must be UTF-8 (BOM tolerated). Excel "Save As CSV UTF-8" works.

## Column schemas

### students
```csv
name,email,phone,batch_name
Alice Khan,alice@example.com,+923001234567,MERN Oct 2026
Bilal Ahmed,bilal@example.com,,AI Track Q2
```

- `name` — required
- `email` — required, unique within institute
- `phone` — optional
- `batch_name` — optional; if provided, enrolls the student in that batch
  (no fee plan is created)

### fee_plans
```csv
student_email,batch_name,plan_type,total_amount,currency
alice@example.com,MERN Oct 2026,one_time,50000,PKR
bilal@example.com,AI Track Q2,monthly,30000,PKR
```

- `student_email`, `batch_name` — required, must exist in the LMS
- `plan_type` — `one_time` | `monthly` | `installment`
- `total_amount` — integer, in smallest currency unit (e.g. paisa, cents? —
  see your institute's currency setup)
- `currency` — defaults to `PKR`

### payments
```csv
student_email,batch_name,amount,payment_date,payment_method,reference_number
alice@example.com,MERN Oct 2026,25000,2026-01-15,bank_transfer,TXN-123
bilal@example.com,AI Track Q2,30000,2026-02-01,cash,
```

- `student_email`, `batch_name` — required
- `amount` — integer
- `payment_date` — `YYYY-MM-DD`; defaults to today if blank
- `payment_method` — defaults to `bank_transfer`
- `reference_number` — optional

## Response

```json
{
  "job_id": "11111111-2222-3333-4444-555555555555",
  "entity_type": "students",
  "status": "completed",
  "total_rows": 500,
  "success_rows": 498,
  "failed_rows": 2,
  "errors": [
    {"row": 47, "error": "BulkImportError: Duplicate email for institute: alice@example.com"},
    {"row": 203, "error": "BulkImportError: Batch not found: AI Track Q3"}
  ]
}
```

- `job_id` — use `GET /api/v1/admin/bulk-import/jobs/{job_id}` to re-fetch
  status later.
- `errors` — capped at the first 500 failing rows. Fix the CSV and re-upload
  only the failed rows.

## Integration with Frappe sync

Bulk imports fire the same fee webhook events as manual admissions. If your
institute has Frappe sync enabled at the time of import, **expect N Sales
Invoices and N Payment Entries to appear in Frappe**, one per row.

If you want to import *without* syncing (e.g. historical load where Frappe
already has the records), disable Frappe sync in the Integrations page
before importing, then re-enable after.

## Best practices

1. **Do a 10-row test first.** Start with a small CSV, verify the results
   look right, then scale up.
2. **Order matters:** students → fee_plans → payments. Earlier entities
   are prerequisites.
3. **Dry-run via export first.** Export the template, dry-run your data
   through a spreadsheet, then upload.
4. **Keep the CSV.** The file isn't stored beyond job completion — if you
   need to re-import, you need the original.

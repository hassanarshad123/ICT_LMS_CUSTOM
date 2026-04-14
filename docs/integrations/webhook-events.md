# Webhook Events

The LMS pushes real-time events to any HTTPS endpoint you register. Used for
one-way replication into CRMs, data warehouses, notification systems, etc.

## Registering a webhook

Create via the LMS admin UI (**Settings → Webhooks**) or the REST API:

```http
POST /api/v1/admin/webhooks
Authorization: Bearer <admin JWT>
Content-Type: application/json

{
  "url": "https://hooks.yoursystem.com/lms",
  "events": ["fee.plan_created", "fee.payment_recorded"],
  "description": "Accounting sync"
}
```

Response includes a `secret` — use it to verify signatures.

## Event envelope

All events share this shape:

```json
{
  "event": "fee.payment_recorded",
  "timestamp": "2026-04-15T12:34:56.789Z",
  "data": { /* per-event payload, see below */ }
}
```

## Signature verification

Every delivery carries two headers:

```
X-Webhook-Timestamp: 2026-04-15T12:34:56.789Z
X-Webhook-Signature: <hex HMAC-SHA256>
```

Verify like this (Python):

```python
import hmac, hashlib

def verify(secret: str, timestamp: str, body: bytes, signature: str) -> bool:
    message = f"{timestamp}.{body.decode()}".encode()
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

Reject any request where:
- Signature doesn't match, OR
- Timestamp is more than 5 minutes old (replay protection)

## Delivery guarantees

- **At-least-once** delivery — the same event may arrive twice. Dedupe on
  your side using the payload's primary ID (e.g. `payment_id`).
- **Retry on non-2xx:** 1 min → 5 min → 30 min → 2 h → 12 h (6 attempts).
- After 6 failures the event is marked `failed` and visible to the
  institute admin.

## Event catalog

### User lifecycle
| Event | When | Key payload fields |
|-------|------|---------------------|
| `user.created` | New user (student/teacher/staff) created | `user_id`, `email`, `name`, `role` |
| `user.updated` | Profile edited | `user_id`, `fields_updated` |
| `user.deactivated` | User suspended | `user_id` |
| `user.deleted` | User soft-deleted | `user_id` |

### Enrollment
| Event | When | Key payload fields |
|-------|------|---------------------|
| `enrollment.created` | Student added to a batch | `student_id`, `batch_id`, `student_batch_id` |
| `enrollment.removed` | Student removed from a batch | `student_id`, `batch_id`, `student_batch_id` |

### Certificates & progress
| Event | When | Key payload fields |
|-------|------|---------------------|
| `certificate.requested` | Student requests a cert | `certificate_id`, `student_id`, `course_id` |
| `certificate.approved` | Teacher/admin approves | `certificate_id` |
| `certificate.issued` | PDF generated | `certificate_id`, `pdf_url` |
| `certificate.revoked` | Cert revoked | `certificate_id` |
| `lecture.progress_updated` | Student watched a lecture | `user_id`, `lecture_id`, `percent` |

### Classes & attendance
| Event | When | Key payload fields |
|-------|------|---------------------|
| `class.scheduled` | Zoom class created | `class_id`, `batch_id`, `start_at` |
| `class.started` | Zoom meeting goes live | `class_id` |
| `class.ended` | Zoom meeting ends | `class_id`, `duration_minutes` |
| `attendance.recorded` | Attendance marked | `class_id`, `student_id`, `status` |
| `recording.ready` | Zoom recording processed | `recording_id`, `class_id`, `playback_url` |

### Fee lifecycle (Phase 1 of the Frappe integration)

| Event | When | Key payload fields |
|-------|------|---------------------|
| `fee.plan_created` | Admissions officer onboards a paying student or adds an enrollment | `fee_plan_id`, `student_id`, `student_email`, `student_name`, `batch_id`, `student_batch_id`, `plan_type`, `total_amount`, `final_amount`, `currency`, `installment_count`, `onboarded_by_user_id`, `source` |
| `fee.payment_recorded` | Officer records a payment | `payment_id`, `fee_plan_id`, `fee_installment_id`, `student_id`, `batch_id`, `amount`, `currency`, `installment_sequence`, `installment_status`, `receipt_number`, `payment_method`, `reference_number`, `payment_date` |
| `fee.installment_overdue` | Daily cron detects today's overdue installment | `fee_plan_id`, `fee_installment_id`, `student_id`, `amount_due`, `currency`, `due_date` |
| `fee.plan_cancelled` | Plan cancelled (student deleted or enrollment removed) | `fee_plan_id`, `student_id`, `batch_id`, `reason` (`student_deleted` / `enrollment_removed`) |
| `fee.plan_completed` | Final installment paid | `fee_plan_id`, `student_id`, `batch_id`, `final_amount`, `currency`, `completed_at` |

## Testing your endpoint

Use a public inspector like [webhook.site](https://webhook.site):
1. Grab a test URL.
2. Create a webhook in the LMS pointing at it, subscribed to all events.
3. In the LMS, onboard a test student or record a payment.
4. Watch events arrive on webhook.site with headers + body.

## Rate limits

There's no per-institute cap on webhook delivery — fan-out scales with the
number of registered endpoints and the event firing rate. In practice the
bottleneck is your endpoint's response time (we wait up to 15s per delivery).

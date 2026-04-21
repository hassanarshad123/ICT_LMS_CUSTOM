# Record Payment: Responsive UX + Draft Payment Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Polish the AO's "Record Payment" dialog so it's usable on phones / tablets / desktops, not only wide screens; (2) change the outbound Payment Entry sync so the PE lands in Frappe as **Draft** (docstatus=0), not auto-submitted — accounting staff will review the proof + submit manually.

**Architecture:**
- Phase 1 is pure frontend CSS / layout. Existing dialog already renders full-screen on narrow viewports via shadcn patterns but the inner form grid collapses awkwardly; we switch to a one-column-first layout, promote the uploader to a prominent section, and add a sticky footer so Cancel / Submit are reachable on mobile without scrolling to the bottom of a tall form.
- Phase 2 is backend: force `docstatus: 0` on the Payment Entry body built by `FrappeClient.upsert_payment_entry`, remove any implicit submit call. The LMS `FeePayment` row still updates its installment state (that's a local LMS concern, already driven by `fee_service.record_payment`). Downstream: student stays suspended until accounting reviews + submits the PE in Frappe, at which point the SI's `payment_schedule` updates and the next cron pass (00:00 PKT) reactivates them.

**Tech Stack:** Next.js + Tailwind + shadcn (frontend). FastAPI + httpx `FrappeClient` (backend). No schema changes. No new dependencies.

**Branch:** `feat/record-payment-ux-and-draft-pe` (to be created fresh off `upstream/main`).

**Per memory preferences:** implement first, tests deferred to final phase; no `Co-Authored-By` trailer; push to `origin` (fork) then PR to upstream main.

---

## Team Assignments

| Phase | Scope | Primary Agent | Primary Skills |
|-------|-------|---------------|----------------|
| 1 | Responsive layout + sticky footer + uploader prominence on Record Payment dialog | `general-purpose` | `frontend-design`, `frontend-patterns` |
| 2 | `upsert_payment_entry` forces `docstatus: 0`; remove any submit call | `python-reviewer` | `backend-patterns` |
| 3 | Consolidated check + deploy + runbook note | `e2e-runner` | `deployment-patterns` |

Fresh subagent per phase. No per-phase reviewer dispatch (deferred per memory).

---

## Grounded facts verified on prod

1. **Existing dialog** at `frontend/components/admissions/record-payment-dialog.tsx`:
   - Wrapped in `fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4`.
   - Inner card: `bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden`.
   - Form body: `px-6 py-4 space-y-4` with 2-column grids for amount/method and date/reference.
   - No `max-h` → on tall viewports with many installments the dialog overflows; on phones the content pushes below the visible area.
2. **Current PE creation path** (`backend/app/services/frappe_client.py:_post_resource`):
   - `POST /api/resource/Payment Entry` with the body dict.
   - Frappe creates a new doc. `docstatus` defaults to 0 when not in the body, BUT some ERPNext flows (hooks or validator auto-submit settings) may flip it. On `deverp.ict.net.pk` I checked `ACC-PAY-2026-00009` (Kamil's, created via this path) — it came back as `docstatus: 1 (Submitted)`.
   - So today's behavior is "submitted by default"; explicit `docstatus: 0` in the body will force Draft.
3. **Downstream ripple:** a Draft PE does NOT update the SI's `payment_schedule[].paid_amount`. That means our cron's `list_unpaid_sales_invoices` will continue to see the SI as Unpaid until accounting submits the PE. The 72h grace window covers the near-term case (student keeps access through the review window); after grace, student is suspended, accounting reviews + submits, next cron pass lifts suspension. This is the intended flow per the spec.

---

## File Structure

**Backend — modified (1)**
- `backend/app/services/frappe_client.py` — add `"docstatus": 0` to the PE body in `upsert_payment_entry`; verify no `.submit` call lies downstream.

**Frontend — modified (1)**
- `frontend/components/admissions/record-payment-dialog.tsx` — responsive layout: stack-first columns, `max-h`/`overflow-y-auto` on the form body, sticky footer for Cancel / Submit, larger touch targets, clearer hierarchy between form fields and the proof uploader.

**Docs — modified (1)**
- `docs/claude/frappe-si-first-flow.md` — add a paragraph: "Payment Entries are created as Draft. Accounting staff review the payment proof in Frappe, then submit the PE to clear the matching installment. The LMS suspension cron reactivates the student on its next pass after the SI flips to Partly Paid."

No migration. No new package. No schema change. No test fixture update.

---

## Phase 1 — Responsive Record Payment dialog

**Team:** `general-purpose` · skills `frontend-design`, `frontend-patterns`.

### Task 1.1 — Layout rewrite

**File:** `frontend/components/admissions/record-payment-dialog.tsx`

- [ ] **Step 1: Read the current component end-to-end.**

Note the existing structure:
- Outer backdrop: `<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">`
- Card: `<div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">`
- Header: flex row with title + close button
- `<form>` with `px-6 py-4 space-y-4` containing:
  - installment select
  - 2-col grid: amount + method
  - 2-col grid: date + reference
  - notes textarea
  - PaymentProofUploader
  - footer: Cancel + Submit

- [ ] **Step 2: Replace the entire return block with the responsive version below.**

Full replacement JSX:

```tsx
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 flex-none">
          <div className="min-w-0">
            <h2 className="font-semibold text-primary truncate">Record payment</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {plan.batchName} · {formatMoney(plan.balanceDue, plan.currency)} outstanding
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          id="record-payment-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Installment</label>
            <select
              value={installmentId}
              onChange={(e) => {
                const id = e.target.value;
                setInstallmentId(id);
                const inst = plan.installments.find((i) => i.id === id);
                if (inst) setAmount(String(Math.max(inst.amountDue - inst.amountPaid, 0)));
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              required
            >
              <option value="">Select an installment…</option>
              {plan.installments.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.sequence} · {i.label || 'Installment'} · due {formatDate(i.dueDate)} ·{' '}
                  {formatMoney(Math.max(i.amountDue - i.amountPaid, 0))} open
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 5000"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              />
              {selectedInstallment && (
                <p className="text-xs text-gray-500 mt-1">
                  Max for this installment: {formatMoney(remaining)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Received on</label>
              <input
                type="datetime-local"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Reference # (optional)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="TXN-12345"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              placeholder="Any context for the payment"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment receipt screenshot (optional)
            </label>
            <PaymentProofUploader
              feePlanId={plan.id}
              value={proof}
              onChange={setProof}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Attach the bank / app receipt the student sent you. The image is
              stored privately and linked to the Sales Invoice in ERP.
            </p>
          </div>
        </form>

        {/* Sticky footer (always visible) */}
        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-gray-100 bg-white flex-none">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="record-payment-form"
            disabled={loading || !amountValid}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/80 disabled:opacity-40"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}
```

Key responsive changes vs. the current version:
- **Backdrop** — `items-end sm:items-center` + `p-0 sm:p-4`: bottom-sheet on mobile, centered modal on ≥640px.
- **Card** — `w-full sm:max-w-lg`, `h-full sm:h-auto sm:max-h-[90vh]`, `rounded-none sm:rounded-2xl`, `flex flex-col`: full-viewport drawer on mobile, capped-height modal on larger screens.
- **Body** — `flex-1 overflow-y-auto`: only the form scrolls; header + footer stay put.
- **Grids** — `grid-cols-1 sm:grid-cols-2`: stack on phones, side-by-side from 640px up.
- **Footer** — moved OUT of `<form>` and positioned sticky at the bottom of the card; the submit button uses `form="record-payment-form"` attribute to still trigger the form's `onSubmit`. Always reachable no matter how long the content.
- **Horizontal padding** — `px-4 sm:px-6`: tighter on phones for content room, relaxed on desktop.
- **Close button** — `p-2` (larger tap target) + `aria-label` for screen readers.
- **Header truncation** — `min-w-0` + `truncate` so long batch names don't push the X button off-screen.

- [ ] **Step 3: Commit.**

```bash
git add frontend/components/admissions/record-payment-dialog.tsx
git commit -m "ui(admissions): responsive Record Payment dialog (mobile drawer + sticky footer)"
```

### PHASE 1 CHECKPOINT

**Deliverable:** Dialog renders as a bottom-sheet drawer on phones and a centered modal on ≥640px; Cancel / Submit always reachable via sticky footer; form body scrolls independently when tall.

**Verification:**
- [ ] `git status` clean.
- [ ] Grep confirms the class string `grid-cols-1 sm:grid-cols-2` appears twice (the amount/method and date/reference grids).
- [ ] `form="record-payment-form"` attribute on the submit button (visible-to-reader proof the Submit lives outside the `<form>`).

---

## Phase 2 — Payment Entry stays as Draft

**Team:** `python-reviewer` · skill `backend-patterns`.

### Task 2.1 — Force `docstatus: 0` on the PE body

**File:** `backend/app/services/frappe_client.py`

- [ ] **Step 1: Find the PE body construction inside `upsert_payment_entry`.**

Current snippet:

```python
body: dict[str, Any] = {
    "payment_type": "Receive",
    "party_type": "Customer",
    ...
    PAYMENT_FIELD: payment_id,
    FEE_PLAN_FIELD: fee_plan_id,
}
if self.cfg.default_company:
    body["company"] = self.cfg.default_company
if self.cfg.default_cost_center:
    body["cost_center"] = self.cfg.default_cost_center
if invoice_name:
    ref: dict[str, Any] = {
        "reference_doctype": "Sales Invoice",
        "reference_name": invoice_name,
        "allocated_amount": amount,
    }
    if payment_term:
        ref["payment_term"] = payment_term
    body["references"] = [ref]
```

- [ ] **Step 2: Insert `"docstatus": 0` into the dict literal.**

Add it as the first key after `"payment_type"`:

```python
body: dict[str, Any] = {
    "docstatus": 0,  # explicit Draft — accounting reviews + submits in Frappe
    "payment_type": "Receive",
    "party_type": "Customer",
    ...
}
```

- [ ] **Step 3: Confirm nothing downstream re-submits the PE.**

Run: `grep -n "frappe.client.submit\|_submit_existing_sales_order\|docstatus.*1" backend/app/services/frappe_client.py`

Expected hits should only be on the Sales Order / Sales Invoice submission paths — NOT on the Payment Entry path. `upsert_payment_entry` uses `_post_resource` / `_put_resource` only, and those never hit `frappe.client.submit`.

If you find a `submit` call inside the PE path, delete it. (There shouldn't be one.)

- [ ] **Step 4: Byte-compile.**

```bash
cd backend && py -m py_compile app/services/frappe_client.py
```
Expected: no output.

- [ ] **Step 5: Commit.**

```bash
git add backend/app/services/frappe_client.py
git commit -m "feat(frappe-client): Payment Entries land as Draft (docstatus=0) for accounting review"
```

### Task 2.2 — Update runbook

**File:** `docs/claude/frappe-si-first-flow.md` (force-add — `*.md` gitignored)

- [ ] **Step 1: Append a section.**

Add at the end:

```markdown
## Payment Entry review workflow

Payment Entries created by the LMS sync land in Frappe as **Draft**
(docstatus=0). This gives accounting staff a chance to review the attached
payment proof (``custom_zensbot_payment_proof_url``) against the bank
statement or transfer log before committing the PE to the ledger.

When accounting submits the Draft PE:

- Frappe updates ``payment_schedule[].paid_amount`` on the matching
  Sales Invoice schedule row (because we set ``payment_term`` on the
  reference row when posting).
- SI status flips to ``Partly Paid`` (or ``Paid`` once all rows clear).
- The LMS suspension cron at 00:00 PKT sees the SI is no longer in its
  unpaid-list and reactivates any student it previously auto-suspended.

If the student was suspended DURING the review window, they lose portal
access until the cron's next pass after the PE is submitted. The 72h
onboarding grace window protects new students from being suspended while
their first installment is awaiting review.
```

- [ ] **Step 2: Force-add + commit.**

```bash
git add -f docs/claude/frappe-si-first-flow.md
git commit -m "docs: Payment Entry Draft workflow + accounting review note"
```

### PHASE 2 CHECKPOINT

**Deliverable:** PEs created by the LMS sync are always Draft until accounting submits them in Frappe.

**Verification:**
- [ ] `grep -c '"docstatus": 0' backend/app/services/frappe_client.py` returns ≥ 1.
- [ ] `py -m compileall -q backend/app/services/frappe_client.py` clean.

---

## Phase 3 — Deploy + live smoke test

**Team:** `e2e-runner` · skill `deployment-patterns`.

### Task 3.1 — Push + PR to upstream main

- [ ] **Step 1: Push to origin (fork).**

```bash
git push origin feat/record-payment-ux-and-draft-pe
```

- [ ] **Step 2: Open PR from fork to upstream main.**

```bash
gh pr create \
  --repo hassanarshad123/ICT_LMS_CUSTOM \
  --base main \
  --head kamilzafar:feat/record-payment-ux-and-draft-pe \
  --title "feat: responsive Record Payment dialog + PE Draft workflow" \
  --body "Two independent small changes. (1) Record Payment modal becomes a bottom-sheet drawer on mobile with a sticky footer so Cancel/Submit stay reachable. (2) Payment Entries posted to Frappe land as Draft so accounting reviews the proof screenshot before committing the ledger entry."
```

- [ ] **Step 3: Merge after CI green.**

```bash
gh pr merge <N> --repo hassanarshad123/ICT_LMS_CUSTOM --squash --delete-branch=false
```

### Task 3.2 — Prod smoke test

- [ ] **Step 1: Wait for blue-green cut. ~2 minutes after merge.**

```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220 \
  "cd /home/ubuntu/ICT_LMS_CUSTOM && git log --oneline -1 && docker ps --format '{{.Names}} {{.Status}}'"
```
Expected: HEAD matches the merge commit; container is healthy.

- [ ] **Step 2: Record a test payment in LMS.**

Log into the admin dashboard → Admissions Officer role → pick a test student → Record Payment → fill amount, method, attach a dummy screenshot → Submit.

- [ ] **Step 3: Verify in Frappe.**

```bash
curl -sS -G "https://deverp.ict.net.pk/api/resource/Payment%20Entry" \
  -H "Authorization: token <key>:<secret>" \
  --data-urlencode 'fields=["name","docstatus","paid_amount","custom_zensbot_payment_id"]' \
  --data-urlencode 'order_by=creation desc' \
  --data-urlencode 'limit_page_length=1'
```
Expected: newest PE has `docstatus: 0` (Draft), `custom_zensbot_payment_id` populated.

- [ ] **Step 4: Verify SI is still Unpaid.**

Until accounting submits the PE in Frappe, the SI's `status` remains Unpaid/Overdue. Confirm the student is NOT auto-reactivated by the next 00:00 PKT cron run.

- [ ] **Step 5: Submit the Draft PE in Frappe UI** (simulate accountant). Watch the SI status flip to Partly Paid. Next cron pass should lift the suspension if the student was suspended.

### PHASE 3 CHECKPOINT

**Deliverable:** Feature live, manually smoke-tested end-to-end.

---

## Risks

1. **Dialog layout regresses on an unusual viewport** (iPad split-screen, Surface, foldables). Mitigation: `sm` breakpoint (640px) covers the common phone/tablet split cleanly; if edge cases appear, we can add an explicit `md`-specific tweak.
2. **Draft PEs accumulating unreviewed**. If accounting doesn't submit promptly, students stay suspended past the 72h grace. Mitigation: the existing `/integrations/sync-log` admin page already exposes sync activity; consider adding a dashboard card listing Draft PEs > 24h old in a follow-up — **out of scope for this PR**.
3. **Frappe auto-submit hooks overriding our explicit `docstatus: 0`**. Some ERPNext flows have server hooks that submit. If smoke-test step 3 shows `docstatus: 1` despite our change, we'd add `"__default_flags": {"ignore_permissions": 0}` or switch to `frappe.client.insert` via `/api/method` with explicit `submit=false`. Handle only if observed.

## Out of scope

- Dashboard widget for pending Draft PEs.
- Bulk-submit UI in LMS for accounting to review multiple PEs without opening Frappe.
- Email notification to accounting when a Draft PE is posted.
- Auto-cancel a Draft PE after N days of inactivity.

## Estimated Complexity: SMALL (~1.5h)

Phase 1: 45m · Phase 2: 15m · Phase 3: 30m.

---

**WAITING FOR EXECUTION CHOICE.**

1. **Subagent-Driven** — fresh subagent per phase.
2. **Inline Execution** — I run the phases here in this session.

Which?

import { apiClient } from './client';

export type FeePlanType = 'one_time' | 'monthly' | 'installment';
export type FeeInstallmentStatus =
  | 'pending'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'waived';
export type FeeDiscountType = 'percent' | 'flat';

export interface InstallmentDraft {
  sequence: number;
  amountDue: number;
  dueDate: string; // ISO date string yyyy-mm-dd
  label?: string;
}

export interface FeePlanCreatePayload {
  planType: FeePlanType | 'one-time';
  totalAmount: number;
  discountType?: FeeDiscountType | null;
  discountValue?: number | null;
  currency?: string;
  billingDayOfMonth?: number | null;
  monthlyInstallments?: number | null;
  firstDueDate?: string | null;
  installments?: InstallmentDraft[];
  notes?: string | null;
  frappeItemCode?: string | null;
  frappePaymentTermsTemplate?: string | null;
}

export interface OnboardStudentPayload {
  name: string;
  email: string;
  phone?: string;
  batchId: string;
  feePlan: FeePlanCreatePayload;
  notes?: string;
  paymentProofObjectKey?: string | null;
  initialPaymentAmount?: number | null;
}

export interface OnboardStudentResult {
  userId: string;
  studentBatchId: string;
  feePlanId: string;
  temporaryPassword: string;
  email: string;
  finalAmount: number;
  currency: string;
  installmentCount: number;
}

export interface AdmissionsStudentRow {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  batchId: string;
  batchName: string;
  studentBatchId: string;
  feePlanId: string;
  planType: FeePlanType;
  finalAmount: number;
  amountPaid: number;
  balanceDue: number;
  nextDueDate?: string | null;
  isOverdue: boolean;
  onboardedByUserId: string;
  onboardedByName?: string;
  createdAt: string;
}

export interface InstallmentRow {
  id: string;
  sequence: number;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  status: FeeInstallmentStatus;
  label?: string;
}

export interface FeePlanDetail {
  id: string;
  studentBatchId: string;
  studentId: string;
  batchId: string;
  batchName: string;
  planType: FeePlanType;
  totalAmount: number;
  discountType?: FeeDiscountType | null;
  discountValue?: number | null;
  finalAmount: number;
  currency: string;
  billingDayOfMonth?: number | null;
  onboardedByUserId: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  installments: InstallmentRow[];
  amountPaid: number;
  balanceDue: number;
  nextDueDate?: string | null;
  isOverdue: boolean;
}

export interface StudentDetailResponse {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  plans: FeePlanDetail[];
}

export async function onboardStudent(payload: OnboardStudentPayload): Promise<OnboardStudentResult> {
  return apiClient('/admissions/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listAdmissionsStudents(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  officer_id?: string;
}): Promise<{
  data: AdmissionsStudentRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  return apiClient('/admissions/students', {
    params: params as Record<string, string | number | undefined>,
  });
}

export async function getAdmissionsStudent(userId: string): Promise<StudentDetailResponse> {
  return apiClient(`/admissions/students/${userId}`);
}

export type PaymentMethod = 'bank_transfer' | 'jazzcash' | 'easypaisa' | 'cheque' | 'cash' | 'online';

export interface RecordPaymentPayload {
  feeInstallmentId?: string | null;
  amount: number;
  paymentDate: string; // ISO datetime
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface FeePaymentRow {
  id: string;
  feePlanId: string;
  feeInstallmentId?: string | null;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  status: string;
  referenceNumber?: string | null;
  receiptNumber?: string | null;
  recordedByUserId: string;
  notes?: string | null;
  createdAt: string;
}

export interface UpdateStudentPayload {
  name?: string;
  email?: string;
  phone?: string;
}

export async function updateAdmissionsStudent(
  userId: string,
  payload: UpdateStudentPayload,
): Promise<{ id: string; name: string; email: string; phone?: string; status: string }> {
  return apiClient(`/admissions/students/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function suspendAdmissionsStudent(userId: string): Promise<{ id: string; status: string }> {
  return apiClient(`/admissions/students/${userId}/suspend`, { method: 'POST' });
}

export async function reactivateAdmissionsStudent(userId: string): Promise<{ id: string; status: string }> {
  return apiClient(`/admissions/students/${userId}/reactivate`, { method: 'POST' });
}

export async function deleteAdmissionsStudent(userId: string): Promise<void> {
  return apiClient(`/admissions/students/${userId}`, { method: 'DELETE' });
}

export async function addAdmissionsEnrollment(
  userId: string,
  payload: { batchId: string; feePlan: FeePlanCreatePayload; notes?: string },
): Promise<{ feePlanId: string; studentBatchId: string; batchId: string; finalAmount: number; currency: string }> {
  return apiClient(`/admissions/students/${userId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeAdmissionsEnrollment(
  userId: string,
  studentBatchId: string,
): Promise<void> {
  return apiClient(
    `/admissions/students/${userId}/enrollments/${studentBatchId}`,
    { method: 'DELETE' },
  );
}

export async function recordPayment(
  userId: string,
  payload: RecordPaymentPayload,
  feePlanId?: string,
): Promise<FeePaymentRow> {
  const qs = feePlanId ? `?fee_plan_id=${encodeURIComponent(feePlanId)}` : '';
  return apiClient(`/admissions/students/${userId}/payments${qs}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listStudentPayments(userId: string): Promise<FeePaymentRow[]> {
  return apiClient(`/admissions/students/${userId}/payments`);
}

export interface MyFeesPaymentRow {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  receiptNumber?: string | null;
  notes?: string | null;
  feeInstallmentId?: string | null;
}

export interface MyFeesPlan {
  feePlanId: string;
  batchId: string;
  batchName: string;
  planType: FeePlanType;
  status: string;
  totalAmount: number;
  discountType?: FeeDiscountType | null;
  discountValue?: number | null;
  finalAmount: number;
  currency: string;
  amountPaid: number;
  balanceDue: number;
  isOverdue: boolean;
  nextDueDate?: string | null;
  nextDueAmount: number;
  createdAt: string;
  installments: InstallmentRow[];
  payments: MyFeesPaymentRow[];
}

export interface MyFeesResponse {
  summary: {
    totalBilled: number;
    totalPaid: number;
    balanceDue: number;
    nextDueDate?: string | null;
    nextDueAmount: number;
    isOverdue: boolean;
    currency: string;
  };
  plans: MyFeesPlan[];
}

export async function getMyFees(): Promise<MyFeesResponse> {
  return apiClient('/admissions/me/fees');
}

/** Lightweight check used by the student sidebar to decide whether to render
 * the "My Fees" nav item. True iff the user has ≥ 1 non-deleted FeePlan. */
export async function getMyHasFees(): Promise<{ hasFees: boolean }> {
  return apiClient('/admissions/me/has-fees');
}

export interface InstituteQuota {
  maxStudents: number;
  currentStudents: number;
  slotsLeft: number;
}

export async function getMyQuota(): Promise<InstituteQuota> {
  return apiClient('/admissions/me/quota');
}

export interface AdmissionsOfficerStat {
  officerId: string;
  name: string;
  email: string;
  status: string;
  studentsOnboarded: number;
  activeStudents: number;
  revenueCollected: number;
  totalBilled: number;
  avgFee: number;
  paymentsCount: number;
  employeeId: string | null;
}

export interface AdmissionsStatsResponse {
  officers: AdmissionsOfficerStat[];
  summary: {
    officersTotal: number;
    plansTotal: number;
    revenueTotal: number;
    activeStudentsTotal: number;
  };
  filters: { dateFrom?: string | null; dateTo?: string | null };
}

export async function getAdmissionsAdminStats(
  params?: { date_from?: string; date_to?: string },
): Promise<AdmissionsStatsResponse> {
  return apiClient('/admissions/admin/stats', {
    params: params as Record<string, string | number | undefined>,
  });
}

/** Absolute URL — callers should open in a new tab or anchor with download attr. */
export function receiptPdfUrl(paymentId: string): string {
  return `/api/v1/admissions/payments/${paymentId}/receipt.pdf`;
}

// ── Payment proof upload (two-step signed URL) ─────────────────────

export interface PaymentProofUploadUrlRequest {
  fileName: string;
  contentType: string;
  feePlanId: string;
}

export interface PaymentProofUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  viewUrl: string;
}

export async function getPaymentProofUploadUrl(
  req: PaymentProofUploadUrlRequest,
): Promise<PaymentProofUploadUrlResponse> {
  return apiClient('/admissions/payment-proof/upload-url', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ── Payment proof direct upload (LMS-proxied, no S3 CORS required) ────────

export interface PaymentProofDirectUploadRequest {
  file: File;
  feePlanId: string;
}

export interface PaymentProofDirectUploadResponse {
  objectKey: string;
  viewUrl: string;
}

/**
 * Upload a payment screenshot via the LMS backend (server-side proxy to S3).
 * Bypasses S3 CORS entirely — the browser POSTs multipart form-data to the
 * LMS, which uploads to S3 using its own IAM identity.
 */
export async function uploadPaymentProofDirect(
  req: PaymentProofDirectUploadRequest,
): Promise<PaymentProofDirectUploadResponse> {
  const fd = new FormData();
  fd.append('file', req.file);
  fd.append('fee_plan_id', req.feePlanId);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  const url = `${base}/api/v1/admissions/payment-proof/upload`;

  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) message = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* non-JSON body */
    }
    throw new Error(message);
  }
  const j = await res.json();
  return {
    objectKey: j.object_key,
    viewUrl: j.view_url,
  };
}

/** Fetch the PDF with the bearer token and trigger a download client-side. */
export async function downloadReceipt(paymentId: string, filename: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const res = await fetch(receiptPdfUrl(paymentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Receipt download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

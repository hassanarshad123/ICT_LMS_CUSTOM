import { apiClient } from './client';

// v2 public tiers: professional, custom.
// SA-only internal tier: unlimited (comped, no billing — excluded from v2 billing engine).
// Legacy grandfathered tiers: free, starter, basic, pro, enterprise.
export type PlanTier =
  | 'professional'
  | 'custom'
  | 'unlimited'
  | 'free'
  | 'starter'
  | 'basic'
  | 'pro'
  | 'enterprise';

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  professional: 'Professional',
  custom: 'Custom',
  unlimited: 'Unlimited',
  free: 'Free Trial',
  starter: 'Starter',
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export interface InstituteOut {
  id: string;
  name: string;
  slug: string;
  status: string;
  planTier: PlanTier;
  // Caps are nullable: institutes on the 'unlimited' tier have their
  // quota columns NULL-ed out to indicate truly unlimited capacity.
  maxUsers: number | null;
  maxStudents: number | null;
  maxStorageGb: number | null;
  maxVideoGb: number | null;
  contactEmail: string;
  expiresAt: string | null;
  createdAt: string | null;
  currentUsers: number;
  currentStudents: number;
  currentStorageGb: number;
  currentVideoGb: number;
}

export interface PlatformDashboard {
  totalInstitutes: number;
  activeInstitutes: number;
  suspendedInstitutes: number;
  trialInstitutes: number;
  totalUsers: number;
  totalStorageGb: number;
  totalVideoGb: number;
  institutesByPlan: Partial<Record<PlanTier, number>>;
  recentInstitutes: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    planTier: PlanTier;
    createdAt: string | null;
  }>;
}

export interface InstituteCreate {
  name: string;
  slug: string;
  contactEmail: string;
  planTier?: PlanTier;
  maxUsers?: number;
  maxStudents?: number;
  maxStorageGb?: number;
  maxVideoGb?: number;
  expiresAt?: string | null;
}

export interface AdminCreate {
  email: string;
  name: string;
  password: string;
  phone?: string;
}

export async function getPlatformDashboard(): Promise<PlatformDashboard> {
  return apiClient<PlatformDashboard>('/super-admin/dashboard');
}

export async function listInstitutes(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  plan_tier?: string;
}): Promise<{ data: InstituteOut[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/institutes', { params });
}

export async function getInstitute(id: string): Promise<InstituteOut> {
  return apiClient<InstituteOut>(`/super-admin/institutes/${id}`);
}

export async function createInstitute(data: InstituteCreate): Promise<InstituteOut> {
  return apiClient<InstituteOut>('/super-admin/institutes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface InstituteUpdateInput {
  name?: string;
  slug?: string;
  contactEmail?: string;
  planTier?: PlanTier;
  // Nullable because switching to 'unlimited' nulls the quota columns.
  maxUsers?: number | null;
  maxStudents?: number | null;
  maxStorageGb?: number | null;
  maxVideoGb?: number | null;
  expiresAt?: string | null;
  status?: string;
  /** Required when the PATCH changes plan_tier to or from 'unlimited'. */
  tierChangeReason?: string;
}

export async function updateInstitute(
  id: string,
  data: InstituteUpdateInput,
): Promise<InstituteOut> {
  return apiClient<InstituteOut>(`/super-admin/institutes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function suspendInstitute(id: string): Promise<void> {
  await apiClient(`/super-admin/institutes/${id}/suspend`, { method: 'POST' });
}

export async function activateInstitute(id: string): Promise<void> {
  await apiClient(`/super-admin/institutes/${id}/activate`, { method: 'POST' });
}

export async function createAdminForInstitute(
  id: string,
  data: AdminCreate
): Promise<{ id: string; email: string; name: string; role: string }> {
  return apiClient(`/super-admin/institutes/${id}/admin`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getInstituteUsers(id: string, params?: { page?: number; per_page?: number }): Promise<any> {
  return apiClient(`/super-admin/institutes/${id}/users`, { params });
}

export async function getInstituteCourses(id: string, params?: { page?: number; per_page?: number }): Promise<any> {
  return apiClient(`/super-admin/institutes/${id}/courses`, { params });
}

export async function getInstituteBatches(id: string, params?: { page?: number; per_page?: number }): Promise<any> {
  return apiClient(`/super-admin/institutes/${id}/batches`, { params });
}

export interface ImpersonateResponse {
  /**
   * Single-use handover id (Phase 4). Redeem via
   * POST /api/v1/auth/impersonation-handover/{handoverId}
   * from the target subdomain's callback page. The JWT itself is
   * never returned here so it cannot leak via URL/history/CDN logs.
   */
  handoverId: string;
  instituteSlug: string;
  targetUserId: string;
  targetUserName: string;
  targetUserRole: string;
}

export async function impersonateUser(userId: string): Promise<ImpersonateResponse> {
  return apiClient<ImpersonateResponse>(`/super-admin/impersonate/${userId}`, { method: 'POST' });
}

// ── SA Analytics (Phase 1) ──────────────────────────────────────

export interface SAOverview {
  totalUsers: number;
  totalUsersPrev: number;
  totalCourses: number;
  totalCoursesPrev: number;
  totalBatches: number;
  totalBatchesPrev: number;
  totalCertificates: number;
  totalCertificatesPrev: number;
  totalLectures: number;
  totalStorageGb: number;
  totalVideoGb: number;
  totalInstitutes: number;
  activeInstitutes: number;
  suspendedInstitutes: number;
  trialInstitutes: number;
}

export interface GrowthPoint {
  date: string;
  count: number;
}

export interface GrowthTrends {
  newUsers: GrowthPoint[];
  newInstitutes: GrowthPoint[];
}

// Keyed by every PlanTier value. Using Partial + Record so any future
// tier added to the backend enum widens the type without a PR here.
export type PlanDistribution = Partial<Record<PlanTier, number>>;

export interface TopInstituteItem {
  instituteId: string;
  name: string;
  slug: string;
  planTier: string;
  value: number;
}

export interface QuotaUtilizationItem {
  instituteId: string;
  name: string;
  slug: string;
  usersUsedPct: number;
  storageUsedPct: number;
  videoUsedPct: number;
  highestPct: number;
}

export async function getAnalyticsOverview(period: number = 30): Promise<SAOverview> {
  return apiClient<SAOverview>('/super-admin/analytics/overview', { params: { period } });
}

export async function getGrowthTrends(period: number = 30): Promise<GrowthTrends> {
  return apiClient<GrowthTrends>('/super-admin/analytics/growth-trends', { params: { period } });
}

export async function getPlanDistribution(): Promise<PlanDistribution> {
  return apiClient<PlanDistribution>('/super-admin/analytics/plan-distribution');
}

export async function getTopInstitutes(metric: string = 'users', limit: number = 5): Promise<TopInstituteItem[]> {
  return apiClient<TopInstituteItem[]>('/super-admin/analytics/top-institutes', { params: { metric, limit } });
}

export async function getQuotaUtilization(): Promise<QuotaUtilizationItem[]> {
  return apiClient<QuotaUtilizationItem[]>('/super-admin/analytics/quota-utilization');
}

// ── SA Monitoring (Phase 2) ─────────────────────────────────────

export interface ErrorByInstitute {
  instituteId: string;
  name: string;
  count: number;
}

export interface ErrorTrendPoint {
  date: string;
  critical: number;
  error: number;
  warning: number;
  total: number;
}

export interface SAErrorStats {
  totalErrors24h: number;
  unresolvedCount: number;
  errorTrend: ErrorTrendPoint[];
  topErrorInstitutes: ErrorByInstitute[];
  errorsBySource: Record<string, number>;
  errorsByLevel: Record<string, number>;
}

export interface SAErrorItem {
  id: string;
  level: string;
  message: string;
  traceback?: string;
  requestPath?: string;
  statusCode?: number;
  source: string;
  resolved: boolean;
  instituteId?: string;
  instituteName?: string;
  createdAt?: string;
}

export async function getSAErrorStats(): Promise<SAErrorStats> {
  return apiClient<SAErrorStats>('/super-admin/monitoring/errors/stats');
}

export async function getSAErrors(params?: {
  page?: number;
  per_page?: number;
  institute_id?: string;
  level?: string;
  source?: string;
  resolved?: boolean;
}): Promise<{ data: SAErrorItem[]; total: number; page: number; perPage: number; totalPages: number }> {
  const { resolved, ...rest } = params || {};
  const queryParams: Record<string, string | number | undefined> = { ...rest };
  if (resolved !== undefined) {
    queryParams.resolved = String(resolved);
  }
  return apiClient('/super-admin/monitoring/errors', { params: queryParams });
}

export async function resolveSAError(id: string, resolved: boolean): Promise<SAErrorItem> {
  return apiClient<SAErrorItem>(`/super-admin/monitoring/errors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ resolved }),
  });
}

export interface JobStatus {
  name: string;
  description: string;
  frequency: string;
  status: string;
}

export interface VideoPipelineStatus {
  pending: number;
  processing: number;
  ready: number;
  failed: number;
}

export interface WebhookStatsItem {
  instituteId: string;
  instituteName: string;
  total24h: number;
  failed24h: number;
}

export interface WebhookDeliveryStats {
  total24h: number;
  success24h: number;
  failed24h: number;
  pending: number;
  byInstitute: WebhookStatsItem[];
}

export interface SystemHealth {
  dbStatus: string;
  dbLatencyMs: number;
  redisStatus: string;
  redisMemoryMb: number;
  redisHitRate: number;
  redisTotalKeys: number;
  jobs: JobStatus[];
  videoPipeline: VideoPipelineStatus;
  webhookStats: WebhookDeliveryStats;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  return apiClient<SystemHealth>('/super-admin/monitoring/health');
}

// ── SA Operations (Phase 3) ────────────────────────────────────

export interface ActivityLogItem {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  instituteId?: string;
  instituteName?: string;
  impersonatedBy?: string;
  createdAt?: string;
  userName?: string;
  userEmail?: string;
}

export async function getSAActivityLog(params?: {
  page?: number;
  per_page?: number;
  institute_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
}): Promise<{ data: ActivityLogItem[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/operations/activity-log', { params });
}

export async function getImpersonationHistory(params?: {
  page?: number;
  per_page?: number;
}): Promise<{ data: ActivityLogItem[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/operations/impersonation-history', { params });
}

export interface SAUserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  instituteId?: string;
  instituteName?: string;
  instituteSlug?: string;
  createdAt?: string;
}

export async function searchUsers(q: string, params?: {
  page?: number;
  per_page?: number;
}): Promise<{ data: SAUserItem[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/operations/users/search', { params: { q, ...params } });
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  await apiClient(`/super-admin/operations/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
    skipConversion: true,
  });
}

export async function deactivateUser(userId: string): Promise<void> {
  await apiClient(`/super-admin/operations/users/${userId}/deactivate`, { method: 'POST' });
}

export async function activateUser(userId: string): Promise<void> {
  await apiClient(`/super-admin/operations/users/${userId}/activate`, { method: 'POST' });
}

export async function bulkUpdateInstitutes(
  instituteIds: string[],
  action: 'suspend' | 'activate'
): Promise<{ count: number }> {
  return apiClient('/super-admin/operations/institutes/bulk-action', {
    method: 'POST',
    body: JSON.stringify({ institute_ids: instituteIds, action }),
    skipConversion: true,
  });
}

export interface AdminListItem {
  id: string;
  email: string;
  name: string;
  status: string;
  instituteId?: string;
  instituteName?: string;
  createdAt?: string;
}

export async function listAdmins(params?: {
  page?: number;
  per_page?: number;
}): Promise<{ data: AdminListItem[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/operations/admins', { params });
}

export async function exportInstitutesCSV(): Promise<Blob> {
  const token = localStorage.getItem('access_token');
  const res = await fetch('/api/v1/super-admin/operations/export/institutes', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

export async function exportUsersCSV(): Promise<Blob> {
  const token = localStorage.getItem('access_token');
  const res = await fetch('/api/v1/super-admin/operations/export/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

// ── SA Billing & Communication (Phase 4) ────────────────────────

export interface BillingConfig {
  instituteId: string;
  instituteName: string;
  baseAmount: number;
  currency: string;
  billingCycle: string;
  extraUserRate: number;
  extraStorageRate: number;
  extraVideoRate: number;
  notes?: string;
}

export async function getBillingConfig(instituteId: string): Promise<BillingConfig> {
  return apiClient<BillingConfig>(`/super-admin/billing/${instituteId}`);
}

export async function updateBillingConfig(instituteId: string, data: Partial<BillingConfig>): Promise<BillingConfig> {
  return apiClient<BillingConfig>(`/super-admin/billing/${instituteId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export interface InvoiceItem {
  id: string;
  instituteId: string;
  instituteName?: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  totalAmount: number;
  status: string;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  notes?: string;
  pdfPath?: string;
  dueDate: string;
  generatedBy: string;
  createdAt?: string;
}

export async function generateInvoice(data: {
  instituteId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}): Promise<InvoiceItem> {
  return apiClient<InvoiceItem>('/super-admin/invoices/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listInvoices(params?: {
  page?: number;
  per_page?: number;
  institute_id?: string;
  status?: string;
}): Promise<{ data: InvoiceItem[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/invoices', { params });
}

export async function updateInvoiceStatus(invoiceId: string, status: string): Promise<InvoiceItem> {
  return apiClient<InvoiceItem>(`/super-admin/invoices/${invoiceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export interface PaymentItem {
  id: string;
  instituteId: string;
  instituteName?: string;
  invoiceId?: string;
  amount: number;
  paymentDate?: string;
  paymentMethod: string;
  status: string;
  referenceNumber?: string;
  notes?: string;
  recordedBy: string;
  createdAt?: string;
}

export async function recordPayment(data: {
  instituteId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  invoiceId?: string;
}): Promise<PaymentItem> {
  return apiClient<PaymentItem>('/super-admin/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listPayments(params?: {
  page?: number;
  per_page?: number;
  institute_id?: string;
}): Promise<{ data: PaymentItem[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/payments', { params });
}

export interface RevenueDashboard {
  totalCollected: number;
  totalOutstanding: number;
  revenueByPlan: Record<string, number>;
  monthlyTrend: Array<{ month: string; amount: number }>;
}

export async function getRevenueDashboard(): Promise<RevenueDashboard> {
  return apiClient<RevenueDashboard>('/super-admin/revenue');
}

export interface SAAnnouncement {
  id: string;
  title: string;
  message: string;
  targetInstituteIds: string[];
  sentBy: string;
  sentByName?: string;
  createdAt?: string;
  deliveryCount: number;
}

export async function createAnnouncement(data: {
  title: string;
  message: string;
  targetInstituteIds: string[];
}): Promise<SAAnnouncement> {
  return apiClient<SAAnnouncement>('/super-admin/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listAnnouncements(params?: {
  page?: number;
  per_page?: number;
}): Promise<{ data: SAAnnouncement[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/announcements', { params });
}

// ── SA Settings (Invoice Profile) ───────────────────────────────

export interface SAProfile {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyLogo?: string;
}

export async function getSAProfile(): Promise<SAProfile> {
  return apiClient<SAProfile>('/super-admin/settings/profile');
}

export async function updateSAProfile(data: Partial<SAProfile>): Promise<SAProfile> {
  return apiClient<SAProfile>('/super-admin/settings/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadSALogo(logo: string): Promise<SAProfile> {
  return apiClient<SAProfile>('/super-admin/settings/logo', {
    method: 'POST',
    body: JSON.stringify({ logo }),
  });
}

export interface PaymentMethodItem {
  type: string;
  label: string;
  details: Record<string, string>;
}

export async function getPaymentMethods(): Promise<{ methods: PaymentMethodItem[] }> {
  return apiClient('/super-admin/settings/payment-methods');
}

export async function updatePaymentMethods(methods: PaymentMethodItem[]): Promise<{ methods: PaymentMethodItem[] }> {
  return apiClient('/super-admin/settings/payment-methods', {
    method: 'PUT',
    body: JSON.stringify({ methods }),
  });
}

// ── Invoice Preview & Enhanced Generate ─────────────────────────

export interface InvoicePreview {
  instituteName: string;
  instituteEmail: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  subtotal: number;
}

export async function previewInvoice(data: {
  instituteId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<InvoicePreview> {
  return apiClient<InvoicePreview>('/super-admin/invoices/preview', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function generateInvoiceEnhanced(data: {
  instituteId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  customLineItems?: Array<{ description: string; quantity: number; unit_price: number; amount: number }>;
  discountType?: string;
  discountValue?: number;
  notes?: string;
}): Promise<InvoiceItem> {
  return apiClient<InvoiceItem>('/super-admin/invoices/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function downloadInvoicePDF(invoiceId: string): Promise<void> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`/api/v1/super-admin/invoices/${invoiceId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'invoice.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

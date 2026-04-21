import { apiClient } from './client';

// ── Frappe config ─────────────────────────────────────────────────

export interface FrappeConfig {
  frappeEnabled: boolean;
  frappeBaseUrl: string | null;
  apiKeySet: boolean;
  apiSecretSet: boolean;
  inboundSecretSet: boolean;
  defaultIncomeAccount: string | null;
  defaultReceivableAccount: string | null;
  defaultBankAccount: string | null;
  defaultModeOfPayment: string | null;
  defaultCostCenter: string | null;
  defaultCompany: string | null;
  autoCreateCustomers: boolean;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  updatedAt: string | null;
}

export interface FrappeConfigUpdate {
  frappeEnabled: boolean;
  frappeBaseUrl?: string | null;
  apiKey?: string;
  apiSecret?: string;
  defaultIncomeAccount?: string | null;
  defaultReceivableAccount?: string | null;
  defaultBankAccount?: string | null;
  defaultModeOfPayment?: string | null;
  defaultCostCenter?: string | null;
  defaultCompany?: string | null;
  autoCreateCustomers?: boolean;
}

export interface FrappeTestResult {
  ok: boolean;
  message: string;
  frappeUser: string | null;
  latencyMs: number | null;
}

export interface InboundSecretOut {
  secret: string;
  note: string;
}

export function getFrappeConfig(): Promise<FrappeConfig> {
  return apiClient('/integrations/frappe');
}

export function updateFrappeConfig(body: FrappeConfigUpdate): Promise<FrappeConfig> {
  return apiClient('/integrations/frappe', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function testFrappeConnection(): Promise<FrappeTestResult> {
  return apiClient('/integrations/frappe/test', { method: 'POST' });
}

export function rotateInboundSecret(): Promise<InboundSecretOut> {
  return apiClient('/integrations/frappe/inbound-secret/rotate', { method: 'POST' });
}

// ── Tier 2: wizard introspection + auto-setup ────────────────────

export interface DropdownItem { name: string }
export interface DropdownResponse { items: DropdownItem[]; cached: boolean }

export type IntrospectResource = 'companies' | 'accounts' | 'modes-of-payment' | 'cost-centers';

export function introspectFrappe(
  resource: IntrospectResource,
  params: { company?: string; accountType?: string; refresh?: boolean } = {},
): Promise<DropdownResponse> {
  const queryParams: Record<string, string | number | undefined> = {};
  if (params.company) queryParams.company = params.company;
  if (params.accountType) queryParams.accountType = params.accountType;
  if (params.refresh) queryParams.refresh = 'true';
  return apiClient(`/integrations/frappe/introspect/${resource}`, { params: queryParams });
}

export interface SetupActionResult {
  ok: boolean;
  message: string;
  installed?: { doctype: string; fieldname: string }[];
  skipped?: { doctype: string; fieldname: string }[];
  webhookName?: string;
  invoiceName?: string;
  cancelled?: boolean;
  detail?: string | null;
}

export function installCustomFields(): Promise<SetupActionResult> {
  return apiClient('/integrations/frappe/setup/custom-fields', { method: 'POST' });
}

export function registerWebhook(): Promise<SetupActionResult> {
  return apiClient('/integrations/frappe/setup/webhook', { method: 'POST' });
}

export function runDryRun(): Promise<SetupActionResult> {
  return apiClient('/integrations/frappe/setup/dry-run', { method: 'POST' });
}

export interface SetupStatus {
  connection: string;
  accountsMapped: string;
  customFieldsInstalled: string;
  webhookRegistered: string;
  inboundSecretShared: string;
}

export function getSetupStatus(): Promise<SetupStatus> {
  return apiClient('/integrations/frappe/setup/status');
}

export function setAutoCreateCustomers(enabled: boolean): Promise<{ autoCreateCustomers: boolean }> {
  return apiClient('/integrations/frappe/auto-create-customers', {
    method: 'PUT',
    body: JSON.stringify({ auto_create_customers: enabled }),
  });
}

// ── Sync log ──────────────────────────────────────────────────────

export interface SyncLogItem {
  id: string;
  direction: 'inbound' | 'outbound';
  entityType: string;
  eventType: string;
  lmsEntityId: string | null;
  frappeDocName: string | null;
  status: string;
  statusCode: number | null;
  errorMessage: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface PaginatedSyncLog {
  data: SyncLogItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface SyncLogKPIs {
  successRate24h: number;
  successCount24h: number;
  failureCount24h: number;
  pendingRetries: number;
  failures7d: number;
}

export function listSyncLog(params: {
  page?: number;
  perPage?: number;
  direction?: 'inbound' | 'outbound';
  status?: string;
  entityType?: string;
}): Promise<PaginatedSyncLog> {
  return apiClient('/integrations/sync-log', {
    params: {
      page: params.page ?? 1,
      per_page: params.perPage ?? 50,
      direction: params.direction,
      status: params.status,
      entity_type: params.entityType,
    },
  });
}

export function getSyncLogKPIs(): Promise<SyncLogKPIs> {
  return apiClient('/integrations/sync-log/kpis');
}

export function retrySyncLogEntry(logId: string): Promise<{ status: string; taskId: string }> {
  return apiClient(`/integrations/sync-log/${logId}/retry`, { method: 'POST' });
}

// ── Bulk import (mounted on admin router) ─────────────────────────

export type BulkImportEntity = 'students' | 'fee_plans' | 'payments';

export interface BulkImportResult {
  jobId: string;
  entityType: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: Array<{ row: number; error: string }>;
}

export interface BulkImportJobStatus extends BulkImportResult {
  processedRows: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export function uploadBulkImport(
  entity: BulkImportEntity,
  file: File,
): Promise<BulkImportResult> {
  const form = new FormData();
  form.append('file', file);
  return apiClient(`/admin/bulk-import/${entity}`, {
    method: 'POST',
    body: form,
  });
}

export function getBulkImportJob(jobId: string): Promise<BulkImportJobStatus> {
  return apiClient(`/admin/bulk-import/jobs/${jobId}`);
}

export function listBulkImportJobs(
  page = 1,
  perPage = 20,
): Promise<{ data: BulkImportJobStatus[]; total: number; page: number; perPage: number }> {
  return apiClient('/admin/bulk-import/jobs', {
    params: { page, per_page: perPage },
  });
}

export function bulkImportTemplateUrl(entity: BulkImportEntity): string {
  return `/api/v1/admin/bulk-import/template/${entity}`;
}

// ── Sales persons (for AO onboarding picker) ────────────────────────

export interface SalesPersonItem {
  employeeId: string;
  salesPersonName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  commissionRate: string | null;
  hrStatus: string | null;
  alreadyMapped: boolean;
  linkedOfficerId: string | null;
}

export interface SalesPersonListResponse {
  enabled: boolean;
  cachedAt: string | null;
  error: string | null;
  salesPersons: SalesPersonItem[];
}

export async function listFrappeSalesPersons(): Promise<SalesPersonListResponse> {
  return apiClient('/integrations/frappe/sales-persons');
}

// ── Frappe Items + Payment Terms Templates (AO onboarding pickers) ───

export interface FrappeItem {
  itemCode: string;
  itemName: string;
  itemGroup: string | null;
  standardRate: number | null;
  stockUom: string | null;
}

export interface FrappeItemListResponse {
  enabled: boolean;
  cachedAt: string | null;
  error: string | null;
  items: FrappeItem[];
}

export interface PaymentTermsTemplate {
  name: string;
  templateName: string;
}

export interface PaymentTermsTemplateTermRow {
  paymentTerm: string;
  invoicePortion: number;
  creditDays: number;
  creditMonths: number;
  modeOfPayment: string | null;
  dueDateBasedOn: string | null;
}

export interface PaymentTermsTemplateDetail {
  name: string;
  templateName: string;
  allocatePaymentBasedOnPaymentTerms: boolean;
  terms: PaymentTermsTemplateTermRow[];
}

export interface PaymentTermsTemplateListResponse {
  enabled: boolean;
  cachedAt: string | null;
  error: string | null;
  templates: PaymentTermsTemplate[];
}

export async function listFrappeItems(): Promise<FrappeItemListResponse> {
  return apiClient('/integrations/frappe/items');
}

export async function listFrappePaymentTermsTemplates(): Promise<PaymentTermsTemplateListResponse> {
  return apiClient('/integrations/frappe/payment-terms-templates');
}

export async function getFrappePaymentTermsTemplate(name: string): Promise<PaymentTermsTemplateDetail> {
  return apiClient(`/integrations/frappe/payment-terms-templates/${encodeURIComponent(name)}`);
}

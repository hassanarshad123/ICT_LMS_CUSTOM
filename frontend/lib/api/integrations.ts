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

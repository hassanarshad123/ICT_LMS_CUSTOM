import { apiClient } from './client';

export interface ErrorLogItem {
  id: string;
  level: string;
  message: string;
  traceback?: string;
  requestId?: string;
  requestMethod?: string;
  requestPath?: string;
  statusCode?: number;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  source: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  extra?: Record<string, any>;
  createdAt?: string;
}

export interface ErrorStats {
  totalErrors24h: number;
  unresolvedCount: number;
  errorsByHour: { hour: string; count: number }[];
  topPaths: { path: string; count: number }[];
  errorsBySource: Record<string, number>;
  errorsByLevel: Record<string, number>;
}

export async function getErrors(params?: {
  source?: string;
  level?: string;
  resolved?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}) {
  return apiClient('/monitoring/errors', {
    params: params as Record<string, string | number | undefined>,
  });
}

export async function getErrorStats(): Promise<ErrorStats> {
  return apiClient('/monitoring/errors/stats');
}

export async function getError(id: string): Promise<ErrorLogItem> {
  return apiClient(`/monitoring/errors/${id}`);
}

export async function resolveError(id: string, resolved: boolean = true): Promise<ErrorLogItem> {
  return apiClient(`/monitoring/errors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ resolved }),
  });
}

export async function resolveAllErrors(): Promise<{ resolvedCount: number }> {
  return apiClient('/monitoring/errors/resolve-all', { method: 'POST' });
}

export async function clearResolvedErrors(olderThanDays: number = 7): Promise<{ deletedCount: number }> {
  return apiClient('/monitoring/errors/clear-resolved', {
    method: 'DELETE',
    params: { older_than_days: olderThanDays },
  });
}

export async function testDiscordAlert(): Promise<{ status: string }> {
  return apiClient('/monitoring/test-alert', { method: 'POST' });
}

export async function reportClientError(data: {
  message: string;
  stack?: string;
  url?: string;
  component?: string;
  extra?: Record<string, any>;
}): Promise<void> {
  // Use fetch directly to avoid triggering error reporting loops
  try {
    await fetch('/api/v1/monitoring/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // Silently fail — don't create error loops
  }
}

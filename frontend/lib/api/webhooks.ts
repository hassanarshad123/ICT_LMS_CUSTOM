import { apiClient } from './client';

export interface WebhookCreate {
  url: string;
  events: string[];
  description?: string;
}

export interface WebhookUpdate {
  url?: string;
  events?: string[];
  description?: string;
  isActive?: boolean;
}

export interface WebhookOut {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode: number | null;
  responseBody: string | null;
  deliveryId: string;
}

export interface WebhookDeliveryOut {
  id: string;
  eventType: string;
  status: string;
  statusCode: number | null;
  attemptCount: number;
  createdAt: string | null;
  completedAt: string | null;
}

export interface PaginatedDeliveries {
  data: WebhookDeliveryOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function createWebhook(body: WebhookCreate): Promise<WebhookOut> {
  return apiClient('/admin/webhooks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listWebhooks(): Promise<WebhookOut[]> {
  return apiClient('/admin/webhooks');
}

export function getWebhook(id: string): Promise<WebhookOut> {
  return apiClient(`/admin/webhooks/${id}`);
}

export function updateWebhook(id: string, body: WebhookUpdate): Promise<WebhookOut> {
  return apiClient(`/admin/webhooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiClient(`/admin/webhooks/${id}`, { method: 'DELETE' });
}

export function testWebhook(id: string): Promise<WebhookTestResult> {
  return apiClient(`/admin/webhooks/${id}/test`, { method: 'POST' });
}

export function listDeliveries(id: string, page = 1): Promise<PaginatedDeliveries> {
  return apiClient(`/admin/webhooks/${id}/deliveries`, {
    params: { page },
  });
}

import { apiClient } from './client';

export interface ApiKeyCreate {
  name: string;
  expiresAt?: string;
}

export interface ApiKeyOut {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  revokedAt: string | null;
}

export interface ApiKeyCreatedOut extends ApiKeyOut {
  apiKey: string;
}

export function createApiKey(body: ApiKeyCreate): Promise<ApiKeyCreatedOut> {
  return apiClient('/admin/api-keys', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listApiKeys(): Promise<ApiKeyOut[]> {
  return apiClient('/admin/api-keys');
}

export function revokeApiKey(id: string): Promise<void> {
  return apiClient(`/admin/api-keys/${id}`, { method: 'DELETE' });
}

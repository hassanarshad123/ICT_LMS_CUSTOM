import { apiClient } from './client';

export interface UserOut {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  specialization?: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  batchIds?: string[];
  batchNames?: string[];
  joinDate?: string;
}

export interface PaginatedUsers {
  data: UserOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listUsers(params?: {
  page?: number;
  per_page?: number;
  role?: string;
  status?: string;
  search?: string;
  batch_id?: string;
}): Promise<PaginatedUsers> {
  return apiClient('/users', { params: params as Record<string, string | number | undefined> });
}

export async function getUser(userId: string): Promise<UserOut> {
  return apiClient(`/users/${userId}`);
}

export async function createUser(data: {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: string;
  specialization?: string;
}): Promise<{ id: string; temporaryPassword: string }> {
  return apiClient('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(userId: string, data: Record<string, any>): Promise<UserOut> {
  return apiClient(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function changeUserStatus(userId: string, status: string): Promise<UserOut> {
  return apiClient(`/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function resetPassword(userId: string): Promise<{ temporaryPassword: string }> {
  return apiClient(`/users/${userId}/reset-password`, { method: 'POST' });
}

export async function deleteUser(userId: string): Promise<void> {
  return apiClient(`/users/${userId}`, { method: 'DELETE' });
}

export async function bulkImportUsers(file: File, batchIds?: string[]): Promise<{
  imported: number;
  skipped: number;
  enrolled: number;
  errors: { row: number; error: string }[];
}> {
  const formData = new FormData();
  formData.append('file', file);
  if (batchIds?.length) formData.append('batch_ids', batchIds.join(','));
  return apiClient('/users/bulk-import', {
    method: 'POST',
    body: formData,
    timeout: 120000,
  });
}

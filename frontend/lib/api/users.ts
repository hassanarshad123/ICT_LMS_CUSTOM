import { apiClient } from './client';

export interface UserOut {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  specialization?: string;
  avatar_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
  batch_ids?: string[];
  batch_names?: string[];
  join_date?: string;
}

export interface PaginatedUsers {
  data: UserOut[];
  total: number;
  page: number;
  per_page: number;
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
}): Promise<{ id: string; temporary_password: string }> {
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

export async function resetPassword(userId: string): Promise<{ temporary_password: string }> {
  return apiClient(`/users/${userId}/reset-password`, { method: 'POST' });
}

export async function deleteUser(userId: string): Promise<void> {
  return apiClient(`/users/${userId}`, { method: 'DELETE' });
}

export async function bulkImportUsers(file: File): Promise<{
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
}> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient('/users/bulk-import', {
    method: 'POST',
    body: formData,
  });
}

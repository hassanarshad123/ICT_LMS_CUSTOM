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
  batchActiveStatuses?: boolean[];
  joinDate?: string;
  employeeId?: string | null;
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
  employeeId?: string;
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

export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  return apiClient(`/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  return apiClient(`/users/${userId}`, { method: 'DELETE' });
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  enrolled: number;
  enrolledExisting: number;
  errors: { row: number; error: string }[];
  createdUsers: { row: number; name: string; email: string; temporaryPassword: string }[];
  existingEnrolledUsers: { row: number; name: string; email: string; temporaryPassword: string }[];
  truncated: boolean;
  totalRows: number;
}

export interface BulkImportPreviewResult {
  newUsers: { row: number; name: string; email: string }[];
  existingUsers: {
    row: number;
    name: string;
    email: string;
    userId: string;
    dbName: string;
    alreadyInBatches: string[];
  }[];
  roleMismatches: { row: number; name: string; email: string; userId: string; actualRole: string }[];
  errors: { row: number; error: string }[];
  totalNew: number;
  totalExisting: number;
  totalRoleMismatches: number;
  totalErrors: number;
  truncated: boolean;
  totalRows: number;
}

export async function previewBulkImport(file: File, batchIds?: string[]): Promise<BulkImportPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (batchIds?.length) formData.append('batch_ids', batchIds.join(','));
  return apiClient('/users/bulk-import/preview', {
    method: 'POST',
    body: formData,
    timeout: 60000,
  });
}

export async function bulkImportUsers(
  file: File,
  batchIds?: string[],
  enrollUserIds?: string[],
): Promise<BulkImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (batchIds?.length) formData.append('batch_ids', batchIds.join(','));
  if (enrollUserIds?.length) formData.append('enroll_user_ids', enrollUserIds.join(','));
  return apiClient('/users/bulk-import', {
    method: 'POST',
    body: formData,
    timeout: 120000,
  });
}

// ── Email Preferences ──────────────────────────────────────────

export interface EmailPreferenceItem {
  emailType: string;
  label: string;
  description: string;
  subscribed: boolean;
}

export async function getEmailPreferences(): Promise<{ preferences: EmailPreferenceItem[] }> {
  return apiClient('/users/me/email-preferences');
}

export async function updateEmailPreferences(
  preferences: Array<{ emailType: string; subscribed: boolean }>
): Promise<void> {
  await apiClient('/users/me/email-preferences', {
    method: 'PATCH',
    body: JSON.stringify({ preferences }),
  });
}

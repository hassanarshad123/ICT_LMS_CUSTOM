import { apiClient } from './client';

export interface ZoomAccountOut {
  id: string;
  account_name: string;
  account_id?: string;
  client_id?: string;
  is_default: boolean;
  created_at?: string;
}

export interface ZoomClassOut {
  id: string;
  title: string;
  batch_id: string;
  batch_name?: string;
  teacher_id: string;
  teacher_name?: string;
  zoom_meeting_url?: string;
  zoom_start_url?: string;
  scheduled_date: string;
  scheduled_time: string;
  duration: number;
  duration_display?: string;
  status: string;
  zoom_account_id: string;
  created_at?: string;
}

export interface PaginatedZoomClasses {
  data: ZoomClassOut[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export async function listAccounts(): Promise<ZoomAccountOut[]> {
  return apiClient('/zoom/accounts');
}

export async function createAccount(data: Record<string, any>): Promise<ZoomAccountOut> {
  return apiClient('/zoom/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAccount(accountId: string, data: Record<string, any>): Promise<ZoomAccountOut> {
  return apiClient(`/zoom/accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAccount(accountId: string): Promise<void> {
  return apiClient(`/zoom/accounts/${accountId}`, { method: 'DELETE' });
}

export async function setDefaultAccount(accountId: string): Promise<ZoomAccountOut> {
  return apiClient(`/zoom/accounts/${accountId}/set-default`, { method: 'PATCH' });
}

export async function listClasses(params?: {
  batch_id?: string;
  status?: string;
  teacher_id?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedZoomClasses> {
  return apiClient('/zoom/classes', { params: params as Record<string, string | number | undefined> });
}

export async function createClass(data: {
  title: string;
  batch_id: string;
  zoom_account_id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration: number;
}): Promise<ZoomClassOut> {
  return apiClient('/zoom/classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClass(classId: string, data: Record<string, any>): Promise<any> {
  return apiClient(`/zoom/classes/${classId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteClass(classId: string): Promise<void> {
  return apiClient(`/zoom/classes/${classId}`, { method: 'DELETE' });
}

export async function getAttendance(classId: string) {
  return apiClient(`/zoom/classes/${classId}/attendance`);
}

export async function getRecordings(classId: string) {
  return apiClient(`/zoom/classes/${classId}/recordings`);
}

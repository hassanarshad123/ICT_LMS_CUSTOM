import { apiClient } from './client';

export interface ZoomAccountOut {
  id: string;
  accountName: string;
  accountId?: string;
  clientId?: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface ZoomClassOut {
  id: string;
  title: string;
  batchId: string;
  batchName?: string;
  teacherId: string;
  teacherName?: string;
  zoomMeetingUrl?: string;
  zoomStartUrl?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  durationDisplay?: string;
  status: string;
  zoomAccountId: string;
  createdAt?: string;
}

export interface PaginatedZoomClasses {
  data: ZoomClassOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
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
  teacher_id: string;
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

export async function getFreshStartUrl(classId: string): Promise<{ startUrl: string; joinUrl: string }> {
  return apiClient(`/zoom/classes/${classId}/start-url`, { method: 'POST' });
}

export interface AttendanceItem {
  id: string;
  zoomClassId: string;
  studentId: string;
  studentName?: string;
  attended: boolean;
  joinTime?: string;
  leaveTime?: string;
  durationMinutes?: number;
}

export async function getAttendance(classId: string): Promise<AttendanceItem[]> {
  return apiClient(`/zoom/classes/${classId}/attendance`);
}

export async function syncAttendance(classId: string): Promise<{ synced: number }> {
  return apiClient(`/zoom/classes/${classId}/sync-attendance`, { method: 'POST' });
}

export async function getRecordings(classId: string) {
  return apiClient(`/zoom/classes/${classId}/recordings`);
}

// --- Global Recordings ---

export interface RecordingItem {
  id: string;
  classTitle: string;
  title?: string;
  description?: string;
  teacherName?: string;
  batchName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  status: string;
  deletedAt?: string;
  createdAt?: string;
}

export interface PaginatedRecordings {
  data: RecordingItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listRecordings(params?: {
  page?: number;
  per_page?: number;
  include_deleted?: boolean;
  batch_id?: string;
}): Promise<PaginatedRecordings> {
  return apiClient('/zoom/recordings', { params: params as Record<string, string | number | undefined> });
}

export async function getRecordingSignedUrl(recordingId: string): Promise<{ url: string; type: string; expiresAt?: number }> {
  return apiClient(`/zoom/recordings/${recordingId}/signed-url`, { method: 'POST' });
}

export async function updateRecording(id: string, data: { title?: string; description?: string }): Promise<RecordingItem> {
  return apiClient(`/zoom/recordings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRecording(id: string): Promise<void> {
  return apiClient(`/zoom/recordings/${id}`, { method: 'DELETE' });
}

export async function deleteRecordingPermanent(id: string): Promise<void> {
  return apiClient(`/zoom/recordings/${id}/permanent`, { method: 'DELETE' });
}

export async function restoreRecording(id: string): Promise<RecordingItem> {
  return apiClient(`/zoom/recordings/${id}/restore`, { method: 'POST' });
}

export interface ZoomAnalytics {
  totalClasses: number;
  upcomingClasses: number;
  liveClasses: number;
  completedClasses: number;
  totalRecordings: number;
  averageAttendanceRate: number;
}

export async function getZoomAnalytics(): Promise<ZoomAnalytics> {
  return apiClient('/zoom/analytics');
}

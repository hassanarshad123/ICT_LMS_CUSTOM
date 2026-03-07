import { apiClient } from './client';

export interface DashboardData {
  total_batches: number;
  active_batches: number;
  total_students: number;
  active_students: number;
  total_teachers: number;
  total_course_creators: number;
  total_courses: number;
  recent_batches: any[];
  recent_students: any[];
}

export interface InsightsData {
  monthly: any[];
  students_by_status: Record<string, number>;
  batches_by_status: Record<string, number>;
  enrollment_per_batch: any[];
  teacher_workload: any[];
  materials_by_type: Record<string, number>;
  lectures_per_course: any[];
  device_overview: Record<string, number>;
}

export async function getDashboard(): Promise<DashboardData> {
  return apiClient('/admin/dashboard');
}

export async function getInsights(): Promise<InsightsData> {
  return apiClient('/admin/insights');
}

export async function listDevices(params?: {
  role?: string;
  search?: string;
  page?: number;
  per_page?: number;
}) {
  return apiClient('/admin/devices', { params: params as Record<string, string | number | undefined> });
}

export async function terminateSession(sessionId: string): Promise<void> {
  return apiClient(`/admin/devices/${sessionId}`, { method: 'DELETE' });
}

export async function terminateAllUserSessions(userId: string): Promise<void> {
  return apiClient(`/admin/devices/user/${userId}`, { method: 'DELETE' });
}

export async function getSettings(): Promise<{ settings: Record<string, string> }> {
  return apiClient('/admin/settings');
}

export async function updateSettings(settings: Record<string, string>): Promise<{ settings: Record<string, string> }> {
  return apiClient('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
  });
}

export async function getActivityLog(params?: {
  action?: string;
  entity_type?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}) {
  return apiClient('/admin/activity-log', { params: params as Record<string, string | number | undefined> });
}

export async function exportData(entityType: string, format: string = 'csv') {
  return apiClient(`/admin/export/${entityType}`, { params: { format } });
}

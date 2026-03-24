import { apiClient } from './client';

// ── Dashboard typed interfaces ──────────────────────────────

export interface RecentBatch {
  id: string;
  name: string;
  startDate: string;
  teacherName: string;
  studentCount: number;
  status: string;
}

export interface RecentStudent {
  id: string;
  name: string;
  email: string;
  status: string;
  batchNames: string[];
}

export interface DashboardData {
  totalBatches: number;
  activeBatches: number;
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalCourseCreators: number;
  totalCourses: number;
  recentBatches: RecentBatch[];
  recentStudents: RecentStudent[];
}

// ── Insights typed interfaces ───────────────────────────────

export interface MonthlyStatItem {
  month: string;
  count: number;
}

export interface BatchEnrollmentItem {
  batchId: string;
  name: string;
  studentCount: number;
}

export interface TeacherWorkloadItem {
  teacherId: string;
  name: string;
  batchCount: number;
  studentCount: number;
}

export interface LecturesPerCourseItem {
  courseId: string;
  title: string;
  lectureCount: number;
}

export interface InsightsData {
  monthly: MonthlyStatItem[];
  studentsByStatus: Record<string, number>;
  batchesByStatus: Record<string, number>;
  enrollmentPerBatch: BatchEnrollmentItem[];
  teacherWorkload: TeacherWorkloadItem[];
  materialsByType: Record<string, number>;
  lecturesPerCourse: LecturesPerCourseItem[];
  deviceOverview: Record<string, number>;
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
  return apiClient('/admin/settings', { skipConversion: true });
}

export async function updateSettings(settings: Record<string, string>): Promise<{ settings: Record<string, string> }> {
  return apiClient('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
    skipConversion: true,
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

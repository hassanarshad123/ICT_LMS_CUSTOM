import { apiClient } from './client';
import { PaginatedResponse } from '@/lib/types/api';

export interface BatchOut {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  teacherId?: string;
  teacherName?: string;
  studentCount: number;
  courseCount: number;
  status: string;
  createdBy?: string;
  createdAt?: string;
  enableLectureGating: boolean;
  lectureGatingThreshold: number;
  // Per-student access status (populated for students only)
  accessExpired?: boolean;
  effectiveEndDate?: string;
  extendedEndDate?: string;
}

export interface ExtensionOut {
  studentId: string;
  batchId: string;
  previousEndDate?: string;
  newEndDate: string;
  extensionType: string;
  durationDays?: number;
  reason?: string;
}

export interface AccessDurationInput {
  accessDays?: number;
  accessEndDate?: string; // "YYYY-MM-DD"
  reason?: string;
}

export interface AccessAdjustResult {
  studentId: string;
  batchId: string;
  previousEndDate: string | null;
  newEndDate: string;
  extensionType: 'initial' | 'extend' | 'shorten';
  durationDays?: number | null;
  reason?: string | null;
}

export interface BulkAdjustResult {
  results: AccessAdjustResult[];
  count: number;
}

export interface BulkEnrollResult {
  enrolled: Array<{ studentId: string; status: string }>;
  errors: Array<{ studentId: string; error: string }>;
  count: number;
}

export interface ExtensionHistoryItem {
  id: string;
  previousEndDate?: string;
  newEndDate: string;
  extensionType: string;
  durationDays?: number;
  reason?: string;
  extendedBy: string;
  extendedByName: string;
  createdAt: string;
}

export interface StudentExpiryInfo {
  studentId: string;
  studentName: string;
  studentEmail: string;
  batchEndDate: string;
  extendedEndDate?: string;
  effectiveEndDate: string;
}

export interface ExpirySummary {
  expiringSoon: StudentExpiryInfo[];
  expired: StudentExpiryInfo[];
  adjusted: StudentExpiryInfo[];
}

export interface PaginatedBatches {
  data: BatchOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listBatches(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  teacher_id?: string;
  search?: string;
}): Promise<PaginatedBatches> {
  return apiClient('/batches', { params: params as Record<string, string | number | undefined> });
}

export async function getBatch(batchId: string): Promise<BatchOut> {
  return apiClient(`/batches/${batchId}`);
}

export async function createBatch(data: {
  name: string;
  start_date: string;
  end_date: string;
  teacher_id?: string;
}): Promise<BatchOut> {
  return apiClient('/batches', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBatch(batchId: string, data: Record<string, any>): Promise<BatchOut> {
  return apiClient(`/batches/${batchId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteBatch(batchId: string): Promise<void> {
  return apiClient(`/batches/${batchId}`, { method: 'DELETE' });
}

export async function listBatchStudents(
  batchId: string,
  params?: { page?: number; per_page?: number; search?: string },
): Promise<PaginatedResponse<any>> {
  return apiClient(`/batches/${batchId}/students`, {
    params: params as Record<string, string | number | undefined>,
  });
}

export async function enrollStudent(
  batchId: string,
  studentId: string,
  options?: AccessDurationInput,
) {
  return apiClient(`/batches/${batchId}/students`, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, ...options }),
  });
}

export async function removeStudent(batchId: string, studentId: string): Promise<void> {
  return apiClient(`/batches/${batchId}/students/${studentId}`, { method: 'DELETE' });
}

export async function toggleEnrollmentActive(
  batchId: string,
  studentId: string,
  isActive: boolean,
): Promise<{ studentId: string; batchId: string; isActive: boolean }> {
  return apiClient(`/batches/${batchId}/students/${studentId}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function listBatchCourses(batchId: string) {
  return apiClient(`/batches/${batchId}/courses`);
}

export async function linkCourse(batchId: string, courseId: string) {
  return apiClient(`/batches/${batchId}/courses`, {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId }),
  });
}

export async function unlinkCourse(batchId: string, courseId: string): Promise<void> {
  return apiClient(`/batches/${batchId}/courses/${courseId}`, { method: 'DELETE' });
}

// ── Per-student batch time extensions ──────────────────────────

export async function extendStudentAccess(
  batchId: string,
  studentId: string,
  data: { end_date?: string; duration_days?: number; reason?: string },
): Promise<ExtensionOut> {
  return apiClient(`/batches/${batchId}/students/${studentId}/extend`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getExtensionHistory(
  batchId: string,
  studentId: string,
): Promise<ExtensionHistoryItem[]> {
  return apiClient(`/batches/${batchId}/students/${studentId}/extensions`);
}

export async function getExpirySummary(batchId: string): Promise<ExpirySummary> {
  return apiClient(`/batches/${batchId}/expiry-summary`);
}

export async function setStudentAccess(
  batchId: string,
  studentId: string,
  data: AccessDurationInput & { skipNotifications?: boolean },
): Promise<AccessAdjustResult> {
  return apiClient(`/batches/${batchId}/students/${studentId}/access`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function bulkEnrollStudents(
  batchId: string,
  data: { studentIds: string[] } & AccessDurationInput & { skipNotifications?: boolean },
): Promise<BulkEnrollResult> {
  return apiClient(`/batches/${batchId}/students/bulk-enroll`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function bulkSetStudentAccess(
  batchId: string,
  data: { studentIds: string[] } & AccessDurationInput & { skipNotifications?: boolean },
): Promise<BulkAdjustResult> {
  return apiClient(`/batches/${batchId}/students/bulk-set-access`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

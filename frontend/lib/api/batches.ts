import { apiClient } from './client';

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

export async function listBatchStudents(batchId: string) {
  return apiClient(`/batches/${batchId}/students`);
}

export async function enrollStudent(batchId: string, studentId: string) {
  return apiClient(`/batches/${batchId}/students`, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId }),
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

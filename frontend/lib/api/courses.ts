import { apiClient } from './client';

export interface CourseOut {
  id: string;
  title: string;
  description?: string;
  status: string;
  batchIds: string[];
  clonedFromId?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface PaginatedCourses {
  data: CourseOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listCourses(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  batch_id?: string;
  search?: string;
}): Promise<PaginatedCourses> {
  return apiClient('/courses', { params: params as Record<string, string | number | undefined> });
}

export async function getCourse(courseId: string): Promise<CourseOut> {
  return apiClient(`/courses/${courseId}`);
}

export async function createCourse(data: { title: string; description?: string }): Promise<CourseOut> {
  return apiClient('/courses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCourse(courseId: string, data: Record<string, any>): Promise<CourseOut> {
  return apiClient(`/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCourse(courseId: string): Promise<void> {
  return apiClient(`/courses/${courseId}`, { method: 'DELETE' });
}

export async function cloneCourse(courseId: string): Promise<CourseOut> {
  return apiClient(`/courses/${courseId}/clone`, { method: 'POST' });
}

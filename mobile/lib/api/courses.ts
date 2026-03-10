import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { CourseOut } from '@/lib/types/course';

export async function listCourses(params?: {
  page?: number;
  perPage?: number;
  status?: string;
  batchId?: string;
  search?: string;
}): Promise<PaginatedResponse<CourseOut>> {
  return apiClient<PaginatedResponse<CourseOut>>('/courses', {
    params: {
      page: params?.page,
      per_page: params?.perPage,
      status: params?.status,
      batch_id: params?.batchId,
      search: params?.search,
    },
  });
}

export async function getCourse(courseId: string): Promise<CourseOut> {
  return apiClient<CourseOut>(`/courses/${courseId}`);
}

import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { BatchOut } from '@/lib/types/batch';
import type { CourseOut } from '@/lib/types/course';

export async function listBatches(params?: {
  page?: number;
  perPage?: number;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<BatchOut>> {
  return apiClient<PaginatedResponse<BatchOut>>('/batches', {
    params: {
      page: params?.page,
      per_page: params?.perPage,
      status: params?.status,
      search: params?.search,
    },
  });
}

export async function getBatch(batchId: string): Promise<BatchOut> {
  return apiClient<BatchOut>(`/batches/${batchId}`);
}

export async function listBatchCourses(batchId: string): Promise<CourseOut[]> {
  return apiClient<CourseOut[]>(`/batches/${batchId}/courses`);
}

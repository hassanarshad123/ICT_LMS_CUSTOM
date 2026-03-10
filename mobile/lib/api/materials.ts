import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { MaterialOut } from '@/lib/types/material';

export async function listMaterials(params: {
  batchId: string;
  courseId?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<MaterialOut>> {
  return apiClient<PaginatedResponse<MaterialOut>>('/materials', {
    params: {
      batch_id: params.batchId,
      course_id: params.courseId,
      page: params.page,
      per_page: params.perPage,
    },
  });
}

export async function getDownloadUrl(
  materialId: string,
): Promise<{ downloadUrl: string; fileName: string }> {
  return apiClient(`/materials/${materialId}/download-url`);
}

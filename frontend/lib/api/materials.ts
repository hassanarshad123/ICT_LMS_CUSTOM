import { apiClient } from './client';

export interface MaterialOut {
  id: string;
  batchId: string;
  courseId?: string;
  title: string;
  description?: string;
  fileName: string;
  fileType: string;
  fileSize?: string;
  fileSizeBytes?: number;
  uploadDate?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedByRole?: string;
}

export interface PaginatedMaterials {
  data: MaterialOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listMaterials(params: {
  batch_id: string;
  course_id?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedMaterials> {
  return apiClient('/materials', { params: params as Record<string, string | number | undefined> });
}

export async function getUploadUrl(data: {
  file_name: string;
  content_type: string;
  batch_id: string;
  course_id?: string;
}): Promise<{ uploadUrl: string; objectKey: string }> {
  return apiClient('/materials/upload-url', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createMaterial(data: {
  object_key: string;
  title: string;
  file_name: string;
  file_type: string;
  batch_id: string;
  description?: string;
  file_size_bytes?: number;
  course_id?: string;
}): Promise<MaterialOut> {
  return apiClient('/materials', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getDownloadUrl(materialId: string): Promise<{ downloadUrl: string; fileName: string }> {
  return apiClient(`/materials/${materialId}/download-url`);
}

export async function deleteMaterial(materialId: string): Promise<void> {
  return apiClient(`/materials/${materialId}`, { method: 'DELETE' });
}

import { apiClient } from './client';

export interface MaterialOut {
  id: string;
  batch_id: string;
  course_id?: string;
  title: string;
  description?: string;
  file_name: string;
  file_type: string;
  file_size?: string;
  file_size_bytes?: number;
  upload_date?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  uploaded_by_role?: string;
}

export interface PaginatedMaterials {
  data: MaterialOut[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
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
}): Promise<{ upload_url: string; object_key: string }> {
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

export async function getDownloadUrl(materialId: string): Promise<{ download_url: string; file_name: string }> {
  return apiClient(`/materials/${materialId}/download-url`);
}

export async function deleteMaterial(materialId: string): Promise<void> {
  return apiClient(`/materials/${materialId}`, { method: 'DELETE' });
}

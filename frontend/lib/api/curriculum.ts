import { apiClient } from './client';

export interface CurriculumModuleOut {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  topics?: string[];
  sequenceOrder: number;
  createdAt?: string;
}

export async function listModules(courseId: string): Promise<CurriculumModuleOut[]> {
  return apiClient('/curriculum', { params: { course_id: courseId } });
}

export async function createModule(data: {
  course_id: string;
  title: string;
  description?: string;
  topics?: string[];
}): Promise<CurriculumModuleOut> {
  return apiClient('/curriculum', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateModule(moduleId: string, data: Record<string, any>): Promise<CurriculumModuleOut> {
  return apiClient(`/curriculum/${moduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteModule(moduleId: string): Promise<void> {
  return apiClient(`/curriculum/${moduleId}`, { method: 'DELETE' });
}

export async function reorderModule(moduleId: string, order: number): Promise<CurriculumModuleOut> {
  return apiClient(`/curriculum/${moduleId}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ sequence_order: order }),
  });
}

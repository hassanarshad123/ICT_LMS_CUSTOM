import { apiClient } from './client';
import type { CurriculumModuleOut } from '@/lib/types/curriculum';

export async function listModules(courseId: string): Promise<CurriculumModuleOut[]> {
  return apiClient<CurriculumModuleOut[]>('/curriculum', {
    params: { course_id: courseId },
  });
}

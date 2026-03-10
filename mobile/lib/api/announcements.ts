import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { AnnouncementOut } from '@/lib/types/announcement';

export async function listAnnouncements(params?: {
  scope?: string;
  batchId?: string;
  courseId?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<AnnouncementOut>> {
  return apiClient<PaginatedResponse<AnnouncementOut>>('/announcements', {
    params: {
      scope: params?.scope,
      batch_id: params?.batchId,
      course_id: params?.courseId,
      page: params?.page,
      per_page: params?.perPage,
    },
  });
}

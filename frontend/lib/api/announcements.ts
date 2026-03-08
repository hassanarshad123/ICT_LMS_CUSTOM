import { apiClient } from './client';

export interface AnnouncementOut {
  id: string;
  title: string;
  content: string;
  scope: string;
  batchId?: string;
  courseId?: string;
  postedBy?: string;
  postedByName?: string;
  expiresAt?: string;
  createdAt?: string;
}

export interface PaginatedAnnouncements {
  data: AnnouncementOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listAnnouncements(params?: {
  scope?: string;
  batch_id?: string;
  course_id?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedAnnouncements> {
  return apiClient('/announcements', { params: params as Record<string, string | number | undefined> });
}

export async function createAnnouncement(data: {
  title: string;
  content: string;
  scope: string;
  batch_id?: string;
  course_id?: string;
  expires_at?: string;
}): Promise<AnnouncementOut> {
  return apiClient('/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAnnouncement(id: string, data: Record<string, any>): Promise<AnnouncementOut> {
  return apiClient(`/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  return apiClient(`/announcements/${id}`, { method: 'DELETE' });
}

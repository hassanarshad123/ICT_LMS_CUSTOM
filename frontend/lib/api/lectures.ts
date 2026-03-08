import { apiClient } from './client';

export interface LectureOut {
  id: string;
  title: string;
  description?: string;
  videoType: string;
  videoUrl?: string;
  bunnyVideoId?: string;
  duration?: number;
  durationDisplay?: string;
  fileSize?: number;
  batchId: string;
  courseId?: string;
  sequenceOrder: number;
  thumbnailUrl?: string;
  uploadDate?: string;
  createdAt?: string;
}

export interface PaginatedLectures {
  data: LectureOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listLectures(params: {
  batch_id: string;
  course_id?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedLectures> {
  return apiClient('/lectures', { params: params as Record<string, string | number | undefined> });
}

export async function getLecture(lectureId: string): Promise<LectureOut> {
  return apiClient(`/lectures/${lectureId}`);
}

export async function createLecture(data: {
  title: string;
  batch_id: string;
  video_type?: string;
  video_url?: string;
  duration?: number;
  description?: string;
  course_id?: string;
}): Promise<LectureOut> {
  return apiClient('/lectures', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateLecture(lectureId: string, data: Record<string, any>): Promise<LectureOut> {
  return apiClient(`/lectures/${lectureId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteLecture(lectureId: string): Promise<void> {
  return apiClient(`/lectures/${lectureId}`, { method: 'DELETE' });
}

export async function getSignedUrl(lectureId: string): Promise<{ url: string; expiresAt: string }> {
  return apiClient(`/lectures/${lectureId}/signed-url`, { method: 'POST' });
}

export async function updateProgress(lectureId: string, data: {
  watch_percentage: number;
  resume_position_seconds?: number;
}): Promise<{ lectureId: string; watchPercentage: number; status: string }> {
  return apiClient(`/lectures/${lectureId}/progress`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProgress(lectureId: string): Promise<{
  lectureId: string;
  watchPercentage: number;
  resumePositionSeconds: number;
  status: string;
}> {
  return apiClient(`/lectures/${lectureId}/progress`);
}

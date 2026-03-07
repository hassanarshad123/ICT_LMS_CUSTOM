import { apiClient } from './client';

export interface LectureOut {
  id: string;
  title: string;
  description?: string;
  video_type: string;
  video_url?: string;
  bunny_video_id?: string;
  duration?: number;
  duration_display?: string;
  file_size?: number;
  batch_id: string;
  course_id?: string;
  sequence_order: number;
  thumbnail_url?: string;
  upload_date?: string;
  created_at?: string;
}

export interface PaginatedLectures {
  data: LectureOut[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
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

export async function getSignedUrl(lectureId: string): Promise<{ url: string; expires_at: string }> {
  return apiClient(`/lectures/${lectureId}/signed-url`, { method: 'POST' });
}

export async function updateProgress(lectureId: string, data: {
  watch_percentage: number;
  resume_position_seconds?: number;
}): Promise<{ lecture_id: string; watch_percentage: number; status: string }> {
  return apiClient(`/lectures/${lectureId}/progress`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProgress(lectureId: string): Promise<{
  lecture_id: string;
  watch_percentage: number;
  resume_position_seconds: number;
  status: string;
}> {
  return apiClient(`/lectures/${lectureId}/progress`);
}

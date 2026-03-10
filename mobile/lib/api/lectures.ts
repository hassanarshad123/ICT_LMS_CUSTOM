import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { LectureOut } from '@/lib/types/lecture';

export async function listLectures(params: {
  batchId: string;
  courseId?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<LectureOut>> {
  return apiClient<PaginatedResponse<LectureOut>>('/lectures', {
    params: {
      batch_id: params.batchId,
      course_id: params.courseId,
      page: params.page,
      per_page: params.perPage,
    },
  });
}

export async function getLecture(lectureId: string): Promise<LectureOut> {
  return apiClient<LectureOut>(`/lectures/${lectureId}`);
}

export async function getSignedUrl(
  lectureId: string,
): Promise<{ url: string; expiresAt: string; type: string }> {
  return apiClient<{ url: string; expiresAt: string; type: string }>(
    `/lectures/${lectureId}/signed-url`,
    { method: 'POST' },
  );
}

export async function updateProgress(
  lectureId: string,
  body: { watchPercentage: number; resumePositionSeconds?: number },
): Promise<{ lectureId: string; watchPercentage: number; status: string }> {
  return apiClient(`/lectures/${lectureId}/progress`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getProgress(
  lectureId: string,
): Promise<{ lectureId: string; watchPercentage: number; resumePositionSeconds: number; status: string }> {
  return apiClient(`/lectures/${lectureId}/progress`);
}

export async function getLectureStatus(
  lectureId: string,
): Promise<{ videoStatus: string; lectureId: string }> {
  return apiClient(`/lectures/${lectureId}/status`);
}

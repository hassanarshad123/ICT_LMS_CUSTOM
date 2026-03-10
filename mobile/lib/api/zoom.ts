import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { ZoomClassOut, AttendanceItem, RecordingItem } from '@/lib/types/zoom';

export async function listClasses(params?: {
  batchId?: string;
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<ZoomClassOut>> {
  return apiClient<PaginatedResponse<ZoomClassOut>>('/zoom/classes', {
    params: {
      batch_id: params?.batchId,
      status: params?.status,
      page: params?.page,
      per_page: params?.perPage,
    },
  });
}

export async function getAttendance(classId: string): Promise<AttendanceItem[]> {
  return apiClient<AttendanceItem[]>(`/zoom/classes/${classId}/attendance`);
}

export async function getRecordings(classId: string): Promise<RecordingItem[]> {
  return apiClient<RecordingItem[]>(`/zoom/classes/${classId}/recordings`);
}

export async function listRecordings(params?: {
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<RecordingItem>> {
  return apiClient<PaginatedResponse<RecordingItem>>('/zoom/recordings', {
    params: {
      page: params?.page,
      per_page: params?.perPage,
    },
  });
}

export async function getRecordingSignedUrl(recordingId: string): Promise<{ url: string; type: string }> {
  return apiClient<{ url: string; type: string }>(`/zoom/recordings/${recordingId}/signed-url`, {
    method: 'POST',
  });
}

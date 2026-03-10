import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { CertificateOut, StudentDashboardCourse } from '@/lib/types/certificate';

export async function getStudentDashboard(): Promise<StudentDashboardCourse[]> {
  return apiClient<StudentDashboardCourse[]>('/certificates/my-dashboard');
}

export async function requestCertificate(body: {
  batchId: string;
  courseId: string;
  certificateName: string;
}): Promise<CertificateOut> {
  return apiClient<CertificateOut>('/certificates/request', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listCertificates(params?: {
  batchId?: string;
  courseId?: string;
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<CertificateOut>> {
  return apiClient<PaginatedResponse<CertificateOut>>('/certificates', {
    params: {
      batch_id: params?.batchId,
      course_id: params?.courseId,
      status: params?.status,
      page: params?.page,
      per_page: params?.perPage,
    },
  });
}

export async function getCertificate(certUuid: string): Promise<CertificateOut> {
  return apiClient<CertificateOut>(`/certificates/${certUuid}`);
}

export async function downloadCertificate(certUuid: string): Promise<{ downloadUrl: string }> {
  return apiClient<{ downloadUrl: string }>(`/certificates/${certUuid}/download`);
}

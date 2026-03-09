import { apiClient } from './client';

export interface CertificateOut {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  certificateId: string;
  verificationCode: string;
  status: string;
  completionPercentage: number;
  approvedBy?: string;
  approvedAt?: string;
  issuedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
  createdAt?: string;
}

export interface EligibleStudentOut {
  studentId: string;
  studentName: string;
  studentEmail: string;
  completionPercentage: number;
}

export interface PaginatedCertificates {
  data: CertificateOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface PaginatedEligible {
  data: EligibleStudentOut[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface CertificateVerifyOut {
  valid: boolean;
  certificateId?: string;
  studentName?: string;
  courseTitle?: string;
  batchName?: string;
  issuedAt?: string;
  status?: string;
}

export async function listCertificates(params?: {
  batch_id?: string;
  course_id?: string;
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedCertificates> {
  return apiClient('/certificates', { params: params as Record<string, string | number | undefined> });
}

export async function getCertificate(certUuid: string): Promise<CertificateOut> {
  return apiClient(`/certificates/${certUuid}`);
}

export async function listEligibleStudents(params: {
  batch_id: string;
  course_id: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedEligible> {
  return apiClient('/certificates/eligible', { params: params as Record<string, string | number | undefined> });
}

export async function approveCertificate(
  studentId: string,
  batchId: string,
  courseId: string,
): Promise<CertificateOut> {
  return apiClient(`/certificates/approve/${studentId}?batch_id=${batchId}&course_id=${courseId}`, {
    method: 'POST',
  });
}

export async function approveBatchCertificates(
  studentIds: string[],
  batchId: string,
  courseId: string,
): Promise<CertificateOut[]> {
  return apiClient(`/certificates/approve-batch?batch_id=${batchId}&course_id=${courseId}`, {
    method: 'POST',
    body: JSON.stringify({ student_ids: studentIds }),
  });
}

export async function downloadCertificate(certUuid: string): Promise<{ downloadUrl: string }> {
  return apiClient(`/certificates/${certUuid}/download`);
}

export async function revokeCertificate(certUuid: string, reason: string): Promise<CertificateOut> {
  return apiClient(`/certificates/${certUuid}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export async function verifyCertificate(code: string): Promise<CertificateVerifyOut> {
  const res = await fetch(`${API_BASE}/certificates/verify/${code}`);
  if (!res.ok) {
    throw new Error('Verification failed');
  }
  const json = await res.json();
  // Manual camelCase conversion for public endpoint (no auth client)
  return {
    valid: json.valid,
    certificateId: json.certificate_id,
    studentName: json.student_name,
    courseTitle: json.course_title,
    batchName: json.batch_name,
    issuedAt: json.issued_at,
    status: json.status,
  };
}

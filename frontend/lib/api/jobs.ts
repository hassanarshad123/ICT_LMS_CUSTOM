import { apiClient } from './client';

export interface JobOut {
  id: string;
  title: string;
  company: string;
  location?: string;
  type: string;
  salary?: string;
  description?: string;
  requirements?: string[];
  posted_date?: string;
  deadline?: string;
  posted_by?: string;
}

export interface PaginatedJobs {
  data: JobOut[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export async function listJobs(params?: {
  page?: number;
  per_page?: number;
  type?: string;
  search?: string;
}): Promise<PaginatedJobs> {
  return apiClient('/jobs', { params: params as Record<string, string | number | undefined> });
}

export async function getJob(jobId: string): Promise<JobOut> {
  return apiClient(`/jobs/${jobId}`);
}

export async function createJob(data: Record<string, any>): Promise<JobOut> {
  return apiClient('/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateJob(jobId: string, data: Record<string, any>): Promise<JobOut> {
  return apiClient(`/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteJob(jobId: string): Promise<void> {
  return apiClient(`/jobs/${jobId}`, { method: 'DELETE' });
}

export async function applyToJob(jobId: string, data: {
  resume_key?: string;
  cover_letter?: string;
}): Promise<{ id: string; status: string }> {
  return apiClient(`/jobs/${jobId}/apply`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listApplications(jobId: string) {
  return apiClient(`/jobs/${jobId}/applications`);
}

export async function updateApplicationStatus(jobId: string, appId: string, status: string) {
  return apiClient(`/jobs/${jobId}/applications/${appId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getMyApplications() {
  return apiClient('/jobs/my-applications');
}

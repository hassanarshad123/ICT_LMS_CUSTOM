import { apiClient } from './client';
import type { PaginatedResponse } from '@/lib/types/api';
import type { JobOut, Application } from '@/lib/types/job';

export async function listJobs(params?: {
  page?: number;
  perPage?: number;
  type?: string;
  search?: string;
}): Promise<PaginatedResponse<JobOut>> {
  return apiClient<PaginatedResponse<JobOut>>('/jobs', {
    params: {
      page: params?.page,
      per_page: params?.perPage,
      type: params?.type,
      search: params?.search,
    },
  });
}

export async function getJob(jobId: string): Promise<JobOut> {
  return apiClient<JobOut>(`/jobs/${jobId}`);
}

export async function applyToJob(
  jobId: string,
  body: { resumeKey?: string; coverLetter?: string },
): Promise<{ id: string; status: string }> {
  return apiClient(`/jobs/${jobId}/apply`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getMyApplications(): Promise<Application[]> {
  return apiClient<Application[]>('/jobs/my-applications');
}

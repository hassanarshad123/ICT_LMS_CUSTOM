import { apiClient } from './client';

export interface InstituteOut {
  id: string;
  name: string;
  slug: string;
  status: string;
  planTier: string;
  maxUsers: number;
  maxStorageGb: number;
  maxVideoGb: number;
  contactEmail: string;
  expiresAt: string | null;
  createdAt: string | null;
  currentUsers: number;
  currentStorageGb: number;
  currentVideoGb: number;
}

export interface PlatformDashboard {
  totalInstitutes: number;
  activeInstitutes: number;
  suspendedInstitutes: number;
  trialInstitutes: number;
  totalUsers: number;
  totalStorageGb: number;
  totalVideoGb: number;
  institutesByPlan: {
    free: number;
    basic: number;
    pro: number;
    enterprise: number;
  };
  recentInstitutes: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    planTier: string;
    createdAt: string | null;
  }>;
}

export interface InstituteCreate {
  name: string;
  slug: string;
  contactEmail: string;
  planTier?: string;
  maxUsers?: number;
  maxStorageGb?: number;
  maxVideoGb?: number;
  expiresAt?: string | null;
}

export interface AdminCreate {
  email: string;
  name: string;
  password: string;
  phone?: string;
}

export async function getPlatformDashboard(): Promise<PlatformDashboard> {
  return apiClient<PlatformDashboard>('/super-admin/dashboard');
}

export async function listInstitutes(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  plan_tier?: string;
}): Promise<{ data: InstituteOut[]; total: number; page: number; perPage: number; totalPages: number }> {
  return apiClient('/super-admin/institutes', { params });
}

export async function getInstitute(id: string): Promise<InstituteOut> {
  return apiClient<InstituteOut>(`/super-admin/institutes/${id}`);
}

export async function createInstitute(data: InstituteCreate): Promise<InstituteOut> {
  return apiClient<InstituteOut>('/super-admin/institutes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateInstitute(id: string, data: Partial<InstituteCreate> & { status?: string }): Promise<InstituteOut> {
  return apiClient<InstituteOut>(`/super-admin/institutes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function suspendInstitute(id: string): Promise<void> {
  await apiClient(`/super-admin/institutes/${id}/suspend`, { method: 'POST' });
}

export async function activateInstitute(id: string): Promise<void> {
  await apiClient(`/super-admin/institutes/${id}/activate`, { method: 'POST' });
}

export async function createAdminForInstitute(
  id: string,
  data: AdminCreate
): Promise<{ id: string; email: string; name: string; role: string }> {
  return apiClient(`/super-admin/institutes/${id}/admin`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getInstituteUsers(id: string, params?: { page?: number; per_page?: number }): Promise<any> {
  return apiClient(`/super-admin/institutes/${id}/users`, { params });
}

export async function getInstituteCourses(id: string, params?: { page?: number; per_page?: number }): Promise<any> {
  return apiClient(`/super-admin/institutes/${id}/courses`, { params });
}

export async function getInstituteBatches(id: string, params?: { page?: number; per_page?: number }): Promise<any> {
  return apiClient(`/super-admin/institutes/${id}/batches`, { params });
}

import { apiClient } from './client';

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  status: string;
  avatar_url?: string;
  batch_ids: string[];
  batch_names: string[];
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function logoutAll(): Promise<{ detail: string; sessions_terminated: number }> {
  return apiClient('/auth/logout-all', { method: 'POST' });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function getMe(): Promise<AuthUser> {
  return apiClient<AuthUser>('/auth/me');
}

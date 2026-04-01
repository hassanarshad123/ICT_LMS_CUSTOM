import { apiClient } from './client';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  status: string;
  avatarUrl?: string;
  batchIds: string[];
  batchNames: string[];
  instituteId?: string;
  instituteSlug?: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      device_info: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : undefined,
    }),
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function logoutAll(): Promise<{ detail: string; sessionsTerminated: number }> {
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

export async function forgotPassword(email: string): Promise<{ detail: string }> {
  return apiClient('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ detail: string }> {
  return apiClient('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

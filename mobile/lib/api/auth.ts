import { apiClient } from './client';
import type { LoginResponse, AuthUser } from '@/lib/types/auth';

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
    skipConversion: true,
  });
}

export async function logoutAll(): Promise<{ detail: string; sessionsTerminated: number }> {
  return apiClient('/auth/logout-all', { method: 'POST' });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    skipConversion: true,
  });
}

export async function getMe(): Promise<AuthUser> {
  return apiClient<AuthUser>('/auth/me');
}

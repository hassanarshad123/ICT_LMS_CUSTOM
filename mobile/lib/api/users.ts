import { apiClient } from './client';
import type { AuthUser } from '@/lib/types/auth';

export async function getUser(userId: string): Promise<AuthUser> {
  return apiClient<AuthUser>(`/users/${userId}`);
}

export async function updateUser(
  userId: string,
  body: { name?: string; phone?: string },
): Promise<AuthUser> {
  return apiClient<AuthUser>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

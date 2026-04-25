import { apiClient } from './client';
import type {
  CustomRole,
  CustomRoleDetail,
  PermissionGroup,
  SystemRolePermissions,
  UserPermissionsResponse,
} from '../types/rbac';

export async function getMyPermissions(): Promise<UserPermissionsResponse> {
  return apiClient<UserPermissionsResponse>('/auth/permissions');
}

export async function listRoles(): Promise<CustomRole[]> {
  return apiClient<CustomRole[]>('/admin/roles');
}

export async function getRole(id: string): Promise<CustomRoleDetail> {
  return apiClient<CustomRoleDetail>(`/admin/roles/${id}`);
}

export async function createRole(data: {
  name: string;
  description?: string;
  viewType: string;
  permissions: string[];
}): Promise<CustomRoleDetail> {
  return apiClient<CustomRoleDetail>('/admin/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(
  id: string,
  data: { name?: string; description?: string; viewType?: string },
): Promise<CustomRole> {
  return apiClient<CustomRole>(`/admin/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(id: string): Promise<{ detail: string }> {
  return apiClient<{ detail: string }>(`/admin/roles/${id}`, { method: 'DELETE' });
}

export async function setRolePermissions(
  roleId: string,
  permissions: string[],
): Promise<{ permissions: string[] }> {
  return apiClient<{ permissions: string[] }>(`/admin/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });
}

export async function getPermissionGroups(): Promise<PermissionGroup[]> {
  return apiClient<PermissionGroup[]>('/admin/permissions');
}

export async function getSystemRolePermissions(): Promise<SystemRolePermissions[]> {
  return apiClient<SystemRolePermissions[]>('/admin/system-roles');
}

export async function assignUserRole(
  userId: string,
  roleSlug: string,
): Promise<{ detail: string; userId: string; role: string; customRoleId: string | null }> {
  return apiClient(`/users/${userId}/assign-role`, {
    method: 'PATCH',
    body: JSON.stringify({ role_slug: roleSlug }),
  });
}

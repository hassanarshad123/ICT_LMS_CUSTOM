export type ViewType = 'student_view' | 'staff_view' | 'admin_view';

export type Permission = string;

export interface CustomRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  viewType: ViewType;
  isActive: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomRoleDetail extends CustomRole {
  permissions: string[];
}

export interface PermissionItem {
  code: string;
  module: string;
  action: string;
  description: string | null;
}

export interface PermissionGroup {
  module: string;
  label: string;
  permissions: PermissionItem[];
}

export interface UserPermissionsResponse {
  permissions: string[];
  viewType: ViewType | null;
  customRoleId: string | null;
  customRoleSlug: string | null;
}

export interface SystemRolePermissions {
  role: string;
  permissions: string[];
  isSystem: boolean;
}

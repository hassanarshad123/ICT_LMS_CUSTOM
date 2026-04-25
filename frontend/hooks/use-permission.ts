import { useAuth } from '@/lib/auth-context';

export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

export function useAnyPermission(...permissions: string[]): boolean {
  const { hasAnyPermission } = useAuth();
  return hasAnyPermission(...permissions);
}

export function useAllPermissions(...permissions: string[]): boolean {
  const { hasAllPermissions } = useAuth();
  return hasAllPermissions(...permissions);
}

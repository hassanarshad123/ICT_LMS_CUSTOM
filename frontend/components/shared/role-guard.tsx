'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { UserRole } from '@/lib/types';

interface RoleGuardProps {
  /** @deprecated Use `required` instead. Legacy role-based check. */
  allowed?: UserRole[];
  required?: string | string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGuard({ allowed, required, requireAll, children, fallback }: RoleGuardProps) {
  const { role, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const router = useRouter();

  let hasAccess = false;

  if (required) {
    const perms = Array.isArray(required) ? required : [required];
    hasAccess = requireAll
      ? hasAllPermissions(...perms)
      : hasAnyPermission(...perms);
  } else if (allowed) {
    hasAccess = allowed.includes(role);
  }

  useEffect(() => {
    if (role && !hasAccess) {
      if (!fallback) router.replace('/login');
    }
  }, [role, hasAccess, router, fallback]);

  if (!role || !hasAccess) return fallback ? <>{fallback}</> : null;

  return <>{children}</>;
}

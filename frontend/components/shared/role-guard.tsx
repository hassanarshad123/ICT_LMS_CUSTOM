'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { UserRole } from '@/lib/types';

interface RoleGuardProps {
  allowed: UserRole[];
  children: React.ReactNode;
}

export default function RoleGuard({ allowed, children }: RoleGuardProps) {
  const { role } = useAuth();
  const router = useRouter();

  // Admin always has access to every route
  const hasAccess = role === 'admin' || allowed.includes(role);

  useEffect(() => {
    if (role && !hasAccess) {
      router.replace('/login');
    }
  }, [role, hasAccess, router]);

  if (!role || !hasAccess) return null;

  return <>{children}</>;
}

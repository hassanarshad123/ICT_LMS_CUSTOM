'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import UserDetailView from '@/components/shared/user-detail-view';

export default function UserDetailPage() {
  return (
    <RoleGuard required={P.USERS_VIEW}>
      <UserDetailView />
    </RoleGuard>
  );
}

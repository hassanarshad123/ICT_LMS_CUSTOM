'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import UsersListView from '@/components/shared/users-list-view';

export default function UsersPage() {
  return (
    <RoleGuard required={P.USERS_VIEW}>
      <UsersListView />
    </RoleGuard>
  );
}

'use client';

import RoleGuard from '@/components/shared/role-guard';
import UsersListView from '@/components/shared/users-list-view';

export default function UsersPage() {
  return (
    <RoleGuard allowed={['admin', 'course-creator']}>
      <UsersListView />
    </RoleGuard>
  );
}

'use client';

import RoleGuard from '@/components/shared/role-guard';
import UserDetailView from '@/components/shared/user-detail-view';

export default function UserDetailPage() {
  return (
    <RoleGuard allowed={['admin', 'course-creator']}>
      <UserDetailView />
    </RoleGuard>
  );
}

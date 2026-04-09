'use client';

import RoleGuard from '@/components/shared/role-guard';
import AdminDevices from '@/components/pages/admin/devices';

export default function DevicesPage() {
  return (
    <RoleGuard allowed={['admin', 'course-creator']}>
      <AdminDevices />
    </RoleGuard>
  );
}

'use client';

import RoleGuard from '@/components/shared/role-guard';
import AdminTeachers from '@/components/pages/admin/teachers';

export default function TeachersPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <AdminTeachers />
    </RoleGuard>
  );
}

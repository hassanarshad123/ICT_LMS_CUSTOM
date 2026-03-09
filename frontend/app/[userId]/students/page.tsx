'use client';

import RoleGuard from '@/components/shared/role-guard';
import AdminStudents from '@/components/pages/admin/students';

export default function StudentsPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <AdminStudents />
    </RoleGuard>
  );
}

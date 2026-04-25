'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminStudents from '@/components/pages/admin/students';

export default function StudentsPage() {
  return (
    <RoleGuard required={P.USERS_VIEW}>
      <AdminStudents />
    </RoleGuard>
  );
}

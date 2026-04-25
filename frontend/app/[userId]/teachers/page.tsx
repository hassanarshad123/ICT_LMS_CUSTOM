'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminTeachers from '@/components/pages/admin/teachers';

export default function TeachersPage() {
  return (
    <RoleGuard required={P.USERS_VIEW}>
      <AdminTeachers />
    </RoleGuard>
  );
}

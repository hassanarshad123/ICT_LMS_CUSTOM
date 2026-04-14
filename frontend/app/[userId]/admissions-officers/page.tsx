'use client';

import RoleGuard from '@/components/shared/role-guard';
import AdminAdmissionsOfficers from '@/components/pages/admin/admissions-officers';

export default function AdmissionsOfficersPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <AdminAdmissionsOfficers />
    </RoleGuard>
  );
}

'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminAdmissionsOfficers from '@/components/pages/admin/admissions-officers';

export default function AdmissionsOfficersPage() {
  return (
    <RoleGuard required={P.USERS_VIEW}>
      <AdminAdmissionsOfficers />
    </RoleGuard>
  );
}

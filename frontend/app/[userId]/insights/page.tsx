'use client';

import RoleGuard from '@/components/shared/role-guard';
import AdminInsights from '@/components/pages/admin/insights';

export default function InsightsPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <AdminInsights />
    </RoleGuard>
  );
}

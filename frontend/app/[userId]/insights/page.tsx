'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminInsights from '@/components/pages/admin/insights';

export default function InsightsPage() {
  return (
    <RoleGuard required={P.DASHBOARD_VIEW_INSIGHTS}>
      <AdminInsights />
    </RoleGuard>
  );
}

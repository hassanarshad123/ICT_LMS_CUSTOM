'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminMonitoring from '@/components/pages/admin/monitoring';

export default function MonitoringPage() {
  return (
    <RoleGuard required={P.MONITORING_VIEW_ERRORS}>
      <AdminMonitoring />
    </RoleGuard>
  );
}

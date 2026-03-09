'use client';

import RoleGuard from '@/components/shared/role-guard';
import AdminMonitoring from '@/components/pages/admin/monitoring';

export default function MonitoringPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <AdminMonitoring />
    </RoleGuard>
  );
}

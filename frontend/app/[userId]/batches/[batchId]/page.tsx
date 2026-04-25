'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminBatchDetail from '@/components/pages/admin/batch-detail';
import CCBatchDetail from '@/components/pages/cc/batch-detail';

export default function BatchDetailPage() {
  const { role } = useAuth();
  return (
    <RoleGuard required={P.BATCHES_VIEW}>
      {(role === 'course-creator' || role === 'admin') ? <CCBatchDetail /> : <AdminBatchDetail />}
    </RoleGuard>
  );
}

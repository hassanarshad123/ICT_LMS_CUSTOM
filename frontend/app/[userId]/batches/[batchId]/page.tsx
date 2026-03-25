'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import AdminBatchDetail from '@/components/pages/admin/batch-detail';
import CCBatchDetail from '@/components/pages/cc/batch-detail';

export default function BatchDetailPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'course-creator']}>
      {(role === 'course-creator' || role === 'admin') ? <CCBatchDetail /> : <AdminBatchDetail />}
    </RoleGuard>
  );
}

'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import AdminBatches from '@/components/pages/admin/batches';
import CCBatches from '@/components/pages/cc/batches';
import TeacherBatches from '@/components/pages/teacher/batches';

export default function BatchesPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'course-creator', 'teacher']}>
      {role === 'course-creator' ? <CCBatches /> : role === 'teacher' ? <TeacherBatches /> : <AdminBatches />}
    </RoleGuard>
  );
}

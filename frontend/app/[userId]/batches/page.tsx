'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminBatches from '@/components/pages/admin/batches';
import CCBatches from '@/components/pages/cc/batches';
import TeacherBatches from '@/components/pages/teacher/batches';

function BatchesForRole({ role }: { role: string }) {
  switch (role) {
    case 'admin': return <CCBatches />;
    case 'course-creator': return <CCBatches />;
    case 'teacher': return <TeacherBatches />;
    default: return <AdminBatches />;
  }
}

export default function BatchesPage() {
  const { role } = useAuth();
  return (
    <RoleGuard required={P.BATCHES_VIEW}>
      <BatchesForRole role={role} />
    </RoleGuard>
  );
}

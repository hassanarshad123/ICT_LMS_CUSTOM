'use client';

import RoleGuard from '@/components/shared/role-guard';
import CCSchedule from '@/components/pages/cc/schedule';

export default function SchedulePage() {
  return (
    <RoleGuard allowed={['admin', 'course-creator']}>
      <CCSchedule />
    </RoleGuard>
  );
}

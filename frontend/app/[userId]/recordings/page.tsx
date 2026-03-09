'use client';

import RoleGuard from '@/components/shared/role-guard';
import RecordingsPage from '@/components/pages/recordings';

export default function RecordingsRoute() {
  return (
    <RoleGuard allowed={['admin', 'course-creator', 'teacher', 'student']}>
      <RecordingsPage />
    </RoleGuard>
  );
}

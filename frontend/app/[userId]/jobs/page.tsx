'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import CCJobs from '@/components/pages/cc/jobs';
import StudentJobs from '@/components/pages/student/jobs';

export default function JobsPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'course-creator', 'student']}>
      {role === 'student' ? <StudentJobs /> : <CCJobs />}
    </RoleGuard>
  );
}

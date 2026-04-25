'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import { resolveViewComponent } from '@/lib/utils/view-type-resolver';
import CCJobs from '@/components/pages/cc/jobs';
import StudentJobs from '@/components/pages/student/jobs';

export default function JobsPage() {
  const { viewType } = useAuth();
  const Component = resolveViewComponent(viewType, {
    student_view: StudentJobs,
    staff_view: CCJobs,
    admin_view: CCJobs,
  });
  return (
    <RoleGuard required={P.JOBS_VIEW}>
      <Component />
    </RoleGuard>
  );
}

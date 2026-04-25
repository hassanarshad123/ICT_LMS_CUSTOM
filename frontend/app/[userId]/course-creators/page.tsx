'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminCourseCreators from '@/components/pages/admin/course-creators';

export default function CourseCreatorsPage() {
  return (
    <RoleGuard required={P.USERS_VIEW}>
      <AdminCourseCreators />
    </RoleGuard>
  );
}

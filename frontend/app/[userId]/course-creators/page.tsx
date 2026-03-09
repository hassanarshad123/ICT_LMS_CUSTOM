'use client';

import RoleGuard from '@/components/shared/role-guard';
import AdminCourseCreators from '@/components/pages/admin/course-creators';

export default function CourseCreatorsPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <AdminCourseCreators />
    </RoleGuard>
  );
}

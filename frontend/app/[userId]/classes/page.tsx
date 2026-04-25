'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import { resolveViewComponent } from '@/lib/utils/view-type-resolver';
import TeacherClasses from '@/components/pages/teacher/classes';
import StudentClasses from '@/components/pages/student/classes';

export default function ClassesPage() {
  const { viewType } = useAuth();
  const Component = resolveViewComponent(viewType, {
    student_view: StudentClasses,
    staff_view: TeacherClasses,
    admin_view: TeacherClasses,
  });
  return (
    <RoleGuard required={P.ZOOM_VIEW_CLASSES}>
      <Component />
    </RoleGuard>
  );
}

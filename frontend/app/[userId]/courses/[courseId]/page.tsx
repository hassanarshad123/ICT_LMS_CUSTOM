'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import CCCourseDetail from '@/components/pages/cc/course-detail';
import TeacherCourseDetail from '@/components/pages/teacher/course-detail';
import StudentCourseDetail from '@/components/pages/student/course-detail';

function CourseDetailForRole({ role }: { role: string }) {
  switch (role) {
    case 'course-creator': return <CCCourseDetail />;
    case 'teacher': return <TeacherCourseDetail />;
    case 'student': return <StudentCourseDetail />;
    default: return <CCCourseDetail />;
  }
}

export default function CourseDetailPage() {
  const { role } = useAuth();
  return (
    <RoleGuard required={P.COURSES_VIEW}>
      <CourseDetailForRole role={role} />
    </RoleGuard>
  );
}

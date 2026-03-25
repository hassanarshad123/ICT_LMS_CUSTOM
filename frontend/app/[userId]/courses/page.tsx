'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import AdminCourses from '@/components/pages/admin/courses';
import CCCourses from '@/components/pages/cc/courses';
import TeacherCourses from '@/components/pages/teacher/courses';
import StudentCourses from '@/components/pages/student/courses';

function CoursesForRole({ role }: { role: string }) {
  switch (role) {
    case 'admin': return <CCCourses />;
    case 'course-creator': return <CCCourses />;
    case 'teacher': return <TeacherCourses />;
    case 'student': return <StudentCourses />;
    default: return <AdminCourses />;
  }
}

export default function CoursesPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'course-creator', 'teacher', 'student']}>
      <CoursesForRole role={role} />
    </RoleGuard>
  );
}

'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import AdminCourses from '@/components/pages/admin/courses';
import CCCourses from '@/components/pages/cc/courses';
import TeacherCourses from '@/components/pages/teacher/courses';
import StudentCourses from '@/components/pages/student/courses';

export default function CoursesPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'course-creator', 'teacher', 'student']}>
      {role === 'course-creator' ? <CCCourses /> :
       role === 'teacher' ? <TeacherCourses /> :
       role === 'student' ? <StudentCourses /> :
       <AdminCourses />}
    </RoleGuard>
  );
}

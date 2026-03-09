'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import CCCourseDetail from '@/components/pages/cc/course-detail';
import TeacherCourseDetail from '@/components/pages/teacher/course-detail';
import StudentCourseDetail from '@/components/pages/student/course-detail';

export default function CourseDetailPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'course-creator', 'teacher', 'student']}>
      {role === 'course-creator' ? <CCCourseDetail /> :
       role === 'teacher' ? <TeacherCourseDetail /> :
       role === 'student' ? <StudentCourseDetail /> :
       <CCCourseDetail />}
    </RoleGuard>
  );
}

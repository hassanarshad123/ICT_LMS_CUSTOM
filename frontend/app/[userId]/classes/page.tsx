'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import TeacherClasses from '@/components/pages/teacher/classes';
import StudentClasses from '@/components/pages/student/classes';

export default function ClassesPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'teacher', 'student']}>
      {role === 'student' ? <StudentClasses /> : <TeacherClasses />}
    </RoleGuard>
  );
}

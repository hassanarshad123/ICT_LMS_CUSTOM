'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import AdminAnnouncements from '@/components/pages/admin/announcements';
import StudentAnnouncements from '@/components/pages/student/announcements';

export default function AnnouncementsPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'course-creator', 'teacher', 'student']}>
      {role === 'student' || role === 'teacher'
        ? <StudentAnnouncements />
        : <AdminAnnouncements />}
    </RoleGuard>
  );
}

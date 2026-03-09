'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import AdminSettings from '@/components/pages/admin/settings';
import CCSettings from '@/components/pages/cc/settings';
import TeacherSettings from '@/components/pages/teacher/settings';
import StudentSettings from '@/components/pages/student/settings';

function SettingsForRole({ role }: { role: string }) {
  switch (role) {
    case 'course-creator': return <CCSettings />;
    case 'teacher': return <TeacherSettings />;
    case 'student': return <StudentSettings />;
    default: return <AdminSettings />;
  }
}

export default function SettingsPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowed={['admin', 'course-creator', 'teacher', 'student']}>
      <SettingsForRole role={role} />
    </RoleGuard>
  );
}

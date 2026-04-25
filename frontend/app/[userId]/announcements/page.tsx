'use client';

import { useAuth } from '@/lib/auth-context';
import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import { resolveViewComponent } from '@/lib/utils/view-type-resolver';
import AdminAnnouncements from '@/components/pages/admin/announcements';
import StudentAnnouncements from '@/components/pages/student/announcements';

export default function AnnouncementsPage() {
  const { viewType } = useAuth();
  const Component = resolveViewComponent(viewType, {
    student_view: StudentAnnouncements,
    staff_view: StudentAnnouncements,
    admin_view: AdminAnnouncements,
  });
  return (
    <RoleGuard required={P.ANNOUNCEMENTS_VIEW}>
      <Component />
    </RoleGuard>
  );
}

'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import CCSchedule from '@/components/pages/cc/schedule';

export default function SchedulePage() {
  return (
    <RoleGuard required={P.ZOOM_CREATE_CLASSES}>
      <CCSchedule />
    </RoleGuard>
  );
}

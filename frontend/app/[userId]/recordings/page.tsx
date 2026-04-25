'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import RecordingsPage from '@/components/pages/recordings';

export default function RecordingsRoute() {
  return (
    <RoleGuard required={P.ZOOM_VIEW_RECORDINGS}>
      <RecordingsPage />
    </RoleGuard>
  );
}

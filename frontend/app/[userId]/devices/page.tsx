'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminDevices from '@/components/pages/admin/devices';

export default function DevicesPage() {
  return (
    <RoleGuard required={P.DEVICES_VIEW}>
      <AdminDevices />
    </RoleGuard>
  );
}

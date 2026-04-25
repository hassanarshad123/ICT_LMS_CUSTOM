'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import BrandingPage from '@/components/pages/admin/branding';

export default function BrandingRoute() {
  return (
    <RoleGuard required={P.BRANDING_EDIT}>
      <BrandingPage />
    </RoleGuard>
  );
}

'use client';

import RoleGuard from '@/components/shared/role-guard';
import BrandingPage from '@/components/pages/admin/branding';

export default function BrandingRoute() {
  return (
    <RoleGuard allowed={['admin']}>
      <BrandingPage />
    </RoleGuard>
  );
}

'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import ApiDocsPage from '@/components/pages/admin/api-docs';

export default function Page() {
  return (
    <RoleGuard required={P.INTEGRATIONS_VIEW}>
      <ApiDocsPage />
    </RoleGuard>
  );
}

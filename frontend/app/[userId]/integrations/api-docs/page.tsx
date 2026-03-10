'use client';

import RoleGuard from '@/components/shared/role-guard';
import ApiDocsPage from '@/components/pages/admin/api-docs';

export default function Page() {
  return (
    <RoleGuard allowed={['admin']}>
      <ApiDocsPage />
    </RoleGuard>
  );
}

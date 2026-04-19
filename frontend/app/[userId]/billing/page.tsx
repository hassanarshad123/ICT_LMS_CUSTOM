'use client';

import RoleGuard from '@/components/shared/role-guard';
import AdminBilling from '@/components/pages/admin/billing';

export default function BillingPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <AdminBilling />
    </RoleGuard>
  );
}

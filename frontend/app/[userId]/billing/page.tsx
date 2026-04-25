'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import AdminBilling from '@/components/pages/admin/billing';

export default function BillingPage() {
  return (
    <RoleGuard required={P.BILLING_VIEW}>
      <AdminBilling />
    </RoleGuard>
  );
}

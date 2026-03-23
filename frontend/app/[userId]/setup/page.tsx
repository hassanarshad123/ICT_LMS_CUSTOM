'use client';

import RoleGuard from '@/components/shared/role-guard';
import OnboardingWizard from '@/components/pages/admin/onboarding/onboarding-wizard';

export default function SetupPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <OnboardingWizard />
    </RoleGuard>
  );
}

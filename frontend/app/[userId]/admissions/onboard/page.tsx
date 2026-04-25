'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import OnboardWizard from '@/components/admissions/onboard-wizard';

export default function AdmissionsOnboardPage() {
  return (
    <RoleGuard required={P.ADMISSIONS_ONBOARD}>
      <DashboardLayout>
        <DashboardHeader
          greeting="Onboard a student"
          subtitle="Create account, enroll in a batch, and set up the fee plan"
        />
        <OnboardWizard />
      </DashboardLayout>
    </RoleGuard>
  );
}

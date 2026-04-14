'use client';

import RoleGuard from '@/components/shared/role-guard';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import OnboardWizard from '@/components/admissions/onboard-wizard';

export default function AdmissionsOnboardPage() {
  return (
    <RoleGuard allowed={['admin', 'admissions-officer']}>
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

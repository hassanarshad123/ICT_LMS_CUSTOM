'use client';

import RoleGuard from '@/components/shared/role-guard';
import { P } from '@/lib/permissions';
import { useAuth } from '@/lib/auth-context';
import { resolveViewComponent } from '@/lib/utils/view-type-resolver';
import StudentCertificates from '@/components/pages/student/certificates';
import CCCertificates from '@/components/pages/cc/certificates';

export default function CertificatesRoute() {
  const { viewType } = useAuth();
  const Component = resolveViewComponent(viewType, {
    student_view: StudentCertificates,
    staff_view: CCCertificates,
    admin_view: CCCertificates,
  });

  return (
    <RoleGuard required={P.CERTIFICATES_VIEW}>
      <Component />
    </RoleGuard>
  );
}

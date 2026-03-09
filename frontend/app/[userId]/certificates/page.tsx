'use client';

import RoleGuard from '@/components/shared/role-guard';
import { useAuth } from '@/lib/auth-context';
import StudentCertificates from '@/components/pages/student/certificates';
import CCCertificates from '@/components/pages/cc/certificates';

export default function CertificatesRoute() {
  const { role } = useAuth();

  return (
    <RoleGuard allowed={['admin', 'course-creator', 'student']}>
      {role === 'student' ? <StudentCertificates /> : <CCCertificates />}
    </RoleGuard>
  );
}

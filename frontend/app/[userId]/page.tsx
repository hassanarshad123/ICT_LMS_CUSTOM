'use client';

import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';
import AdminDashboard from '@/components/dashboards/admin-dashboard';
import CourseCreatorDashboard from '@/components/dashboards/cc-dashboard';
import TeacherDashboard from '@/components/dashboards/teacher-dashboard';
import StudentDashboard from '@/components/dashboards/student-dashboard';
import AdmissionsOfficerDashboard from '@/components/dashboards/admissions-officer-dashboard';

export default function DashboardPage() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  switch (role) {
    case 'admin':
      return <AdminDashboard />;
    case 'course-creator':
      return <CourseCreatorDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'student':
      return <StudentDashboard />;
    case 'admissions-officer':
      return <AdmissionsOfficerDashboard />;
    default:
      return <StudentDashboard />;
  }
}

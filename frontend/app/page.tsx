'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/lib/auth-context';
import AdminDashboard from '@/components/dashboards/admin-dashboard';
import CourseCreatorDashboard from '@/components/dashboards/cc-dashboard';
import TeacherDashboard from '@/components/dashboards/teacher-dashboard';
import StudentDashboard from '@/components/dashboards/student-dashboard';

type UserRole = 'admin' | 'course_creator' | 'teacher' | 'student';

function DashboardRouter() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (!stored || !token) {
      router.replace('/login');
      return;
    }
    try {
      const user = JSON.parse(stored);
      setRole(user.role as UserRole);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  if (!role) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  switch (role) {
    case 'admin':
      return <AdminDashboard />;
    case 'course_creator':
      return <CourseCreatorDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'student':
      return <StudentDashboard />;
    default:
      return <StudentDashboard />;
  }
}

export default function HomePage() {
  return (
    <AuthProvider>
      <DashboardRouter />
    </AuthProvider>
  );
}

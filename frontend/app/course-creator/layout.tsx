'use client';
import { AuthProvider } from '@/lib/auth-context';
export default function CourseCreatorLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider role="course-creator">{children}</AuthProvider>;
}

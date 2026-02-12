'use client';
import { AuthProvider } from '@/lib/auth-context';
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider role="teacher">{children}</AuthProvider>;
}

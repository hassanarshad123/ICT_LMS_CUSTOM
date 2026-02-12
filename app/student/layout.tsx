'use client';
import { AuthProvider } from '@/lib/auth-context';
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider role="student">{children}</AuthProvider>;
}

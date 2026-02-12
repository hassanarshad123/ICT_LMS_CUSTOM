'use client';
import { AuthProvider } from '@/lib/auth-context';
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider role="admin">{children}</AuthProvider>;
}

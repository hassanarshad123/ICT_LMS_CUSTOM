'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/');
      return;
    }
    try {
      const user = JSON.parse(stored);
      if (user.role !== 'teacher') {
        router.push('/');
        return;
      }
      setAuthorized(true);
    } catch {
      router.push('/');
    }
  }, [router]);

  if (!authorized) return null;

  return <AuthProvider>{children}</AuthProvider>;
}

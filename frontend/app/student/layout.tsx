'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/lib/auth-context';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
      return;
    }
    try {
      const user = JSON.parse(stored);
      if (user.role !== 'student') {
        router.push('/login');
        return;
      }
      setAuthorized(true);
    } catch {
      router.push('/login');
    }
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <AuthProvider>{children}</AuthProvider>;
}

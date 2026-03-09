'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/lib/auth-context';
import { ErrorBoundary } from '@/components/shared/error-boundary';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (!stored || !token) {
      router.push('/login');
      return;
    }
    try {
      const user = JSON.parse(stored);
      if (user.id !== userId) {
        router.push('/login');
        return;
      }
      setAuthorized(true);
    } catch {
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AuthProvider>
  );
}

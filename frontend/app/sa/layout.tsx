'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SASidebar } from '@/components/layout/sa-sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';
import { SAErrorBoundary } from '@/components/layout/sa-error-boundary';
import { SAHeader } from '@/components/sa/sa-header';
import { refreshAccessToken } from '@/lib/api/client';

export default function SALayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Two-layer guard (Phase 4):
    //   1. Fast path — reject immediately if localStorage role is
    //      not super_admin or the token is missing.
    //   2. Server-verify — hit /auth/me with the current token and
    //      confirm the backend still agrees. Prevents stale
    //      localStorage from granting SA access after role changes,
    //      token version bumps, or account deactivation.
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (!stored || !token) {
      router.push('/login');
      return;
    }
    try {
      const user = JSON.parse(stored);
      if (user.role !== 'super_admin') {
        router.push('/login');
        return;
      }
    } catch {
      router.push('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let currentToken = token;
        let resp = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${currentToken}` },
        });

        if (resp.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            currentToken = newToken;
            resp = await fetch('/api/v1/auth/me', {
              headers: { Authorization: `Bearer ${currentToken}` },
            });
          }
        }

        if (cancelled) return;

        if (!resp.ok) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }
        const me = await resp.json();
        if (me?.role !== 'super_admin') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }
        setAuthorized(true);
      } catch {
        if (!cancelled) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          router.push('/login');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-zinc-50 overflow-hidden">
        <SASidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <SAHeader />
          <div className="flex-1 overflow-y-auto">
            <SAErrorBoundary>{children}</SAErrorBoundary>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

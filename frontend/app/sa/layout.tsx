'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SASidebar } from '@/components/layout/sa-sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';

export default function SALayout({ children }: { children: React.ReactNode }) {
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
      if (user.role !== 'super_admin') {
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

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-zinc-50 overflow-hidden">
        <SASidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

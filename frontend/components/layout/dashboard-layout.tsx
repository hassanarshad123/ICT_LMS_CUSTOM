'use client';

import { useAuth } from '@/lib/auth-context';
import Sidebar, { MobileTrigger } from './sidebar';
import { SidebarProvider } from './sidebar-context';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { role, name, logout } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background">
        <Sidebar role={role} userName={name || 'User'} onLogout={logout} />
        <main id="main-content" className="ml-0 md:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="md:hidden mb-4">
            <MobileTrigger />
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

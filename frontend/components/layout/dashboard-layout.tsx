'use client';

import { UserRole } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import Sidebar, { SidebarProvider, MobileTrigger } from './sidebar';

interface DashboardLayoutProps {
  role: UserRole;
  userName: string;
  children: React.ReactNode;
}

export default function DashboardLayout({ role, userName, children }: DashboardLayoutProps) {
  const { logout } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#F0F0F0]">
        <Sidebar role={role} userName={userName} onLogout={logout} />
        <main className="ml-0 md:ml-64 p-4 sm:p-6 md:p-8">
          <div className="md:hidden mb-4">
            <MobileTrigger />
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

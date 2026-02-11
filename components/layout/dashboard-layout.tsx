'use client';

import { UserRole } from '@/lib/types';
import Sidebar from './sidebar';

interface DashboardLayoutProps {
  role: UserRole;
  userName: string;
  children: React.ReactNode;
}

export default function DashboardLayout({ role, userName, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F0F0F0]">
      <Sidebar role={role} userName={userName} />
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}

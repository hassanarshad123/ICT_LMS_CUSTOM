'use client';

import { Menu } from 'lucide-react';
import { useSidebar } from '@/components/layout/sidebar-context';
import { SANotificationBell } from './sa-notification-bell';

export function SAHeader() {
  const { setMobileOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-zinc-200">
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100"
      >
        <Menu size={20} className="text-zinc-600" />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <SANotificationBell />
      </div>
    </header>
  );
}

'use client';

import { Menu, Search } from 'lucide-react';
import { useSidebar } from '@/components/layout/sidebar-context';
import { SANotificationBell } from './sa-notification-bell';
import { SASearchCommand } from './sa-search-command';

export function SAHeader() {
  const { setMobileOpen } = useSidebar();

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-zinc-200">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100"
        >
          <Menu size={20} className="text-zinc-600" />
        </button>

        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="hidden sm:flex items-center gap-2 mx-auto px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm text-zinc-500 transition-colors"
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-white border border-zinc-200 rounded text-zinc-400">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-3">
          <SANotificationBell />
        </div>
      </header>
      <SASearchCommand />
    </>
  );
}

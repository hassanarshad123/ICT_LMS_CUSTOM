'use client';

import { useEffect } from 'react';
import SearchModal from '@/components/shared/search-modal';
import NotificationDropdown from '@/components/shared/notification-dropdown';
import { useAuth } from '@/lib/auth-context';
import { LogOut } from 'lucide-react';

interface DashboardHeaderProps {
  greeting: string;
  subtitle?: string;
}

export default function DashboardHeader({ greeting, subtitle }: DashboardHeaderProps) {
  const { logout } = useAuth();

  useEffect(() => {
    document.title = `${greeting} | ICT Institute LMS`;
  }, [greeting]);

  return (
    <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary tracking-tight truncate">{greeting}</h1>
        {subtitle && <p className="text-gray-500 mt-1 text-sm sm:text-base truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <SearchModal />
        <NotificationDropdown />
        <button
          onClick={logout}
          title="Logout"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}

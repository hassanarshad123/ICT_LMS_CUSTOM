'use client';

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

  return (
    <div className="flex items-start justify-between mb-6 sm:mb-8">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary tracking-tight">{greeting}</h1>
        {subtitle && <p className="text-gray-500 mt-1 text-sm sm:text-base">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <SearchModal />
        <NotificationDropdown />
        <button
          onClick={logout}
          title="Logout"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}

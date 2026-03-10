'use client';

import SearchModal from '@/components/shared/search-modal';
import NotificationDropdown from '@/components/shared/notification-dropdown';

interface DashboardHeaderProps {
  greeting: string;
  subtitle?: string;
}

export default function DashboardHeader({ greeting, subtitle }: DashboardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 sm:mb-8">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary tracking-tight">{greeting}</h1>
        {subtitle && <p className="text-gray-500 mt-1 text-sm sm:text-base">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <SearchModal />
        <NotificationDropdown />
      </div>
    </div>
  );
}

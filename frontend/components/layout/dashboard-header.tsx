'use client';

import { Search, Bell } from 'lucide-react';

interface DashboardHeaderProps {
  greeting: string;
  subtitle?: string;
}

export default function DashboardHeader({ greeting, subtitle }: DashboardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 sm:mb-8">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1A1A1A] tracking-tight">{greeting}</h1>
        {subtitle && <p className="text-gray-500 mt-1 text-sm sm:text-base">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
          <Search size={18} className="text-gray-500" />
        </button>
        <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors relative">
          <Bell size={18} className="text-gray-500" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#C5D86D] rounded-full" />
        </button>
      </div>
    </div>
  );
}

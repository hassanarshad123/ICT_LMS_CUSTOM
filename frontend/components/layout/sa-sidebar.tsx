'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, LogOut, X, Menu } from 'lucide-react';
import { useSidebar } from './sidebar-context';
import { logout as apiLogout } from '@/lib/api/auth';

const navItems = [
  { label: 'Dashboard', path: '/sa', icon: 'dashboard' },
  { label: 'Institutes', path: '/sa/institutes', icon: 'building' },
];

export function SASidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mobileOpen, setMobileOpen } = useSidebar();

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try { await apiLogout(refreshToken); } catch {}
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#1A1A1A] text-white w-64">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <div className="font-bold text-lg text-[#C5D86D]">Zensbot</div>
          <div className="text-xs text-white/50">Super Admin Panel</div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.path === '/sa'
            ? pathname === '/sa'
            : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#C5D86D] text-[#1A1A1A]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.icon === 'dashboard' && <LayoutDashboard size={18} />}
              {item.icon === 'building' && <Building2 size={18} />}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex-shrink-0">{sidebarContent}</div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-[#1A1A1A] text-white rounded-xl shadow-lg"
      >
        <Menu size={20} />
      </button>
    </>
  );
}

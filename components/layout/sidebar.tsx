'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole, NavItem } from '@/lib/types';
import {
  Home,
  Layers,
  Users,
  GraduationCap,
  Video,
  BookOpen,
  Calendar,
  Briefcase,
  PlayCircle,
  PenTool,
  UserCog,
  Smartphone,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navConfig: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin', icon: 'home' },
    { label: 'Users', href: '/admin/users', icon: 'user-cog' },
    { label: 'Batches', href: '/admin/batches', icon: 'layers' },
    { label: 'Students', href: '/admin/students', icon: 'users' },
    { label: 'Teachers', href: '/admin/teachers', icon: 'graduation-cap' },
    { label: 'Course Creators', href: '/admin/course-creators', icon: 'pen-tool' },
    { label: 'Devices', href: '/admin/devices', icon: 'smartphone' },
    { label: 'Insights', href: '/admin/insights', icon: 'bar-chart-3' },
    { label: 'Settings', href: '/admin/settings', icon: 'settings' },
  ],
  'course-creator': [
    { label: 'Dashboard', href: '/course-creator', icon: 'home' },
    { label: 'Users', href: '/course-creator/users', icon: 'user-cog' },
    { label: 'Courses', href: '/course-creator/courses', icon: 'book-open' },
    { label: 'Batches', href: '/course-creator/batches', icon: 'layers' },
    { label: 'Jobs', href: '/course-creator/jobs', icon: 'briefcase' },
    { label: 'Settings', href: '/course-creator/settings', icon: 'settings' },
  ],
  teacher: [
    { label: 'Dashboard', href: '/teacher', icon: 'home' },
    { label: 'My Courses', href: '/teacher/courses', icon: 'book-open' },
    { label: 'My Batches', href: '/teacher/batches', icon: 'layers' },
    { label: 'Schedule Class', href: '/teacher/schedule', icon: 'calendar' },
    { label: 'Settings', href: '/teacher/settings', icon: 'settings' },
  ],
  student: [
    { label: 'Dashboard', href: '/student', icon: 'home' },
    { label: 'Courses', href: '/student/courses', icon: 'book-open' },
    { label: 'Zoom Classes', href: '/student/zoom', icon: 'video' },
    { label: 'Job Opportunities', href: '/student/jobs', icon: 'briefcase' },
    { label: 'Settings', href: '/student/settings', icon: 'settings' },
  ],
};

const iconMap: Record<string, React.ReactNode> = {
  home: <Home size={20} />,
  layers: <Layers size={20} />,
  users: <Users size={20} />,
  'graduation-cap': <GraduationCap size={20} />,
  video: <Video size={20} />,
  'book-open': <BookOpen size={20} />,
  calendar: <Calendar size={20} />,
  briefcase: <Briefcase size={20} />,
  'play-circle': <PlayCircle size={20} />,
  'pen-tool': <PenTool size={20} />,
  'user-cog': <UserCog size={20} />,
  smartphone: <Smartphone size={20} />,
  'bar-chart-3': <BarChart3 size={20} />,
  settings: <Settings size={20} />,
};

// Context for mobile sidebar state
const SidebarContext = createContext<{ mobileOpen: boolean; setMobileOpen: (v: boolean) => void }>({
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function MobileTrigger() {
  const { setMobileOpen } = useSidebar();
  return (
    <button
      onClick={() => setMobileOpen(true)}
      className="md:hidden w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
      aria-label="Open menu"
    >
      <Menu size={20} className="text-gray-600" />
    </button>
  );
}

interface SidebarProps {
  role: UserRole;
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const items = navConfig[role];
  const { mobileOpen, setMobileOpen } = useSidebar();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    'course-creator': 'Course Creator',
    teacher: 'Teacher',
    student: 'Student',
  };

  return (
    <>
      {/* Dark backdrop for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 flex flex-col z-50 transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Close button for mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          aria-label="Close menu"
        >
          <X size={18} className="text-gray-500" />
        </button>

        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A1A] text-sm">ICT Institute</h2>
              <p className="text-xs text-gray-500">{roleLabels[role]}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {items.map((item) => {
            const isActive = item.href.endsWith(`/${role}`)
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#1A1A1A] text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-[#1A1A1A]'
                }`}
              >
                {iconMap[item.icon]}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#C5D86D] flex items-center justify-center text-sm font-semibold text-[#1A1A1A]">
              {userName.charAt(0)}
            </div>
            <span className="text-sm font-medium text-[#1A1A1A] truncate">{userName}</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut size={20} />
            Logout
          </Link>
        </div>
      </aside>
    </>
  );
}

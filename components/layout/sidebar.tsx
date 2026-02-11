'use client';

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
  LogOut,
} from 'lucide-react';

const navConfig: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin', icon: 'home' },
    { label: 'Batches', href: '/admin/batches', icon: 'layers' },
    { label: 'Students', href: '/admin/students', icon: 'users' },
    { label: 'Teachers', href: '/admin/teachers', icon: 'graduation-cap' },
  ],
  'course-creator': [
    { label: 'Dashboard', href: '/course-creator', icon: 'home' },
    { label: 'Lectures', href: '/course-creator/lectures', icon: 'video' },
    { label: 'Curriculum', href: '/course-creator/curriculum', icon: 'book-open' },
  ],
  teacher: [
    { label: 'Dashboard', href: '/teacher', icon: 'home' },
    { label: 'My Batches', href: '/teacher/batches', icon: 'layers' },
    { label: 'Schedule Class', href: '/teacher/schedule', icon: 'calendar' },
  ],
  student: [
    { label: 'Dashboard', href: '/student', icon: 'home' },
    { label: 'Zoom Classes', href: '/student/zoom', icon: 'video' },
    { label: 'Recorded Lectures', href: '/student/lectures', icon: 'play-circle' },
    { label: 'Job Opportunities', href: '/student/jobs', icon: 'briefcase' },
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
};

interface SidebarProps {
  role: UserRole;
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const items = navConfig[role];

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    'course-creator': 'Course Creator',
    teacher: 'Teacher',
    student: 'Student',
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col z-30">
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
          const isActive = pathname === item.href;
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
  );
}

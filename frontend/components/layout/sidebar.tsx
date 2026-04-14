'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useBranding } from '@/lib/branding-context';
import { useSidebar } from './sidebar-context';
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
  UserPlus,
  Smartphone,
  BarChart3,
  Award,
  Activity,
  Settings,
  Palette,
  MessageSquare,
  Megaphone,
  Plug,
  Upload,
  Wallet,
  LogOut,
  Menu,
  X,
  HelpCircle,
} from 'lucide-react';
import { ZensbotSidebarBadge } from '@/components/shared/zensbot-badge';
import UploadIndicator from '@/components/shared/upload-indicator';
import { useTour } from '@/components/shared/tour-provider';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  navId?: string;
}

const navConfig: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', path: '', icon: 'home', navId: 'nav-dashboard' },
    { label: 'Users', path: '/users', icon: 'user-cog', navId: 'nav-users' },
    { label: 'Courses', path: '/courses', icon: 'book-open', navId: 'nav-courses' },
    { label: 'Batches', path: '/batches', icon: 'layers', navId: 'nav-batches' },
    { label: 'Upload Videos', path: '/upload', icon: 'upload', navId: 'nav-upload' },
    { label: 'Schedule Class', path: '/schedule', icon: 'calendar', navId: 'nav-schedule' },
    { label: 'Students', path: '/students', icon: 'users', navId: 'nav-students' },
    { label: 'Teachers', path: '/teachers', icon: 'graduation-cap', navId: 'nav-teachers' },
    { label: 'Course Creators', path: '/course-creators', icon: 'pen-tool', navId: 'nav-course-creators' },
    { label: 'Admissions Officers', path: '/admissions-officers', icon: 'user-plus', navId: 'nav-admissions-officers' },
    { label: 'Admissions Team', path: '/admissions-team', icon: 'bar-chart-3', navId: 'nav-admissions-team' },
    { label: 'Devices', path: '/devices', icon: 'smartphone', navId: 'nav-devices' },
    { label: 'Insights', path: '/insights', icon: 'bar-chart-3', navId: 'nav-insights' },
    { label: 'Recordings', path: '/recordings', icon: 'play-circle', navId: 'nav-recordings' },
    { label: 'Certificates', path: '/certificates', icon: 'award', navId: 'nav-certificates' },
    { label: 'Announcements', path: '/announcements', icon: 'megaphone', navId: 'nav-announcements' },
    { label: 'Jobs', path: '/jobs', icon: 'briefcase', navId: 'nav-jobs' },
    { label: 'Monitoring', path: '/monitoring', icon: 'activity', navId: 'nav-monitoring' },
    { label: 'Branding', path: '/branding', icon: 'palette', navId: 'nav-branding' },
    { label: 'Integrations', path: '/integrations', icon: 'plug', navId: 'nav-integrations' },
    { label: 'Feedback', path: '/feedback', icon: 'message-square', navId: 'nav-feedback' },
    { label: 'Settings', path: '/settings', icon: 'settings', navId: 'nav-settings' },
  ],
  'course-creator': [
    { label: 'Dashboard', path: '', icon: 'home', navId: 'nav-dashboard' },
    { label: 'Users', path: '/users', icon: 'user-cog', navId: 'nav-users' },
    { label: 'Courses', path: '/courses', icon: 'book-open', navId: 'nav-courses' },
    { label: 'Batches', path: '/batches', icon: 'layers', navId: 'nav-batches' },
    { label: 'Upload Videos', path: '/upload', icon: 'upload', navId: 'nav-upload' },
    { label: 'Devices', path: '/devices', icon: 'smartphone', navId: 'nav-devices' },
    { label: 'Schedule Class', path: '/schedule', icon: 'calendar', navId: 'nav-schedule' },
    { label: 'Recordings', path: '/recordings', icon: 'play-circle', navId: 'nav-recordings' },
    { label: 'Certificates', path: '/certificates', icon: 'award', navId: 'nav-certificates' },
    { label: 'Announcements', path: '/announcements', icon: 'megaphone', navId: 'nav-announcements' },
    { label: 'Jobs', path: '/jobs', icon: 'briefcase', navId: 'nav-jobs' },
    { label: 'Feedback', path: '/feedback', icon: 'message-square', navId: 'nav-feedback' },
    { label: 'Settings', path: '/settings', icon: 'settings', navId: 'nav-settings' },
  ],
  teacher: [
    { label: 'Dashboard', path: '', icon: 'home', navId: 'nav-dashboard' },
    { label: 'My Courses', path: '/courses', icon: 'book-open', navId: 'nav-courses' },
    { label: 'My Batches', path: '/batches', icon: 'layers', navId: 'nav-batches' },
    { label: 'Zoom Classes', path: '/classes', icon: 'video', navId: 'nav-classes' },
    { label: 'Recordings', path: '/recordings', icon: 'play-circle', navId: 'nav-recordings' },
    { label: 'Announcements', path: '/announcements', icon: 'megaphone', navId: 'nav-announcements' },
    { label: 'Feedback', path: '/feedback', icon: 'message-square', navId: 'nav-feedback' },
    { label: 'Settings', path: '/settings', icon: 'settings', navId: 'nav-settings' },
  ],
  student: [
    { label: 'Dashboard', path: '', icon: 'home', navId: 'nav-dashboard' },
    { label: 'Courses', path: '/courses', icon: 'book-open', navId: 'nav-courses' },
    { label: 'Zoom Classes', path: '/classes', icon: 'video', navId: 'nav-classes' },
    { label: 'Recordings', path: '/recordings', icon: 'play-circle', navId: 'nav-recordings' },
    { label: 'Announcements', path: '/announcements', icon: 'megaphone', navId: 'nav-announcements' },
    { label: 'Certificates', path: '/certificates', icon: 'award', navId: 'nav-certificates' },
    { label: 'My Fees', path: '/fees', icon: 'wallet', navId: 'nav-fees' },
    { label: 'Job Opportunities', path: '/jobs', icon: 'briefcase', navId: 'nav-jobs' },
    { label: 'Feedback', path: '/feedback', icon: 'message-square', navId: 'nav-feedback' },
    { label: 'Settings', path: '/settings', icon: 'settings', navId: 'nav-settings' },
  ],
  'admissions-officer': [
    { label: 'Dashboard', path: '', icon: 'home', navId: 'nav-dashboard' },
    { label: 'Onboard Student', path: '/admissions/onboard', icon: 'user-plus', navId: 'nav-onboard' },
    { label: 'Settings', path: '/settings', icon: 'settings', navId: 'nav-settings' },
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
  'user-plus': <UserPlus size={20} />,
  smartphone: <Smartphone size={20} />,
  'bar-chart-3': <BarChart3 size={20} />,
  award: <Award size={20} />,
  activity: <Activity size={20} />,
  palette: <Palette size={20} />,
  plug: <Plug size={20} />,
  upload: <Upload size={20} />,
  megaphone: <Megaphone size={20} />,
  'message-square': <MessageSquare size={20} />,
  settings: <Settings size={20} />,
  wallet: <Wallet size={20} />,
};

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
  onLogout?: () => void;
}

export default function Sidebar({ role, userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { id } = useAuth();
  const { instituteName, logoUrl } = useBranding();
  const items = navConfig[role] || navConfig.student;
  const basePath = `/${id}`;
  const { mobileOpen, setMobileOpen } = useSidebar();
  const { startTour } = useTour();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    'course-creator': 'Course Creator',
    teacher: 'Teacher',
    student: 'Student',
    'admissions-officer': 'Admissions Officer',
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
            {logoUrl ? (
              <img src={logoUrl} alt={instituteName} className="w-10 h-10 object-contain rounded-[20%]" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <GraduationCap size={20} className="text-white" />
              </div>
            )}
            <div>
              <h2 className="font-semibold text-primary text-sm">{instituteName}</h2>
              <p className="text-xs text-gray-500">{roleLabels[role]}</p>
            </div>
          </div>
        </div>

        <nav id="sidebar-nav" className="flex-1 overflow-y-auto min-h-0 p-4 space-y-1">
          {items.map((item) => {
            const href = item.path === '' ? basePath : `${basePath}${item.path}`;
            const isActive = item.path === ''
              ? pathname === basePath
              : pathname.startsWith(`${basePath}${item.path}`);
            return (
              <Link
                key={item.path}
                id={item.navId}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-primary'
                }`}
              >
                {iconMap[item.icon]}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          {role === 'course-creator' && <UploadIndicator />}
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-primary">
              {userName.charAt(0)}
            </div>
            <span className="text-sm font-medium text-primary truncate">{userName}</span>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut size={20} />
            Logout
          </button>
          <button
            id="tour-help-btn"
            onClick={startTour}
            className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors w-full"
            title="Show guided tour"
          >
            <HelpCircle size={16} />
            <span>Help & Tour</span>
          </button>
          <div className="mt-2 border-t border-gray-100 pt-2">
            <ZensbotSidebarBadge />
          </div>
        </div>
      </aside>
    </>
  );
}

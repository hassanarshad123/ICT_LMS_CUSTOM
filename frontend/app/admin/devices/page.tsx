'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { getUserDeviceSummaries } from '@/lib/mock-data';
import { UserDeviceSummary } from '@/lib/types';
import { Search, Trash2, ChevronDown, ChevronRight, Monitor } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { roleBadgeColors, roleLabels } from '@/lib/constants';

const roleOptions = [
  { value: 'all', label: 'All' },
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'course-creator', label: 'Course Creator' },
];

export default function AdminDevicesPage() {
  const [summaries, setSummaries] = useState<UserDeviceSummary[]>(getUserDeviceSummaries());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; sessionId: string | null } | null>(null);

  const deviceLimit = 2;

  const filtered = summaries.filter((s) => {
    const matchesSearch =
      s.userName.toLowerCase().includes(search.toLowerCase()) ||
      s.userEmail.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.userRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleRemoveSession = (userId: string, sessionId: string) => {
    setSummaries((prev) =>
      prev.map((s) =>
        s.userId === userId
          ? { ...s, activeSessions: s.activeSessions.filter((d) => d.id !== sessionId) }
          : s
      )
    );
    setDeleteTarget(null);
  };

  const handleRemoveAll = (userId: string) => {
    setSummaries((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, activeSessions: [] } : s))
    );
    setExpandedUserId(null);
    setDeleteTarget(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.sessionId) {
      handleRemoveSession(deleteTarget.userId, deleteTarget.sessionId);
    } else {
      handleRemoveAll(deleteTarget.userId);
    }
  };

  const toggleExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  };

  const deleteDialogTitle = deleteTarget?.sessionId ? 'Remove Device' : 'Remove All Devices';
  const deleteDialogDesc = deleteTarget?.sessionId
    ? 'Are you sure you want to remove this device session? The user will be logged out from this device.'
    : 'Are you sure you want to remove all device sessions for this user? They will be logged out from every device.';

  return (
    <DashboardLayout role="admin" userName="Admin User">
      <DashboardHeader greeting="Devices" subtitle="Manage user device sessions" />

      {/* Search & Role Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-white w-full sm:w-72"
          />
        </div>

        <div className="flex gap-1 bg-white rounded-xl p-1 card-shadow w-fit">
          {roleOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRoleFilter(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                roleFilter === opt.value ? 'bg-[#1A1A1A] text-white' : 'text-gray-500 hover:text-[#1A1A1A]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Active Devices</th>
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const count = user.activeSessions.length;
                const isExpanded = expandedUserId === user.userId;
                const atLimit = count >= deviceLimit;

                return (
                  <tr key={user.userId} className="border-b border-gray-50">
                    <td colSpan={5} className="p-0">
                      {/* Main row */}
                      <div
                        onClick={() => count > 0 && toggleExpand(user.userId)}
                        className={`flex items-center hover:bg-gray-50 transition-colors ${count > 0 ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-center gap-3 px-3 sm:px-6 py-3 sm:py-4 w-[25%] min-w-[150px]">
                          {count > 0 ? (
                            isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <div className="w-8 h-8 rounded-full bg-[#C5D86D] flex items-center justify-center text-xs font-semibold text-[#1A1A1A]">
                            {user.userName.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-[#1A1A1A] truncate">{user.userName}</span>
                        </div>
                        <div className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 w-[25%] min-w-[150px] truncate">
                          {user.userEmail}
                        </div>
                        <div className="px-3 sm:px-6 py-3 sm:py-4 w-[18%] min-w-[120px]">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeColors[user.userRole]}`}>
                            {roleLabels[user.userRole]}
                          </span>
                        </div>
                        <div className="px-3 sm:px-6 py-3 sm:py-4 w-[16%] min-w-[100px]">
                          <span className={`text-sm font-semibold ${atLimit ? 'text-red-600' : count === 0 ? 'text-gray-400' : 'text-[#1A1A1A]'}`}>
                            {count}/{deviceLimit}
                          </span>
                        </div>
                        <div className="px-3 sm:px-6 py-3 sm:py-4 w-[16%] min-w-[120px]">
                          {count > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ userId: user.userId, sessionId: null });
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              Remove All
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded device sessions */}
                      {isExpanded && (
                        <div className="bg-gray-50 border-t border-gray-100">
                          {user.activeSessions.map((session) => (
                            <div
                              key={session.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-12 py-3 border-b border-gray-100 last:border-b-0 gap-2"
                            >
                              <div className="flex items-center gap-3">
                                <Monitor size={16} className="text-gray-400 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-[#1A1A1A]">{session.deviceInfo}</p>
                                  <p className="text-xs text-gray-500">
                                    IP: {session.ipAddress} &middot; Logged in: {formatDateTime(session.loggedInAt)} &middot; Last active: {formatDateTime(session.lastActiveAt)}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => setDeleteTarget({ userId: user.userId, sessionId: session.id })}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors self-end sm:self-auto"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialogDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { listAnnouncements } from '@/lib/api/announcements';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import {
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Globe,
  Layers,
  BookOpen,
  Calendar,
  User,
} from 'lucide-react';

const SCOPE_OPTIONS = [
  { value: 'institute', label: 'Institute-wide', color: 'bg-blue-100 text-blue-700' },
  { value: 'batch', label: 'Batch', color: 'bg-purple-100 text-purple-700' },
  { value: 'course', label: 'Course', color: 'bg-green-100 text-green-700' },
];

export default function StudentAnnouncements() {
  const { name } = useAuth();
  const [scopeFilter, setScopeFilter] = useState<string>('all');

  const { data: announcements, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listAnnouncements({
      ...params,
      scope: scopeFilter !== 'all' ? scopeFilter : undefined,
    }),
    15,
    [scopeFilter],
  );

  if (loading && !announcements) {
    return <DashboardLayout><PageLoading /></DashboardLayout>;
  }

  if (error) {
    return <DashboardLayout><PageError message={error} onRetry={refetch} /></DashboardLayout>;
  }

  const items = announcements || [];

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Announcements" subtitle="Stay updated with the latest news" />

      {/* Scope filter */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit max-w-full overflow-x-auto">
        {[{ value: 'all', label: 'All' }, ...SCOPE_OPTIONS].map((s) => (
          <button
            key={s.value}
            onClick={() => { setScopeFilter(s.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              scopeFilter === s.value
                ? 'bg-primary text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={28} className="text-gray-400" />}
          title="No announcements"
          description="There are no announcements to show right now."
        />
      ) : (
        <div className="space-y-4">
          {items.map((ann: any) => {
            const scopeInfo = SCOPE_OPTIONS.find((s) => s.value === ann.scope);
            return (
              <div key={ann.id} className="bg-white rounded-2xl p-5 card-shadow">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h3 className="text-sm font-semibold text-primary">{ann.title}</h3>
                  {scopeInfo && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scopeInfo.color}`}>
                      {scopeInfo.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{ann.content}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  {ann.postedByName && (
                    <div className="flex items-center gap-1">
                      <User size={12} />
                      {ann.postedByName}
                    </div>
                  )}
                  {ann.createdAt && (
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(ann.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 gap-2">
              <p className="text-xs sm:text-sm text-gray-500">
                {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-medium text-gray-600">
                  {page}/{totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

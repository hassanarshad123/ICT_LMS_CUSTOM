'use client';

import { useState } from 'react';
import { MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import FeedbackDetailCard from './feedback-detail-card';
import { listFeedback } from '@/lib/api/feedback';
import { usePaginatedApi } from '@/hooks/use-paginated-api';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'declined', label: 'Declined' },
];

export default function MyFeedback() {
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listFeedback({
      ...params,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    15,
    [statusFilter],
  );

  if (loading && !data.length) {
    return <DashboardLayout><PageLoading /></DashboardLayout>;
  }

  if (error) {
    return <DashboardLayout><PageError message={error} onRetry={refetch} /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <DashboardHeader greeting="My Feedback" subtitle="Track your submitted feedback and responses" />

      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
        {/* Status filter tabs */}
        <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-0.5 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                statusFilter === tab.key
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feedback list */}
        {data.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={48} className="text-gray-300" />}
            title="No feedback yet"
            description={statusFilter === 'all'
              ? "You haven't submitted any feedback yet. Use the feedback button to share your thoughts!"
              : `No feedback with status "${statusFilter.replace(/_/g, ' ')}"`
            }
          />
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <FeedbackDetailCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

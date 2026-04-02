'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { MessageSquarePlus, Search, ChevronLeft, ChevronRight, MessageCircle, AlertTriangle, Star, Clock } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import StarRating from '@/components/shared/star-rating';
import FeedbackDetailPanel from './feedback-detail-panel';
import { SAKpiCard } from '@/components/sa/charts/sa-kpi-card';
import { SAAreaChart } from '@/components/sa/charts/sa-area-chart';
import { SADonutChart } from '@/components/sa/charts/sa-donut-chart';
import { SABarChart } from '@/components/sa/charts/sa-bar-chart';
import { SAPeriodSelector } from '@/components/sa/charts/sa-period-selector';
import {
  getFeedbackAnalytics,
  listFeedback,
  getFeedbackDetail,
  type FeedbackStats,
  type FeedbackListItem,
  type FeedbackItem,
  type PaginatedFeedback,
} from '@/lib/api/feedback';

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  planned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  declined: 'bg-gray-100 text-gray-600',
};

const TYPE_LABELS: Record<string, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  general_feedback: 'General',
  ux_issue: 'UX Issue',
};

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SAFeedbackDashboard() {
  const [period, setPeriod] = useState(30);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchInput]);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: stats, loading: statsLoading } = useApi<FeedbackStats>(
    () => getFeedbackAnalytics(period),
    [period],
  );

  const fetchList = useCallback(
    () => listFeedback({
      page,
      per_page: 15,
      search: search || undefined,
      feedback_type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
    [page, search, typeFilter, statusFilter],
  );

  const { data: listData, loading: listLoading, refetch } = useApi<PaginatedFeedback>(fetchList, [page, search, typeFilter, statusFilter]);

  const handleRowClick = async (item: FeedbackListItem) => {
    try {
      const detail = await getFeedbackDetail(item.id);
      setSelectedFeedback(detail);
      setDetailOpen(true);
    } catch {
      // ignore
    }
  };

  const handleDetailUpdated = () => {
    refetch();
    // Reload the detail
    if (selectedFeedback) {
      getFeedbackDetail(selectedFeedback.id).then(setSelectedFeedback).catch(() => {});
    }
  };

  // Transform stats for charts
  const donutData = stats ? Object.entries(stats.byType).map(([name, value]) => ({
    name: TYPE_LABELS[name] || name,
    value,
  })) : [];

  const barData = stats?.byInstitute?.map((i) => ({
    name: i.name.length > 15 ? i.name.slice(0, 15) + '...' : i.name,
    value: i.count,
  })) || [];

  const trendData = stats?.satisfactionTrend?.map((t) => ({
    date: t.date ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    value: t.avgRating || 0,
  })) || [];

  const items = listData?.data || [];
  const total = listData?.total || 0;
  const totalPages = listData?.totalPages || 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Feedback Management</h1>
          <p className="text-sm text-zinc-500">User feedback and error reports across all institutes</p>
        </div>
        <SAPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SAKpiCard label="Total Feedback" value={stats?.totalCount ?? 0} icon={MessageCircle} color="bg-blue-500" />
        <SAKpiCard label="Unresolved" value={stats?.unresolvedCount ?? 0} icon={AlertTriangle} color="bg-amber-500" />
        <SAKpiCard label="Avg Rating" value={stats?.avgRating ? `${stats.avgRating}/5` : 'N/A'} icon={Star} color="bg-green-500" />
        <SAKpiCard label="Avg Response Time" value={stats?.avgResponseTimeHours ? `${stats.avgResponseTimeHours}h` : 'N/A'} icon={Clock} color="bg-purple-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Satisfaction Trend</h3>
          {trendData.length > 0 ? (
            <SAAreaChart data={trendData} dataKey="value" height={200} />
          ) : (
            <p className="text-xs text-zinc-400 py-8 text-center">No data for this period</p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">By Type</h3>
          {donutData.length > 0 ? (
            <SADonutChart data={donutData} height={200} />
          ) : (
            <p className="text-xs text-zinc-400 py-8 text-center">No data</p>
          )}
        </div>
      </div>

      {/* By Institute */}
      {barData.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Top Institutes by Feedback</h3>
          <SABarChart data={barData} height={200} />
        </div>
      )}

      {/* Top Feature Requests */}
      {stats?.topFeatureRequests && stats.topFeatureRequests.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Top Feature Requests</h3>
          <div className="space-y-2">
            {stats.topFeatureRequests.map((req, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 truncate flex-1">{req.subject}</span>
                <span className="text-xs text-zinc-500 ml-3 flex-shrink-0">{req.count} request{req.count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search feedback..."
            className="text-xs border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 w-56 focus:border-primary focus:ring-0 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Types</option>
          <option value="bug_report">Bug Report</option>
          <option value="feature_request">Feature Request</option>
          <option value="general_feedback">General Feedback</option>
          <option value="ux_issue">UX Issue</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Title</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Type</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Rating</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Institute</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">Date</th>
            </tr>
          </thead>
          <tbody>
            {listLoading && items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-zinc-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-zinc-400">No feedback found</td></tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3">
                    <span className="font-medium text-zinc-900 truncate block max-w-[250px]">{item.subject}</span>
                    {item.userName && !item.isAnonymous && (
                      <span className="text-[10px] text-zinc-400">{item.userName}</span>
                    )}
                    {item.isAnonymous && (
                      <span className="text-[10px] text-zinc-400 italic">Anonymous</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-600">{TYPE_LABELS[item.feedbackType] || item.feedbackType}</td>
                  <td className="px-5 py-3">{item.rating ? <StarRating value={item.rating} readonly size={12} /> : <span className="text-xs text-zinc-300">—</span>}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>
                      {formatStatus(item.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{item.instituteName || '—'}</td>
                  <td className="px-5 py-3 text-xs text-zinc-400">{formatDate(item.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-zinc-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      <FeedbackDetailPanel
        feedback={selectedFeedback}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={handleDetailUpdated}
      />
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useApi, useMutation } from '@/hooks/use-api';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import DashboardLayout from '@/components/layout/dashboard-layout';
import {
  getErrors,
  getErrorStats,
  resolveError,
  resolveAllErrors,
  clearResolvedErrors,
  testDiscordAlert,
  ErrorLogItem,
  ErrorStats,
} from '@/lib/api/monitoring';
import {
  CheckCircle2,
  XCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Clock,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { MonitoringStats } from './monitoring-stats';
import { MonitoringFilters } from './monitoring-filters';
import { MonitoringErrorDetail } from './monitoring-error-detail';

export default function AdminMonitoring() {
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<string>('');
  const [level, setLevel] = useState<string>('');
  const [resolvedFilter, setResolvedFilter] = useState<string>('false');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedError, setSelectedError] = useState<ErrorLogItem | null>(null);

  const params = {
    page,
    per_page: 20,
    ...(source && { source }),
    ...(level && { level }),
    ...(resolvedFilter !== '' && { resolved: resolvedFilter === 'true' }),
    ...(search && { search }),
  };

  const { data: errorsData, loading, error, refetch } = useApi(
    () => getErrors(params as any),
    [page, source, level, resolvedFilter, search],
  );

  const { data: stats, refetch: refetchStats } = useApi<ErrorStats>(
    () => getErrorStats(),
    [],
  );

  const { execute: doResolve, loading: resolving } = useMutation(resolveError);
  const { execute: doResolveAll, loading: resolvingAll } = useMutation(resolveAllErrors);
  const { execute: doClear, loading: clearing } = useMutation(clearResolvedErrors);
  const { execute: doTestAlert, loading: testing } = useMutation(testDiscordAlert);

  const handleResolve = useCallback(async (id: string, resolved: boolean) => {
    try {
      await doResolve(id, resolved);
      toast.success(resolved ? 'Error marked as resolved' : 'Error reopened');
      refetch();
      refetchStats();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [doResolve, refetch, refetchStats]);

  const handleResolveAll = useCallback(async () => {
    try {
      const result = await doResolveAll();
      toast.success(`Resolved ${result.resolvedCount} errors`);
      refetch();
      refetchStats();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [doResolveAll, refetch, refetchStats]);

  const handleClearResolved = useCallback(async () => {
    try {
      const result = await doClear(7);
      toast.success(`Deleted ${result.deletedCount} old resolved errors`);
      refetch();
      refetchStats();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [doClear, refetch, refetchStats]);

  const handleTestAlert = useCallback(async () => {
    try {
      await doTestAlert();
      toast.success('Test alert sent to Discord');
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [doTestAlert]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const levelColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    error: 'bg-orange-100 text-orange-700',
    warning: 'bg-yellow-100 text-yellow-700',
  };

  const sourceIcons: Record<string, React.ReactNode> = {
    backend: <Monitor size={14} />,
    frontend: <Smartphone size={14} />,
  };

  function formatTime(dateStr?: string) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  if (loading && !errorsData) return <DashboardLayout><PageLoading /></DashboardLayout>;
  if (error) return <DashboardLayout><PageError message={error} onRetry={refetch} /></DashboardLayout>;

  const errors: ErrorLogItem[] = errorsData?.data || [];
  const total = errorsData?.total || 0;
  const totalPages = errorsData?.totalPages || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">System Monitoring</h1>
            <p className="text-sm text-gray-500 mt-1">Track errors and system health</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestAlert}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Bell size={16} />
              Test Alert
            </button>
            <button
              onClick={() => { refetch(); refetchStats(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards + Top Error Paths */}
        {stats && <MonitoringStats stats={stats} />}

        {/* Filters + Actions */}
        <MonitoringFilters
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearchSubmit={handleSearch}
          source={source}
          onSourceChange={(val) => { setSource(val); setPage(1); }}
          level={level}
          onLevelChange={(val) => { setLevel(val); setPage(1); }}
          resolvedFilter={resolvedFilter}
          onResolvedFilterChange={(val) => { setResolvedFilter(val); setPage(1); }}
          onResolveAll={handleResolveAll}
          resolvingAll={resolvingAll}
          onClearResolved={handleClearResolved}
          clearing={clearing}
        />

        {/* Error List */}
        {errors.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={28} className="text-green-500" />}
            title="No errors found"
            description="Your system is running smoothly."
          />
        ) : (
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="divide-y divide-gray-100">
              {errors.map((err) => (
                <div
                  key={err.id}
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    err.resolved ? 'opacity-60' : ''
                  }`}
                  onClick={() => setSelectedError(err)}
                >
                  <div className="flex items-start gap-3">
                    {/* Level badge */}
                    <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${levelColors[err.level] || 'bg-gray-100 text-gray-700'}`}>
                      {err.level}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          {sourceIcons[err.source]}
                          {err.source}
                        </span>
                        {err.requestMethod && err.requestPath && (
                          <span className="text-xs font-mono text-gray-500">
                            {err.requestMethod} {err.requestPath}
                          </span>
                        )}
                        {err.statusCode && (
                          <span className="text-xs font-mono text-red-500">{err.statusCode}</span>
                        )}
                      </div>
                      <p className="text-sm text-primary truncate font-medium">{err.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={12} />
                          {formatTime(err.createdAt)}
                        </span>
                        {err.userEmail && (
                          <span className="text-xs text-gray-400">{err.userEmail}</span>
                        )}
                        {err.requestId && (
                          <span className="text-xs font-mono text-gray-300">{err.requestId}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {err.resolved ? (
                        <button
                          onClick={() => handleResolve(err.id, false)}
                          disabled={resolving}
                          className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Reopen"
                        >
                          <XCircle size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResolve(err.id, true)}
                          disabled={resolving}
                          className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                          title="Resolve"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedError(err)}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  {total} error{total !== 1 ? 's' : ''} total
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Detail Modal */}
        {selectedError && (
          <MonitoringErrorDetail
            error={selectedError}
            onClose={() => setSelectedError(null)}
            onResolve={handleResolve}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

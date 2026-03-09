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
  AlertCircle,
  CheckCircle2,
  XCircle,
  Bell,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Clock,
  Search,
  Filter,
  Eye,
  X,
  RefreshCw,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
            <h1 className="text-2xl font-bold text-[#1A1A1A]">System Monitoring</h1>
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 card-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <AlertCircle size={20} className="text-red-500" />
                </div>
                <span className="text-sm text-gray-500">Errors (24h)</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1A1A]">{stats.totalErrors24h}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 card-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={20} className="text-orange-500" />
                </div>
                <span className="text-sm text-gray-500">Unresolved</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1A1A]">{stats.unresolvedCount}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 card-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Monitor size={20} className="text-blue-500" />
                </div>
                <span className="text-sm text-gray-500">Backend</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1A1A]">{stats.errorsBySource.backend || 0}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 card-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Smartphone size={20} className="text-purple-500" />
                </div>
                <span className="text-sm text-gray-500">Frontend</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1A1A]">{stats.errorsBySource.frontend || 0}</p>
            </div>
          </div>
        )}

        {/* Top Error Paths */}
        {stats && stats.topPaths.length > 0 && (
          <div className="bg-white rounded-2xl card-shadow p-6">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
              <Zap size={16} className="text-orange-500" />
              Most Affected Endpoints (24h)
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.topPaths.map((p) => (
                <span
                  key={p.path}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-mono text-gray-700"
                >
                  {p.path}
                  <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-semibold">
                    {p.count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filters + Actions */}
        <div className="bg-white rounded-2xl card-shadow p-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search error messages..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
              >
                Search
              </button>
            </form>

            {/* Filter dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={source}
                onChange={(e) => { setSource(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
              >
                <option value="">All Sources</option>
                <option value="backend">Backend</option>
                <option value="frontend">Frontend</option>
              </select>
              <select
                value={level}
                onChange={(e) => { setLevel(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
              >
                <option value="">All Levels</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
              </select>
              <select
                value={resolvedFilter}
                onChange={(e) => { setResolvedFilter(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="false">Unresolved</option>
                <option value="true">Resolved</option>
              </select>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={resolvingAll}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-green-700 bg-green-50 rounded-xl hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    Resolve All
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Resolve all errors?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark all unresolved errors as resolved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResolveAll}>Resolve All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={clearing}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-700 bg-red-50 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Clear Old
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete old resolved errors?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete resolved errors older than 7 days.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearResolved} className="bg-red-600 hover:bg-red-700">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

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
                      <p className="text-sm text-[#1A1A1A] truncate font-medium">{err.message}</p>
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedError(null)}>
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${levelColors[selectedError.level] || 'bg-gray-100 text-gray-700'}`}>
                    {selectedError.level}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    {sourceIcons[selectedError.source]}
                    {selectedError.source}
                  </span>
                  {selectedError.resolved && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-xs font-medium">
                      <CheckCircle2 size={12} />
                      Resolved
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedError(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-4">
                {/* Message */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message</label>
                  <p className="text-sm text-[#1A1A1A] mt-1 font-medium">{selectedError.message}</p>
                </div>

                {/* Context grid */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedError.requestMethod && (
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Request</label>
                      <p className="text-sm font-mono mt-1">{selectedError.requestMethod} {selectedError.requestPath}</p>
                    </div>
                  )}
                  {selectedError.statusCode && (
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status Code</label>
                      <p className="text-sm font-mono mt-1 text-red-600">{selectedError.statusCode}</p>
                    </div>
                  )}
                  {selectedError.requestId && (
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Request ID</label>
                      <p className="text-sm font-mono mt-1">{selectedError.requestId}</p>
                    </div>
                  )}
                  {selectedError.userEmail && (
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User</label>
                      <p className="text-sm mt-1">{selectedError.userEmail}</p>
                    </div>
                  )}
                  {selectedError.ipAddress && (
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">IP Address</label>
                      <p className="text-sm font-mono mt-1">{selectedError.ipAddress}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Time</label>
                    <p className="text-sm mt-1">{selectedError.createdAt ? new Date(selectedError.createdAt).toLocaleString() : '-'}</p>
                  </div>
                </div>

                {/* User Agent */}
                {selectedError.userAgent && (
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User Agent</label>
                    <p className="text-xs text-gray-500 mt-1 break-all">{selectedError.userAgent}</p>
                  </div>
                )}

                {/* Traceback */}
                {selectedError.traceback && (
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Traceback</label>
                    <pre className="mt-2 p-4 bg-[#1A1A1A] text-green-400 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedError.traceback}
                    </pre>
                  </div>
                )}

                {/* Extra */}
                {selectedError.extra && Object.keys(selectedError.extra).length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Extra Context</label>
                    <pre className="mt-2 p-4 bg-gray-50 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedError.extra, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
                {selectedError.resolved ? (
                  <button
                    onClick={() => { handleResolve(selectedError.id, false); setSelectedError(null); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-700 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors"
                  >
                    <XCircle size={16} />
                    Reopen
                  </button>
                ) : (
                  <button
                    onClick={() => { handleResolve(selectedError.id, true); setSelectedError(null); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 size={16} />
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useMutation } from '@/hooks/use-api';
import {
  getSAErrorStats, getSAErrors, resolveSAError,
  type SAErrorStats, type SAErrorItem,
} from '@/lib/api/super-admin';
import { SAAreaChart } from '@/components/sa/charts/sa-area-chart';
import { SABarChart } from '@/components/sa/charts/sa-bar-chart';
import { SA_COLORS } from '@/components/sa/charts/sa-chart-theme';

export default function SAMonitoringPage() {
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<string>('');

  const { data: stats } = useApi<SAErrorStats>(() => getSAErrorStats(), []);

  const params: Record<string, any> = { page, per_page: 15 };
  if (levelFilter) params.level = levelFilter;
  if (sourceFilter) params.source = sourceFilter;
  if (resolvedFilter !== '') params.resolved = resolvedFilter === 'true';

  const { data: errorsData, refetch } = useApi(
    () => getSAErrors(params), [page, levelFilter, sourceFilter, resolvedFilter]
  );
  const { execute: toggleResolve } = useMutation(
    (id: string, resolved: boolean) => resolveSAError(id, resolved)
  );

  const handleResolve = async (id: string, resolved: boolean) => {
    await toggleResolve(id, resolved);
    refetch();
  };

  // Transform trend data for chart
  const trendData = (stats?.errorTrend || []).map((d) => ({
    date: d.date,
    critical: d.critical,
    errors: d.error,
    warnings: d.warning,
  }));

  const instituteBarData = (stats?.topErrorInstitutes || []).map((i) => ({
    name: i.name,
    value: i.count,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Error Monitoring</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Cross-institute error tracking</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-5 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm text-zinc-500">Errors (24h)</span>
            </div>
            <div className="text-2xl font-bold text-zinc-900">{stats.totalErrors24h}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={16} className="text-amber-500" />
              <span className="text-sm text-zinc-500">Unresolved</span>
            </div>
            <div className="text-2xl font-bold text-zinc-900">{stats.unresolvedCount}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-500">By Source</span>
            </div>
            <div className="flex gap-3 text-sm">
              <span>Backend: <strong>{stats.errorsBySource.backend || 0}</strong></span>
              <span>Frontend: <strong>{stats.errorsBySource.frontend || 0}</strong></span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-500">By Level</span>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">Critical: {stats.errorsByLevel.critical || 0}</span>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Error: {stats.errorsByLevel.error || 0}</span>
              <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Warn: {stats.errorsByLevel.warning || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-4">Error Trend (7 days)</h2>
          {trendData.length > 0 ? (
            <SAAreaChart data={trendData} dataKey="errors" secondaryKey="critical" height={220} />
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-zinc-400">No data</div>
          )}
        </div>
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-4">Top Erroring Institutes</h2>
          {instituteBarData.length > 0 ? (
            <SABarChart data={instituteBarData} layout="horizontal" color={SA_COLORS.tertiary} height={220} />
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-zinc-400">No institute errors</div>
          )}
        </div>
      </div>

      {/* Error List */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="font-semibold text-zinc-900">Error Log</h2>
            <div className="flex gap-2 flex-wrap">
              <select
                value={levelFilter}
                onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
                className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5"
              >
                <option value="">All Levels</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5"
              >
                <option value="">All Sources</option>
                <option value="backend">Backend</option>
                <option value="frontend">Frontend</option>
              </select>
              <select
                value={resolvedFilter}
                onChange={(e) => { setResolvedFilter(e.target.value); setPage(1); }}
                className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5"
              >
                <option value="">All Status</option>
                <option value="false">Unresolved</option>
                <option value="true">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="px-5 py-3 font-medium text-zinc-500">Level</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Message</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Path</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Source</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Time</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {(errorsData?.data || []).map((err) => (
                <tr key={err.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      err.level === 'critical' ? 'bg-red-100 text-red-700' :
                      err.level === 'error' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {err.level}
                    </span>
                  </td>
                  <td className="px-5 py-3 max-w-xs truncate text-zinc-900">{err.message}</td>
                  <td className="px-5 py-3 text-zinc-500 font-mono text-xs">{err.requestPath || '-'}</td>
                  <td className="px-5 py-3 text-zinc-500">{err.source}</td>
                  <td className="px-5 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {err.createdAt ? new Date(err.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleResolve(err.id, !err.resolved)}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                        err.resolved
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {err.resolved ? 'Resolved' : 'Resolve'}
                    </button>
                  </td>
                </tr>
              ))}
              {(!errorsData?.data || errorsData.data.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-400">No errors found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {errorsData && errorsData.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-100">
            <span className="text-xs text-zinc-500">
              Page {errorsData.page} of {errorsData.totalPages} ({errorsData.total} total)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= errorsData.totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

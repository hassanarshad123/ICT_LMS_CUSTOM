'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Download, Eye } from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getSAErrorStats, getSAErrors, resolveSAError, exportErrorsCSV,
  listInstitutes,
  type SAErrorStats, type SAErrorItem, type InstituteOut,
} from '@/lib/api/super-admin';
import { downloadBlob } from '@/lib/utils/download';
import { toast } from 'sonner';
import { SAAreaChart } from '@/components/sa/charts/sa-area-chart';
import { SABarChart } from '@/components/sa/charts/sa-bar-chart';
import { SA_COLORS } from '@/components/sa/charts/sa-chart-theme';

export default function SAMonitoringPage() {
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<string>('');
  const [instituteFilter, setInstituteFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const [resolveModalError, setResolveModalError] = useState<SAErrorItem | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const [detailError, setDetailError] = useState<SAErrorItem | null>(null);

  const { data: stats } = useApi<SAErrorStats>(() => getSAErrorStats(), []);

  const { data: institutesData } = useApi<{ data: InstituteOut[] }>(
    () => listInstitutes({ per_page: 100 }), []
  );

  const params: Record<string, any> = { page, per_page: 15 };
  if (levelFilter) params.level = levelFilter;
  if (sourceFilter) params.source = sourceFilter;
  if (resolvedFilter !== '') params.resolved = resolvedFilter === 'true';
  if (instituteFilter) params.institute_id = instituteFilter;

  const { data: errorsData, refetch } = useApi(
    () => getSAErrors(params), [page, levelFilter, sourceFilter, resolvedFilter, instituteFilter]
  );

  const { execute: toggleResolve } = useMutation(
    (id: string, resolved: boolean, notes?: string) => resolveSAError(id, resolved, notes)
  );

  const handleResolveWithNotes = async () => {
    if (!resolveModalError) return;
    try {
      await toggleResolve(resolveModalError.id, true, resolveNotes || undefined);
      toast.success('Error resolved');
      setResolveModalError(null);
      setResolveNotes('');
      refetch();
    } catch {
      toast.error('Failed to resolve');
    }
  };

  const handleQuickToggle = async (id: string, resolved: boolean) => {
    if (!resolved) {
      const err = (errorsData?.data || []).find((e) => e.id === id);
      if (err) {
        setResolveModalError(err);
        return;
      }
    }
    await toggleResolve(id, resolved);
    refetch();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportErrorsCSV({
        institute_id: instituteFilter || undefined,
        level: levelFilter || undefined,
        source: sourceFilter || undefined,
        resolved: resolvedFilter !== '' ? resolvedFilter === 'true' : undefined,
      });
      downloadBlob(blob, `errors-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Error Monitoring</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Cross-institute error tracking</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
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
              <select
                value={instituteFilter}
                onChange={(e) => { setInstituteFilter(e.target.value); setPage(1); }}
                className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5"
              >
                <option value="">All Institutes</option>
                {(institutesData?.data ?? []).map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
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
                <th className="px-5 py-3 font-medium text-zinc-500 w-10"></th>
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
                      onClick={() => handleQuickToggle(err.id, !err.resolved)}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                        err.resolved
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {err.resolved ? 'Resolved' : 'Resolve'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setDetailError(err)}
                      className="p-1 hover:bg-zinc-100 rounded-lg"
                    >
                      <Eye size={14} className="text-zinc-400" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!errorsData?.data || errorsData.data.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-zinc-400">No errors found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {errorsData && errorsData.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-100">
            <span className="text-xs text-zinc-500">
              Page {errorsData.page} of {errorsData.totalPages} ({errorsData.total} total)
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= errorsData.totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Resolve with Notes Modal */}
      {resolveModalError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-zinc-900 mb-2">Resolve Error</h3>
            <p className="text-xs text-zinc-500 mb-1 truncate">{resolveModalError.message}</p>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="Resolution notes (optional) — root cause, fix applied, etc."
              rows={3}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm mt-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#C5D86D]/50"
            />
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => { setResolveModalError(null); setResolveNotes(''); }}
                className="px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveWithNotes}
                className="px-4 py-2 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Detail Modal */}
      {detailError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-zinc-900">Error Detail</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  detailError.level === 'critical' ? 'bg-red-100 text-red-700' :
                  detailError.level === 'error' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {detailError.level}
                </span>
              </div>
              <button onClick={() => setDetailError(null)} className="text-zinc-400 hover:text-zinc-900 text-lg">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Message</div>
                <div className="text-sm text-zinc-900 bg-zinc-50 p-3 rounded-lg">{detailError.message}</div>
              </div>

              {detailError.traceback && (
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Traceback</div>
                  <pre className="text-xs text-zinc-700 bg-zinc-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono max-h-60">
                    {detailError.traceback}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-zinc-500">Method</div>
                  <div className="text-zinc-900">{detailError.requestMethod || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Path</div>
                  <div className="text-zinc-900 font-mono text-xs">{detailError.requestPath || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Status Code</div>
                  <div className="text-zinc-900">{detailError.statusCode || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Source</div>
                  <div className="text-zinc-900">{detailError.source}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">User</div>
                  <div className="text-zinc-900">{detailError.userEmail || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">IP</div>
                  <div className="text-zinc-900">{detailError.ipAddress || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Time</div>
                  <div className="text-zinc-900">{detailError.createdAt ? new Date(detailError.createdAt).toLocaleString() : '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Resolved</div>
                  <div className="text-zinc-900">{detailError.resolved ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {detailError.resolutionNotes && (
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Resolution Notes</div>
                  <div className="text-sm text-zinc-900 bg-green-50 p-3 rounded-lg border border-green-200">{detailError.resolutionNotes}</div>
                </div>
              )}

              {detailError.extra && Object.keys(detailError.extra).length > 0 && (
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Extra Context</div>
                  <pre className="text-xs text-zinc-700 bg-zinc-50 p-3 rounded-lg overflow-x-auto font-mono max-h-40">
                    {JSON.stringify(detailError.extra, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

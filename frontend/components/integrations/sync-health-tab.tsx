'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { useApi, useMutation } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { translateError } from '@/lib/integrations/error-messages';
import {
  Activity, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle, Loader2, ArrowDown, ArrowUp,
} from 'lucide-react';
import {
  listSyncLog, getSyncLogKPIs, retrySyncLogEntry,
  type SyncLogItem,
} from '@/lib/api/integrations';

export default function SyncHealthTab() {
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'retrying' | 'skipped' | 'duplicate'>('all');
  const [page, setPage] = useState(1);

  const {
    data: kpis, loading: kpisLoading, refetch: refetchKpis,
  } = useApi(getSyncLogKPIs, []);
  const {
    data: log, loading: logLoading, error: logError, refetch: refetchLog,
  } = useApi(
    () => listSyncLog({
      page,
      perPage: 50,
      direction: direction === 'all' ? undefined : direction,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, direction, statusFilter],
  );

  const retryMut = useMutation(
    useCallback((id: string) => retrySyncLogEntry(id), []),
  );

  async function onRetry(id: string) {
    try {
      await retryMut.execute(id);
      toast.success('Retry queued');
      refetchLog();
      refetchKpis();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Retry failed');
    }
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Activity size={18} className="text-primary" />}
          label="Success rate (24h)"
          value={kpisLoading ? '—' : `${kpis?.successRate24h ?? 100}%`}
          tone={(kpis?.successRate24h ?? 100) >= 99 ? 'good' : (kpis?.successRate24h ?? 100) >= 95 ? 'warn' : 'bad'}
        />
        <KpiCard
          icon={<CheckCircle size={18} className="text-green-600" />}
          label="Success (24h)"
          value={kpisLoading ? '—' : `${kpis?.successCount24h ?? 0}`}
          tone="neutral"
        />
        <KpiCard
          icon={<XCircle size={18} className="text-red-600" />}
          label="Failures (24h)"
          value={kpisLoading ? '—' : `${kpis?.failureCount24h ?? 0}`}
          tone={(kpis?.failureCount24h ?? 0) > 0 ? 'warn' : 'neutral'}
        />
        <KpiCard
          icon={<Clock size={18} className="text-amber-600" />}
          label="Pending retries"
          value={kpisLoading ? '—' : `${kpis?.pendingRetries ?? 0}`}
          tone={(kpis?.pendingRetries ?? 0) > 0 ? 'warn' : 'neutral'}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-gray-600">Filter:</span>
        <Segmented
          label="Direction"
          value={direction}
          onChange={(v) => { setDirection(v as typeof direction); setPage(1); }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'outbound', label: 'Outbound' },
            { value: 'inbound', label: 'Inbound' },
          ]}
        />
        <Segmented
          label="Status"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'success', label: 'Success' },
            { value: 'failed', label: 'Failed' },
            { value: 'skipped', label: 'Skipped' },
          ]}
        />
        <button
          onClick={() => { refetchLog(); refetchKpis(); }}
          className="ml-auto inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
        {logLoading && (
          <div className="p-8 text-center text-gray-500 text-sm">Loading sync log…</div>
        )}
        {logError && (
          <div className="p-8 text-center text-red-600 text-sm">
            {logError}
          </div>
        )}
        {!logLoading && !logError && (!log?.data || log.data.length === 0) && (
          <div className="p-8 text-center text-gray-500 text-sm">
            No sync events yet. They&apos;ll appear here once Frappe sync runs.
          </div>
        )}
        {!logLoading && !logError && log?.data && log.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">Direction</th>
                  <th className="text-left px-4 py-3 font-medium">Event</th>
                  <th className="text-left px-4 py-3 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Error</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {log.data.map((row) => (
                  <SyncLogRow key={row.id} row={row} onRetry={onRetry} retrying={retryMut.loading} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {log && log.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Page {log.page} of {log.totalPages} — {log.total} total events
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="border border-gray-200 rounded-lg px-3 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(log.totalPages, p + 1))}
                disabled={page >= log.totalPages}
                className="border border-gray-200 rounded-lg px-3 py-1 disabled:opacity-40"
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

function SyncLogRow({
  row, onRetry, retrying,
}: {
  row: SyncLogItem;
  onRetry: (id: string) => void;
  retrying: boolean;
}) {
  const isFailed = row.status === 'failed';
  const isSuccess = row.status === 'success';
  const isOutbound = row.direction === 'outbound';

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
        {new Date(row.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-xs text-gray-700">
          {isOutbound ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {row.direction}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.eventType}</td>
      <td className="px-4 py-3 text-gray-700 text-xs">
        <div>{row.entityType}</div>
        {row.frappeDocName && <div className="text-gray-400 text-[10px] mt-0.5">{row.frappeDocName}</div>}
      </td>
      <td className="px-4 py-3">
        {isSuccess && (
          <Badge className="bg-green-50 text-green-700 border border-green-200">
            <CheckCircle size={10} className="mr-1" /> Success
          </Badge>
        )}
        {isFailed && (
          <Badge className="bg-red-50 text-red-700 border border-red-200">
            <XCircle size={10} className="mr-1" /> Failed
          </Badge>
        )}
        {row.status === 'retrying' && (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={10} className="mr-1" /> Retrying
          </Badge>
        )}
        {row.status === 'skipped' && (
          <Badge className="bg-gray-50 text-gray-600 border border-gray-200">Skipped</Badge>
        )}
        {row.status === 'duplicate' && (
          <Badge className="bg-blue-50 text-blue-700 border border-blue-200">Duplicate</Badge>
        )}
        {row.attemptCount > 1 && (
          <span className="text-[10px] text-gray-400 ml-1">×{row.attemptCount}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs max-w-xs" title={row.errorMessage || ''}>
        {(() => {
          const t = translateError(row.errorMessage);
          const color =
            t.severity === 'info' ? 'text-gray-600'
              : t.severity === 'warning' ? 'text-amber-700'
              : 'text-red-600';
          return (
            <div className="truncate">
              <span className={color}>{t.friendly}</span>
              {t.hint && (
                <span className="block text-[10px] text-gray-400 truncate" title={t.hint}>
                  {t.hint}
                </span>
              )}
            </div>
          );
        })()}
      </td>
      <td className="px-4 py-3 text-right">
        {isFailed && isOutbound && (
          <button
            onClick={() => onRetry(row.id)}
            disabled={retrying}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            {retrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Retry
          </button>
        )}
      </td>
    </tr>
  );
}

function KpiCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const toneColor =
    tone === 'good' ? 'text-green-600'
      : tone === 'warn' ? 'text-amber-600'
      : tone === 'bad' ? 'text-red-600'
      : 'text-primary';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-2xl font-bold leading-none ${toneColor}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function Segmented({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[11px] text-gray-500">{label}:</span>
      <div className="inline-flex bg-gray-100 p-1 rounded-lg">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-xs px-3 py-1 rounded-md transition ${
              value === opt.value
                ? 'bg-white shadow-sm text-primary font-medium'
                : 'text-gray-600 hover:text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

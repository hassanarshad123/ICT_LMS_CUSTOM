'use client';

import { Database, Server, Wifi, WifiOff, Video, Webhook, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { getSystemHealth, type SystemHealth } from '@/lib/api/super-admin';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
  );
}

export default function SAHealthPage() {
  const { data: health, loading, refetch } = useApi<SystemHealth>(() => getSystemHealth(), []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl">Failed to load health data</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">System Health</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Infrastructure and service status</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Infrastructure Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-blue-500" />
            <span className="text-sm font-medium text-zinc-900">Database</span>
            <StatusDot ok={health.dbStatus === 'connected'} />
          </div>
          <div className="text-xs text-zinc-500">
            Status: <span className="font-medium text-zinc-900">{health.dbStatus}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Latency: <span className="font-medium text-zinc-900">{health.dbLatencyMs}ms</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center gap-2 mb-3">
            {health.redisStatus === 'connected' ? (
              <Wifi size={16} className="text-green-500" />
            ) : (
              <WifiOff size={16} className="text-red-500" />
            )}
            <span className="text-sm font-medium text-zinc-900">Redis</span>
            <StatusDot ok={health.redisStatus === 'connected'} />
          </div>
          <div className="text-xs text-zinc-500">
            Memory: <span className="font-medium text-zinc-900">{health.redisMemoryMb} MB</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Hit Rate: <span className="font-medium text-zinc-900">{health.redisHitRate}%</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Keys: <span className="font-medium text-zinc-900">{health.redisTotalKeys.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center gap-2 mb-3">
            <Video size={16} className="text-purple-500" />
            <span className="text-sm font-medium text-zinc-900">Video Pipeline</span>
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-zinc-500">Pending:</span>
            <span className="font-medium text-zinc-900">{health.videoPipeline.pending}</span>
            <span className="text-zinc-500">Processing:</span>
            <span className="font-medium text-amber-600">{health.videoPipeline.processing}</span>
            <span className="text-zinc-500">Ready:</span>
            <span className="font-medium text-green-600">{health.videoPipeline.ready}</span>
            <span className="text-zinc-500">Failed:</span>
            <span className="font-medium text-red-600">{health.videoPipeline.failed}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center gap-2 mb-3">
            <Webhook size={16} className="text-indigo-500" />
            <span className="text-sm font-medium text-zinc-900">Webhooks (24h)</span>
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-zinc-500">Total:</span>
            <span className="font-medium text-zinc-900">{health.webhookStats.total24h}</span>
            <span className="text-zinc-500">Success:</span>
            <span className="font-medium text-green-600">{health.webhookStats.success24h}</span>
            <span className="text-zinc-500">Failed:</span>
            <span className="font-medium text-red-600">{health.webhookStats.failed24h}</span>
            <span className="text-zinc-500">Pending:</span>
            <span className="font-medium text-amber-600">{health.webhookStats.pending}</span>
          </div>
        </div>
      </div>

      {/* Scheduled Jobs */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Scheduled Jobs</h2>
        </div>
        <div className="divide-y divide-zinc-50">
          {health.jobs.map((job) => (
            <div key={job.name} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <div className="text-sm font-medium text-zinc-900">{job.description}</div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">{job.name}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">{job.frequency}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {job.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Institute Breakdown */}
      {health.webhookStats.byInstitute.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200">
          <div className="p-5 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900">Webhook Delivery by Institute</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-5 py-3 font-medium text-zinc-500">Institute</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">Total (24h)</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">Failed (24h)</th>
                </tr>
              </thead>
              <tbody>
                {health.webhookStats.byInstitute.map((item) => (
                  <tr key={item.instituteId} className="border-b border-zinc-50">
                    <td className="px-5 py-3 text-zinc-900">{item.instituteName}</td>
                    <td className="px-5 py-3 text-zinc-600">{item.total24h}</td>
                    <td className="px-5 py-3">
                      <span className={item.failed24h > 0 ? 'text-red-600 font-medium' : 'text-zinc-600'}>
                        {item.failed24h}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

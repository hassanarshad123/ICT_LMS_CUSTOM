'use client';

import { useState } from 'react';
import { Database, Server, Wifi, WifiOff, Video, Webhook, RefreshCw, Shield, ShieldOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getSystemHealth, type SystemHealth,
  getMaintenanceStatus, type MaintenanceStatus,
  enableGlobalMaintenance, disableGlobalMaintenance,
  enableInstituteMaintenance, disableInstituteMaintenance,
  listInstitutes, type InstituteOut,
} from '@/lib/api/super-admin';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
  );
}

export default function SAHealthPage() {
  const { data: health, loading, refetch } = useApi<SystemHealth>(() => getSystemHealth(), []);
  const { data: maintenance, refetch: refetchMaintenance } = useApi<MaintenanceStatus>(
    () => getMaintenanceStatus(), []
  );
  const { data: institutesData } = useApi<{ data: InstituteOut[] }>(
    () => listInstitutes({ per_page: 100 }), []
  );

  const [globalConfirmOpen, setGlobalConfirmOpen] = useState(false);
  const [instituteConfirmId, setInstituteConfirmId] = useState<string | null>(null);
  const [instituteConfirmName, setInstituteConfirmName] = useState('');
  const [instituteConfirmAction, setInstituteConfirmAction] = useState<'enable' | 'disable'>('enable');

  const { execute: toggleGlobal, loading: togglingGlobal } = useMutation(
    async () => {
      if (maintenance?.globalEnabled) {
        await disableGlobalMaintenance();
        toast.success('Global maintenance mode disabled');
      } else {
        await enableGlobalMaintenance();
        toast.success('Global maintenance mode enabled');
      }
      refetchMaintenance();
    }
  );

  const { execute: toggleInstitute, loading: togglingInstitute } = useMutation(
    async (id: string, action: 'enable' | 'disable') => {
      if (action === 'enable') {
        await enableInstituteMaintenance(id);
        toast.success('Institute maintenance mode enabled');
      } else {
        await disableInstituteMaintenance(id);
        toast.success('Institute maintenance mode disabled');
      }
      refetchMaintenance();
    }
  );

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

  const maintenanceInstituteIds = new Set(
    (maintenance?.institutes ?? []).map((i) => i.id)
  );

  const activeInstitutes = (institutesData?.data ?? []).filter(
    (i) => i.status === 'active' || i.status === 'trial'
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">System Health</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Infrastructure, services, and maintenance</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Maintenance Mode */}
      <div className={`rounded-2xl border ${
        maintenance?.globalEnabled ? 'bg-red-50 border-red-200' : 'bg-white border-zinc-200'
      }`}>
        <div className="p-5 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {maintenance?.globalEnabled ? (
                <ShieldOff size={18} className="text-red-500" />
              ) : (
                <Shield size={18} className="text-green-500" />
              )}
              <h2 className="font-semibold text-zinc-900">Maintenance Mode</h2>
              {maintenance?.globalEnabled && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                  ACTIVE
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Global Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900">Global Maintenance</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                When enabled, all institutes see a maintenance page and cannot access the platform
              </div>
            </div>
            <button
              disabled={togglingGlobal}
              onClick={() => setGlobalConfirmOpen(true)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                maintenance?.globalEnabled
                  ? 'bg-red-500 focus:ring-red-500'
                  : 'bg-zinc-300 focus:ring-zinc-500'
              } ${togglingGlobal ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                maintenance?.globalEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {maintenance?.globalEnabled && (
            <div className="flex items-start gap-2 p-3 bg-red-100 rounded-lg">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <div className="text-xs text-red-700">
                Global maintenance mode is active. All users across all institutes are seeing a maintenance page.
                Per-institute toggles below are overridden while global mode is on.
              </div>
            </div>
          )}

          {/* Per-Institute Table */}
          {activeInstitutes.length > 0 && (
            <div>
              <div className="text-sm font-medium text-zinc-900 mb-3">Per-Institute Maintenance</div>
              <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                      <th className="px-4 py-2.5 font-medium text-zinc-500">Institute</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500">Status</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500">Plan</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500 text-right">Maintenance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInstitutes.map((inst) => {
                      const inMaintenance = maintenanceInstituteIds.has(inst.id);
                      return (
                        <tr key={inst.id} className="border-b border-zinc-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-zinc-900">{inst.name}</div>
                            <div className="text-xs text-zinc-500">{inst.slug}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              inst.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {inst.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-zinc-600 capitalize">{inst.planTier}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              disabled={togglingInstitute || maintenance?.globalEnabled}
                              onClick={() => {
                                setInstituteConfirmId(inst.id);
                                setInstituteConfirmName(inst.name);
                                setInstituteConfirmAction(inMaintenance ? 'disable' : 'enable');
                              }}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                inMaintenance
                                  ? 'bg-red-500'
                                  : 'bg-zinc-300'
                              } ${(togglingInstitute || maintenance?.globalEnabled) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                inMaintenance ? 'translate-x-[18px]' : 'translate-x-[3px]'
                              }`} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Maintenance Confirm Dialog */}
      <AlertDialog open={globalConfirmOpen} onOpenChange={setGlobalConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {maintenance?.globalEnabled ? 'Disable Global Maintenance?' : 'Enable Global Maintenance?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {maintenance?.globalEnabled
                ? 'All institutes will regain access to the platform immediately.'
                : 'All users across all institutes will see a maintenance page and will not be able to use the platform. Use this during scheduled downtime or critical updates.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { toggleGlobal(); setGlobalConfirmOpen(false); }}
              className={maintenance?.globalEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {maintenance?.globalEnabled ? 'Disable Maintenance' : 'Enable Maintenance'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Institute Maintenance Confirm Dialog */}
      <AlertDialog open={!!instituteConfirmId} onOpenChange={(open) => { if (!open) setInstituteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {instituteConfirmAction === 'enable'
                ? `Enable Maintenance for ${instituteConfirmName}?`
                : `Disable Maintenance for ${instituteConfirmName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {instituteConfirmAction === 'enable'
                ? `All users of ${instituteConfirmName} will see a maintenance page and will not be able to access their LMS.`
                : `${instituteConfirmName} will regain access to the platform immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (instituteConfirmId) {
                  toggleInstitute(instituteConfirmId, instituteConfirmAction);
                }
                setInstituteConfirmId(null);
              }}
              className={instituteConfirmAction === 'enable' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {instituteConfirmAction === 'enable' ? 'Enable Maintenance' : 'Disable Maintenance'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

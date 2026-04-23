'use client';

import { useState } from 'react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  DollarSign, TrendingUp, Server, AlertTriangle, RefreshCw, Download, Plus,
  HardDrive, Video, Users, GraduationCap,
} from 'lucide-react';
import {
  getCostSummary, getCostByInstitute, getPlatformUsageTrends, getQuotaAlerts,
  submitManualCost, fetchExternalCosts, triggerRecalculation,
  type PlatformCostSummary, type InstituteCostBreakdown, type UsageTrend, type QuotaAlert,
} from '@/lib/api/super-admin';
import { SAKpiCard } from '@/components/sa/charts/sa-kpi-card';
import { SADonutChart } from '@/components/sa/charts/sa-donut-chart';
import { SAAreaChart } from '@/components/sa/charts/sa-area-chart';
import { toast } from 'sonner';

function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatPkr(n: number): string {
  return `Rs ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function formatUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

const SERVICE_LABELS: Record<string, string> = {
  s3: 'AWS S3',
  rds: 'AWS RDS',
  ec2: 'AWS EC2',
  bunny: 'Bunny.net',
  redis: 'Redis',
  vercel: 'Vercel',
  zoom: 'Zoom',
  other: 'Other',
};

export default function SAResourcesPage() {
  const now = new Date();
  const [month, setMonth] = useState(formatMonth(now));
  const [trendDays, setTrendDays] = useState(30);
  const [showCostModal, setShowCostModal] = useState(false);

  const { data: costSummary, loading: loadingCost, refetch: refetchCost } = useApi<PlatformCostSummary>(
    () => getCostSummary(month), [month],
  );
  const { data: instituteCosts, loading: loadingInst, refetch: refetchInst } = useApi<InstituteCostBreakdown[]>(
    () => getCostByInstitute(month), [month],
  );
  const { data: usageTrends, loading: loadingTrends } = useApi<UsageTrend>(
    () => getPlatformUsageTrends(trendDays), [trendDays],
  );
  const { data: alerts, loading: loadingAlerts, refetch: refetchAlerts } = useApi<QuotaAlert[]>(
    () => getQuotaAlerts(), [],
  );

  const { execute: doRecalculate, loading: recalculating } = useMutation(triggerRecalculation);
  const { execute: doFetchCosts, loading: fetchingCosts } = useMutation(
    () => fetchExternalCosts(month),
  );

  const handleRecalculate = async () => {
    await doRecalculate();
    toast.success('Usage recalculated');
    refetchCost();
    refetchInst();
    refetchAlerts();
  };

  const handleFetchCosts = async () => {
    const result = await doFetchCosts();
    const parts = [];
    if (result?.aws) parts.push('AWS');
    if (result?.bunny) parts.push('Bunny');
    toast.success(parts.length ? `Fetched: ${parts.join(', ')}` : 'No external costs available');
    refetchCost();
    refetchInst();
  };

  const loading = loadingCost || loadingInst || loadingTrends || loadingAlerts;

  if (loading && !costSummary) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
      </div>
    );
  }

  const criticalAlerts = (alerts ?? []).filter(a => a.severity !== 'warning');
  const donutData = (costSummary?.byService ?? []).map(s => ({
    name: SERVICE_LABELS[s.service] || s.service,
    value: s.amountPkr,
  }));

  const trendData = (usageTrends?.dataPoints ?? []).map(p => ({
    date: p.date.slice(5),
    storage: p.storageGb,
    video: p.videoGb,
    users: p.users,
    students: p.students,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Resource Management</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Infrastructure costs, usage tracking, and quota monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-zinc-300 rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={handleFetchCosts}
            disabled={fetchingCosts}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-xl text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            <Download size={14} />
            {fetchingCosts ? 'Fetching...' : 'Fetch Costs'}
          </button>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 rounded-xl text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={recalculating ? 'animate-spin' : ''} />
            Recalculate
          </button>
          <button
            onClick={() => setShowCostModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 rounded-xl text-sm hover:bg-zinc-50"
          >
            <Plus size={14} />
            Manual Cost
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-2">
            <AlertTriangle size={16} />
            {criticalAlerts.length} critical quota alert{criticalAlerts.length !== 1 ? 's' : ''}
          </div>
          <div className="space-y-1">
            {criticalAlerts.slice(0, 5).map((a, i) => (
              <div key={i} className="text-sm text-red-600">
                <span className="font-medium">{a.instituteName}</span>: {a.resource} at {a.usagePct}%
                ({a.current}/{a.limit})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SAKpiCard
          label="Monthly Cost"
          value={costSummary ? formatPkr(costSummary.totalPkr) : 'Rs 0'}
          icon={Server}
          color="bg-orange-500"
        />
        <SAKpiCard
          label="Monthly Revenue"
          value={costSummary ? formatPkr(costSummary.totalRevenuePkr) : 'Rs 0'}
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <SAKpiCard
          label="Profit Margin"
          value={costSummary ? formatPkr(costSummary.profitMarginPkr) : 'Rs 0'}
          icon={TrendingUp}
          color={costSummary && costSummary.profitMarginPkr >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
        />
        <SAKpiCard
          label="Quota Alerts"
          value={alerts?.length ?? 0}
          icon={AlertTriangle}
          color={criticalAlerts.length > 0 ? 'bg-red-500' : 'bg-zinc-400'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown Donut */}
        <div className="bg-white rounded-2xl p-6 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Cost by Service</h3>
          {donutData.length > 0 ? (
            <SADonutChart data={donutData} />
          ) : (
            <div className="text-sm text-zinc-400 text-center py-12">No cost data for this month</div>
          )}
          {/* Cost table below chart */}
          {donutData.length > 0 && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-left">
                    <th className="pb-2">Service</th>
                    <th className="pb-2 text-right">USD</th>
                    <th className="pb-2 text-right">PKR</th>
                  </tr>
                </thead>
                <tbody>
                  {(costSummary?.byService ?? []).map(s => (
                    <tr key={s.service} className="border-t border-zinc-50">
                      <td className="py-1.5">{SERVICE_LABELS[s.service] || s.service}</td>
                      <td className="py-1.5 text-right text-zinc-600">{formatUsd(s.amountUsd)}</td>
                      <td className="py-1.5 text-right font-medium">{formatPkr(s.amountPkr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Usage Trends */}
        <div className="bg-white rounded-2xl p-6 border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-900">Usage Trends</h3>
            <select
              value={trendDays}
              onChange={e => setTrendDays(Number(e.target.value))}
              className="border border-zinc-200 rounded-lg px-2 py-1 text-xs"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          {trendData.length > 0 ? (
            <SAAreaChart data={trendData} dataKey="storage" secondaryKey="video" height={240} />
          ) : (
            <div className="text-sm text-zinc-400 text-center py-12">
              Snapshots will appear after the daily job runs
            </div>
          )}
        </div>
      </div>

      {/* Quota Alerts Table */}
      {(alerts?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Quota Alerts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-zinc-100">
                  <th className="pb-2">Institute</th>
                  <th className="pb-2">Resource</th>
                  <th className="pb-2 text-right">Current</th>
                  <th className="pb-2 text-right">Limit</th>
                  <th className="pb-2 text-right">Usage</th>
                  <th className="pb-2">Severity</th>
                </tr>
              </thead>
              <tbody>
                {(alerts ?? []).map((a, i) => (
                  <tr key={i} className="border-t border-zinc-50">
                    <td className="py-2 font-medium">{a.instituteName}</td>
                    <td className="py-2 flex items-center gap-1.5">
                      {a.resource === 'storage' && <HardDrive size={14} />}
                      {a.resource === 'video' && <Video size={14} />}
                      {a.resource === 'users' && <Users size={14} />}
                      {a.resource === 'students' && <GraduationCap size={14} />}
                      {a.resource}
                    </td>
                    <td className="py-2 text-right">{typeof a.current === 'number' ? a.current.toLocaleString() : a.current}</td>
                    <td className="py-2 text-right">{typeof a.limit === 'number' ? a.limit.toLocaleString() : a.limit}</td>
                    <td className="py-2 text-right font-medium">{a.usagePct}%</td>
                    <td className="py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.severity === 'exceeded' ? 'bg-red-100 text-red-700' :
                        a.severity === 'critical' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {a.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-Institute Cost Table */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">Cost by Institute</h3>
          {costSummary && (
            <span className="text-xs text-zinc-500">
              Margin: {costSummary.profitMarginPct}%
            </span>
          )}
        </div>
        {loadingInst ? (
          <div className="text-sm text-zinc-400 text-center py-8">Loading...</div>
        ) : (instituteCosts?.length ?? 0) === 0 ? (
          <div className="text-sm text-zinc-400 text-center py-8">
            No cost attributions yet. Enter costs and click &quot;Fetch Costs&quot; to calculate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-zinc-100">
                  <th className="pb-2">Institute</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2 text-right">Revenue</th>
                  <th className="pb-2 text-right">Cost</th>
                  <th className="pb-2 text-right">Margin</th>
                  <th className="pb-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {(instituteCosts ?? []).map(inst => (
                  <tr key={inst.instituteId} className="border-t border-zinc-50 hover:bg-zinc-50">
                    <td className="py-2 font-medium">{inst.instituteName}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-100 text-zinc-700">
                        {inst.planTier}
                      </span>
                    </td>
                    <td className="py-2 text-right">{formatPkr(inst.revenuePkr)}</td>
                    <td className="py-2 text-right text-zinc-600">{formatPkr(inst.costPkr)}</td>
                    <td className={`py-2 text-right font-medium ${inst.marginPkr >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPkr(inst.marginPkr)}
                    </td>
                    <td className={`py-2 text-right ${inst.marginPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {inst.marginPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Cost Modal */}
      {showCostModal && (
        <ManualCostModal
          month={month}
          onClose={() => setShowCostModal(false)}
          onSuccess={() => {
            setShowCostModal(false);
            refetchCost();
            refetchInst();
          }}
        />
      )}
    </div>
  );
}

function ManualCostModal({
  month,
  onClose,
  onSuccess,
}: {
  month: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [service, setService] = useState('other');
  const [amountUsd, setAmountUsd] = useState('');
  const [amountPkr, setAmountPkr] = useState('');
  const { execute: doSubmit, loading } = useMutation(submitManualCost);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doSubmit({
      service,
      month: `${month}-01`,
      amountUsd: parseFloat(amountUsd) || 0,
      amountPkr: parseFloat(amountPkr) || 0,
    });
    toast.success('Cost entry saved');
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-zinc-900 mb-4">Add Manual Cost</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Service</label>
            <select
              value={service}
              onChange={e => setService(e.target.value)}
              className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm"
            >
              <option value="s3">AWS S3</option>
              <option value="rds">AWS RDS</option>
              <option value="ec2">AWS EC2</option>
              <option value="bunny">Bunny.net</option>
              <option value="redis">Redis</option>
              <option value="vercel">Vercel</option>
              <option value="zoom">Zoom</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Month</label>
            <input
              type="text"
              value={month}
              disabled
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-zinc-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-600 mb-1">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountUsd}
                onChange={e => {
                  setAmountUsd(e.target.value);
                  const usd = parseFloat(e.target.value) || 0;
                  setAmountPkr(String(Math.round(usd * 280)));
                }}
                className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-600 mb-1">Amount (PKR)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={amountPkr}
                onChange={e => setAmountPkr(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

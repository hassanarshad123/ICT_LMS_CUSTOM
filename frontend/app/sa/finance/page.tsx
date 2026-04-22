'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import {
  getFinanceMRR, getFinanceChurn, getFinanceAtRisk, getFinanceLTV, getFinanceForecast,
  type MRRData, type ChurnData, type AtRiskData, type LTVData, type ForecastData,
} from '@/lib/api/super-admin';
import { SAKpiCard } from '@/components/sa/charts/sa-kpi-card';
import { SAAreaChart } from '@/components/sa/charts/sa-area-chart';
import { SADonutChart } from '@/components/sa/charts/sa-donut-chart';
import { SABarChart } from '@/components/sa/charts/sa-bar-chart';
import { SA_COLORS } from '@/components/sa/charts/sa-chart-theme';

export default function SAFinancePage() {
  const [churnPeriod, setChurnPeriod] = useState(30);

  const { data: mrr, loading: mrrLoading } = useApi<MRRData>(
    () => getFinanceMRR(), []
  );
  const { data: churn } = useApi<ChurnData>(
    () => getFinanceChurn(churnPeriod), [churnPeriod]
  );
  const { data: atRisk } = useApi<AtRiskData>(
    () => getFinanceAtRisk(), []
  );
  const { data: ltv } = useApi<LTVData>(
    () => getFinanceLTV(), []
  );
  const { data: forecast } = useApi<ForecastData>(
    () => getFinanceForecast(3), []
  );

  if (mrrLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
      </div>
    );
  }

  const mrrTierData = mrr?.byTier
    ? Object.entries(mrr.byTier).map(([name, value]) => ({ name, value }))
    : [];

  const ltvBarData = (ltv?.byTier || []).map((t) => ({
    name: t.tier,
    value: t.ltv,
  }));

  const forecastChartData = (forecast?.forecast || []).map((f) => ({
    date: f.month,
    users: f.projected,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Financial Intelligence</h1>
        <p className="text-zinc-500 text-sm mt-0.5">SaaS metrics and revenue insights</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SAKpiCard
          label="Monthly Recurring Revenue"
          value={`PKR ${((mrr?.totalMrr || 0) / 100).toLocaleString()}`}
          icon={TrendingUp}
          color="bg-emerald-500"
        />
        <SAKpiCard
          label="Churn Rate"
          value={`${churn?.churnRatePct?.toFixed(1) || '0.0'}%`}
          icon={AlertTriangle}
          color={churn && churn.churnRatePct > 5 ? 'bg-red-500' : 'bg-amber-500'}
        />
        <SAKpiCard
          label="Active Institutes"
          value={churn?.totalActive?.toString() || '0'}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <SAKpiCard
          label="At-Risk Accounts"
          value={(atRisk?.accounts?.length || 0).toString()}
          icon={AlertTriangle}
          color="bg-red-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MRR Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-4">Revenue Trend (Last 6 Months)</h2>
          {(mrr?.trend || []).length > 0 ? (
            <SAAreaChart
              data={(mrr?.trend || []).map((t) => ({ date: t.month, users: t.mrr / 100 }))}
              dataKey="users"
            />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-zinc-400">
              No revenue data yet
            </div>
          )}
        </div>

        {/* MRR by Tier */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-2">MRR by Plan</h2>
          {mrrTierData.length > 0 ? (
            <SADonutChart data={mrrTierData.map((d) => ({ name: d.name, value: d.value / 100 }))} />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-zinc-400">
              No plan data
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* At-Risk Accounts */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-900">At-Risk Accounts</h2>
          </div>
          {(atRisk?.accounts || []).length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {(atRisk?.accounts || []).map((a) => (
                <Link
                  key={a.id}
                  href={`/sa/institutes/${a.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{a.name}</div>
                    <div className="text-xs text-zinc-500">{a.reasons.join(' | ')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.riskScore > 70 ? 'bg-red-100 text-red-700' :
                      a.riskScore > 40 ? 'bg-amber-100 text-amber-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {a.riskScore}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-zinc-400">
              No at-risk accounts
            </div>
          )}
        </div>

        {/* LTV by Tier */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-4">Lifetime Value by Tier</h2>
          {ltvBarData.length > 0 ? (
            <SABarChart data={ltvBarData.map((d) => ({ name: d.name, value: d.value / 100 }))} layout="horizontal" color={SA_COLORS.primary} height={250} />
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-zinc-400">
              No LTV data
            </div>
          )}
        </div>
      </div>

      {/* Churn Details + Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Churn Detail */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-900">Churned Institutes</h2>
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5">
              {[30, 60, 90].map((p) => (
                <button
                  key={p}
                  onClick={() => setChurnPeriod(p)}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                    churnPeriod === p ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>
          {(churn?.churnedInstitutes || []).length > 0 ? (
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {(churn?.churnedInstitutes || []).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                    <div className="text-xs text-zinc-500">{c.eventType.replace('_', ' ')} — {c.eventDate ? new Date(c.eventDate).toLocaleDateString() : ''}</div>
                  </div>
                  {c.previousTier && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-600">{c.previousTier}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-zinc-400">
              No churn in this period
            </div>
          )}
        </div>

        {/* Revenue Forecast */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-4">Revenue Forecast (Next 3 Months)</h2>
          {forecastChartData.length > 0 ? (
            <SAAreaChart data={forecastChartData} dataKey="users" />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-zinc-400">
              Not enough data for forecast
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Building2, Users, HardDrive, Video, GraduationCap, BookOpen, Layers, Award } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import {
  getAnalyticsOverview, getGrowthTrends, getPlanDistribution,
  getTopInstitutes, getQuotaUtilization,
  type SAOverview, type GrowthTrends, type PlanDistribution,
  type TopInstituteItem, type QuotaUtilizationItem,
} from '@/lib/api/super-admin';
import { SAKpiCard } from '@/components/sa/charts/sa-kpi-card';
import { SAPeriodSelector } from '@/components/sa/charts/sa-period-selector';
import { SAAreaChart } from '@/components/sa/charts/sa-area-chart';
import { SADonutChart } from '@/components/sa/charts/sa-donut-chart';
import { SABarChart } from '@/components/sa/charts/sa-bar-chart';
import { SAHorizontalBar } from '@/components/sa/charts/sa-horizontal-bar';
import { SA_COLORS } from '@/components/sa/charts/sa-chart-theme';
import Link from 'next/link';

type TopMetric = 'users' | 'storage' | 'courses' | 'certificates';

export default function SADashboard() {
  const [period, setPeriod] = useState(30);
  const [topMetric, setTopMetric] = useState<TopMetric>('users');

  const { data: overview, loading: loadingOverview } = useApi<SAOverview>(
    () => getAnalyticsOverview(period), [period]
  );
  const { data: trends } = useApi<GrowthTrends>(
    () => getGrowthTrends(period), [period]
  );
  const { data: planDist } = useApi<PlanDistribution>(
    () => getPlanDistribution(), []
  );
  const { data: topInstitutes } = useApi<TopInstituteItem[]>(
    () => getTopInstitutes(topMetric, 5), [topMetric]
  );
  const { data: quotaData } = useApi<QuotaUtilizationItem[]>(
    () => getQuotaUtilization(), []
  );

  if (loadingOverview) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl">Failed to load dashboard</div>
      </div>
    );
  }

  // Merge trends for area chart
  const growthData = (trends?.newUsers || []).map((u) => {
    const inst = trends?.newInstitutes?.find((i) => i.date === u.date);
    return { date: u.date, users: u.count, institutes: inst?.count || 0 };
  });

  // Donut data
  const planData = planDist
    ? Object.entries(planDist).map(([name, value]) => ({ name, value }))
    : [];

  // Bar chart data
  const barData = (topInstitutes || []).map((i) => ({ name: i.name, value: i.value }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Platform Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Command center for all institutes</p>
        </div>
        <SAPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SAKpiCard
          label="Total Institutes"
          value={overview.totalInstitutes}
          icon={Building2}
          color="bg-blue-500"
        />
        <SAKpiCard
          label="Total Users"
          value={overview.totalUsers.toLocaleString()}
          currentValue={overview.totalUsers}
          previousValue={overview.totalUsersPrev}
          icon={Users}
          color="bg-purple-500"
        />
        <SAKpiCard
          label="Courses"
          value={overview.totalCourses}
          currentValue={overview.totalCourses}
          previousValue={overview.totalCoursesPrev}
          icon={BookOpen}
          color="bg-emerald-500"
        />
        <SAKpiCard
          label="Certificates"
          value={overview.totalCertificates}
          currentValue={overview.totalCertificates}
          previousValue={overview.totalCertificatesPrev}
          icon={Award}
          color="bg-amber-500"
        />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SAKpiCard label="Batches" value={overview.totalBatches} currentValue={overview.totalBatches} previousValue={overview.totalBatchesPrev} icon={Layers} color="bg-indigo-500" />
        <SAKpiCard label="Storage Used" value={`${overview.totalStorageGb} GB`} icon={HardDrive} color="bg-cyan-600" />
        <SAKpiCard label="Video Storage" value={`${overview.totalVideoGb} GB`} icon={Video} color="bg-pink-500" />
      </div>

      {/* Charts Row: Growth + Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-900">Growth Trends</h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SA_COLORS.primary }} />
                Users
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SA_COLORS.secondary }} />
                Institutes
              </span>
            </div>
          </div>
          {growthData.length > 0 ? (
            <SAAreaChart data={growthData} dataKey="users" secondaryKey="institutes" />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-zinc-400">
              No growth data for this period
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-2">Institutes by Plan</h2>
          {planData.length > 0 ? (
            <SADonutChart data={planData} />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-zinc-400">
              No plan data
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Top Institutes + Quota Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-900">Top Institutes</h2>
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5">
              {(['users', 'storage', 'courses', 'certificates'] as TopMetric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setTopMetric(m)}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-all capitalize ${
                    topMetric === m ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {barData.length > 0 ? (
            <SABarChart data={barData} layout="horizontal" color={SA_COLORS.primary} height={250} />
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-zinc-400">
              No institute data
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-900">Quota Utilization</h2>
            <Link href="/sa/institutes" className="text-xs text-zinc-500 hover:text-zinc-900">
              View all
            </Link>
          </div>
          <SAHorizontalBar
            data={(quotaData || []).filter((d) => d.highestPct > 0).slice(0, 5)}
          />
        </div>
      </div>

      {/* Institute Status Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-zinc-200 text-center">
          <div className="text-2xl font-bold text-green-600">{overview.activeInstitutes}</div>
          <div className="text-xs text-zinc-500 mt-1">Active</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-zinc-200 text-center">
          <div className="text-2xl font-bold text-red-500">{overview.suspendedInstitutes}</div>
          <div className="text-xs text-zinc-500 mt-1">Suspended</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-zinc-200 text-center">
          <div className="text-2xl font-bold text-amber-500">{overview.trialInstitutes}</div>
          <div className="text-xs text-zinc-500 mt-1">Trial</div>
        </div>
      </div>
    </div>
  );
}

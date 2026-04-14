'use client';

import { useMemo, useState } from 'react';
import RoleGuard from '@/components/shared/role-guard';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useApi } from '@/hooks/use-api';
import { getAdmissionsAdminStats } from '@/lib/api/admissions';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { formatMoney } from '@/lib/utils/format';
import { Users, Wallet, UserPlus, TrendingUp, Download, UserCheck } from 'lucide-react';

export default function AdmissionsTeamPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading, error, refetch } = useApi(
    () => getAdmissionsAdminStats({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [dateFrom, dateTo],
  );

  const exportCsv = () => {
    if (!data) return;
    const header = ['Officer', 'Email', 'Status', 'Students Onboarded', 'Active Students', 'Revenue Collected (PKR)', 'Total Billed (PKR)', 'Avg Fee (PKR)', 'Payments'];
    const rows = data.officers.map((o) => [
      o.name, o.email, o.status,
      o.studentsOnboarded, o.activeStudents, o.revenueCollected, o.totalBilled, o.avgFee, o.paymentsCount,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admissions-team-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const topOfficer = useMemo(() => data?.officers.find((o) => o.revenueCollected > 0), [data]);

  return (
    <RoleGuard allowed={['admin']}>
      <DashboardLayout>
        <DashboardHeader
          greeting="Admissions Team"
          subtitle="Per-officer performance — students onboarded, revenue collected, and active roster"
        />

        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:underline"
            >
              Clear
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={exportCsv}
            disabled={!data || data.officers.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {loading && <PageLoading variant="cards" />}
        {error && <PageError message={error} onRetry={refetch} />}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Users size={20} />}
                label="Officers"
                value={String(data.summary.officersTotal)}
              />
              <StatCard
                icon={<UserPlus size={20} />}
                label="Students Onboarded"
                value={String(data.summary.plansTotal)}
              />
              <StatCard
                icon={<UserCheck size={20} />}
                label="Active Students"
                value={String(data.summary.activeStudentsTotal)}
              />
              <StatCard
                icon={<Wallet size={20} className="text-emerald-600" />}
                label="Revenue Collected"
                value={formatMoney(data.summary.revenueTotal)}
                accent="emerald"
              />
            </div>

            {topOfficer && (
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <TrendingUp size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Top performer</p>
                  <p className="font-semibold text-primary">
                    {topOfficer.name} · {formatMoney(topOfficer.revenueCollected)} collected ·{' '}
                    {topOfficer.studentsOnboarded} students
                  </p>
                </div>
              </div>
            )}

            {data.officers.length === 0 ? (
              <EmptyState
                icon={<Users size={28} className="text-gray-400" />}
                title="No admissions officers yet"
                description="Add officers from the Admissions Officers page to start tracking performance."
              />
            ) : (
              <div className="bg-white rounded-2xl card-shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Officer</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Onboarded</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Active</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Billed</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Avg Fee</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Payments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.officers.map((o) => (
                        <tr key={o.officerId} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-primary">{o.name}</div>
                            <div className="text-xs text-gray-500">{o.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                o.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-primary">
                            {o.studentsOnboarded}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{o.activeStudents}</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-700">
                            {formatMoney(o.revenueCollected)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {formatMoney(o.totalBilled)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {formatMoney(o.avgFee)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{o.paymentsCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </RoleGuard>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'emerald';
}) {
  const bg = accent === 'emerald' ? 'bg-emerald-50' : 'bg-accent';
  return (
    <div className="bg-white rounded-2xl p-6 card-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${bg}`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-primary break-words">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

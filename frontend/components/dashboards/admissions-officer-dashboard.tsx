'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { listAdmissionsStudents } from '@/lib/api/admissions';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { UserPlus, Users, Wallet, Clock, AlertTriangle } from 'lucide-react';

export default function AdmissionsOfficerDashboard() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const [search, setSearch] = useState('');

  const { data, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listAdmissionsStudents({ ...params, search: search || undefined }),
    15,
    [search],
  );

  const rows = data || [];

  const stats = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + (r.amountPaid || 0), 0);
    const overdue = rows.filter((r) => r.isOverdue).length;
    return {
      students: total,
      thisMonth: rows.filter((r) => {
        const d = new Date(r.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      revenue,
      overdue,
    };
  }, [rows, total]);

  return (
    <DashboardLayout>
      <DashboardHeader
        greeting={`Welcome, ${name || 'Admissions Officer'}`}
        subtitle="Onboard students, track fees, and follow up on payments"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={20} />} label="My Students" value={String(stats.students)} />
        <StatCard icon={<UserPlus size={20} />} label="Onboarded This Month" value={String(stats.thisMonth)} />
        <StatCard icon={<Wallet size={20} />} label="Revenue Collected" value={formatMoney(stats.revenue)} />
        <StatCard
          icon={<AlertTriangle size={20} className="text-red-500" />}
          label="Overdue Students"
          value={String(stats.overdue)}
          accent={stats.overdue > 0 ? 'red' : undefined}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search students by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white"
        />
        <Link
          href={`${basePath}/admissions/onboard`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          <UserPlus size={16} /> Onboard Student
        </Link>
      </div>

      {loading && <PageLoading variant="table" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={28} className="text-gray-400" />}
          title="No students onboarded yet"
          description="Start by onboarding your first paying student."
          action={{
            label: 'Onboard Student',
            onClick: () => {
              window.location.href = `${basePath}/admissions/onboard`;
            },
          }}
        />
      ) : !loading && !error && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Batch</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Fee</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Balance</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Next Due</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.feePlanId}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      window.location.href = `${basePath}/admissions/students/${r.userId}`;
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">{r.name}</div>
                      <div className="text-xs text-gray-500">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.batchName}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-600">{planLabel(r.planType)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-primary">
                      {formatMoney(r.finalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatMoney(r.amountPaid)}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {formatMoney(r.balanceDue)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-gray-400" />
                        {formatDate(r.nextDueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.isOverdue ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Overdue
                        </span>
                      ) : r.balanceDue === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          Paid in full
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          On track
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages} · {total} total
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </DashboardLayout>
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
  accent?: 'red';
}) {
  return (
    <div className="bg-white rounded-2xl p-6 card-shadow">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
          accent === 'red' ? 'bg-red-50' : 'bg-accent'
        }`}
      >
        {icon}
      </div>
      <p className="text-3xl font-bold text-primary">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function planLabel(t: string): string {
  if (t === 'one_time') return 'One-time';
  if (t === 'monthly') return 'Monthly';
  if (t === 'installment') return 'Installment';
  return t;
}

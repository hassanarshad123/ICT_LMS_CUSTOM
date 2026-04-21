'use client';

import RoleGuard from '@/components/shared/role-guard';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useApi } from '@/hooks/use-api';
import { getMyFees, type MyFeesPlan } from '@/lib/api/admissions';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';
import {
  Wallet,
  Calendar,
  AlertTriangle,
  Check,
  Receipt,
  Clock,
  CreditCard,
} from 'lucide-react';

export default function MyFeesPage() {
  const { data, loading, error, refetch } = useApi(() => getMyFees(), []);

  return (
    <RoleGuard allowed={['admin', 'student', 'teacher', 'course-creator', 'admissions-officer']}>
      <DashboardLayout>
        <DashboardHeader
          greeting="My Fees"
          subtitle="Payment history, upcoming dues, and receipts"
        />

        {loading && <PageLoading variant="cards" />}
        {error && <PageError message={error} onRetry={refetch} />}

        {!loading && !error && data && data.plans.length === 0 && (
          <EmptyState
            icon={<Wallet size={28} className="text-gray-400" />}
            title="No fee plans yet"
            description="Once an admissions officer sets up your fee plan, it will show up here."
          />
        )}

        {!loading && !error && data && data.plans.length > 0 && (
          <>
            <SummaryRow data={data.summary} />
            <div className="space-y-6 mt-6">
              {data.plans.map((plan) => (
                <PlanCard key={plan.feePlanId} plan={plan} />
              ))}
            </div>
          </>
        )}
      </DashboardLayout>
    </RoleGuard>
  );
}

function SummaryRow({ data }: { data: NonNullable<ReturnType<typeof getMyFees> extends Promise<infer T> ? T : never>['summary'] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<CreditCard size={20} />}
        label="Total Billed"
        value={formatMoney(data.totalBilled, data.currency)}
      />
      <StatCard
        icon={<Check size={20} className="text-emerald-600" />}
        label="Total Paid"
        value={formatMoney(data.totalPaid, data.currency)}
        accent="emerald"
      />
      <StatCard
        icon={<Wallet size={20} className={data.balanceDue > 0 ? 'text-red-500' : 'text-gray-500'} />}
        label="Balance Due"
        value={formatMoney(data.balanceDue, data.currency)}
        accent={data.balanceDue > 0 ? 'red' : undefined}
      />
      {data.isOverdue ? (
        <StatCard
          icon={<AlertTriangle size={20} className="text-red-500" />}
          label="Status"
          value="Overdue"
          accent="red"
        />
      ) : data.nextDueDate ? (
        <StatCard
          icon={<Clock size={20} />}
          label="Next Due"
          value={`${formatDate(data.nextDueDate)} · ${formatMoney(data.nextDueAmount, data.currency)}`}
        />
      ) : (
        <StatCard
          icon={<Check size={20} className="text-emerald-600" />}
          label="Status"
          value="Paid up"
          accent="emerald"
        />
      )}
    </div>
  );
}

function PlanCard({ plan }: { plan: MyFeesPlan }) {
  return (
    <div className="bg-white rounded-2xl p-6 card-shadow">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-primary">{plan.batchName}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {planLabel(plan.planType)} · Started {formatDate(plan.createdAt)}
          </p>
        </div>
        <StatusBadge plan={plan} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <Metric label="Total" value={formatMoney(plan.finalAmount, plan.currency)} />
        <Metric
          label="Paid"
          value={formatMoney(plan.amountPaid, plan.currency)}
          accent="emerald"
        />
        <Metric
          label="Balance"
          value={formatMoney(plan.balanceDue, plan.currency)}
          accent={plan.balanceDue > 0 ? 'red' : 'emerald'}
        />
        <Metric label="Next due" value={formatDate(plan.nextDueDate)} />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Upcoming installments</p>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500">
            <tr>
              <th className="text-left py-2">#</th>
              <th className="text-left py-2">Label</th>
              <th className="text-right py-2">Amount</th>
              <th className="text-right py-2">Paid</th>
              <th className="text-left py-2 pl-4">Due</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {plan.installments.map((i) => (
              <tr key={i.id} className="border-t border-gray-100">
                <td className="py-2 font-medium text-gray-500">{i.sequence}</td>
                <td className="py-2 text-gray-700">{i.label || '—'}</td>
                <td className="py-2 text-right">{formatMoney(i.amountDue, plan.currency)}</td>
                <td className="py-2 text-right text-emerald-700">
                  {formatMoney(i.amountPaid, plan.currency)}
                </td>
                <td className="py-2 pl-4 text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} className="text-gray-400" />
                    {formatDate(i.dueDate)}
                  </span>
                </td>
                <td className="py-2">
                  <InstallmentStatusBadge status={i.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.payments.length > 0 && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Payment history</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="text-left py-2">Receipt</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Method</th>
                <th className="text-left py-2">Reference</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {plan.payments.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="py-2 text-gray-700">
                    <span className="inline-flex items-center gap-1">
                      <Receipt size={12} className="text-gray-400" />
                      {p.receiptNumber || '—'}
                    </span>
                  </td>
                  <td className="py-2 text-gray-600">{formatDateTime(p.paymentDate)}</td>
                  <td className="py-2 text-gray-600 capitalize">
                    {p.paymentMethod.replace('_', ' ')}
                  </td>
                  <td className="py-2 text-gray-600">{p.referenceNumber || '—'}</td>
                  <td className="py-2 text-right font-medium text-emerald-700">
                    {formatMoney(p.amount, plan.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plan.isOverdue && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} />
          One or more installments are overdue. Contact your admissions officer to settle the balance.
        </div>
      )}
    </div>
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
  accent?: 'red' | 'emerald';
}) {
  const bg =
    accent === 'red' ? 'bg-red-50' : accent === 'emerald' ? 'bg-emerald-50' : 'bg-accent';
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

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'red';
}) {
  const color =
    accent === 'emerald' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : 'text-primary';
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ plan }: { plan: MyFeesPlan }) {
  if (plan.isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle size={12} /> Overdue
      </span>
    );
  }
  if (plan.balanceDue === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <Check size={12} /> Paid in full
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      On track
    </span>
  );
}

function InstallmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    partially_paid: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
    waived: 'bg-indigo-100 text-indigo-700',
  };
  const label: Record<string, string> = {
    pending: 'Pending',
    partially_paid: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    waived: 'Waived',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.pending}`}>
      {label[status] || status}
    </span>
  );
}

function planLabel(t: string): string {
  if (t === 'one_time') return 'One-time fee';
  if (t === 'monthly') return 'Monthly recurring';
  if (t === 'installment') return 'Installment plan';
  return t;
}

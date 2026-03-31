'use client';

import { useState } from 'react';
import { CreditCard, TrendingUp, AlertCircle, Receipt } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { getRevenueDashboard, listInvoices, type RevenueDashboard, type InvoiceItem } from '@/lib/api/super-admin';
import { SAKpiCard } from '@/components/sa/charts/sa-kpi-card';
import { SABarChart } from '@/components/sa/charts/sa-bar-chart';
import { SA_COLORS } from '@/components/sa/charts/sa-chart-theme';
import Link from 'next/link';

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

export default function SABillingPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: revenue } = useApi<RevenueDashboard>(() => getRevenueDashboard(), []);

  const params: Record<string, any> = { page, per_page: 15 };
  if (statusFilter) params.status = statusFilter;
  const { data: invoicesData } = useApi(() => listInvoices(params), [page, statusFilter]);

  const trendData = (revenue?.monthlyTrend || []).map((t) => ({
    name: t.month,
    value: t.amount,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Billing & Revenue</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Track payments and invoices across institutes</p>
      </div>

      {/* KPI Cards */}
      {revenue && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SAKpiCard label="Total Collected" value={formatPKR(revenue.totalCollected)} icon={CreditCard} color="bg-green-500" />
          <SAKpiCard label="Outstanding" value={formatPKR(revenue.totalOutstanding)} icon={AlertCircle} color="bg-amber-500" />
          <SAKpiCard label="Free Tier" value={formatPKR(revenue.revenueByPlan.free || 0)} icon={Receipt} color="bg-zinc-500" />
          <SAKpiCard label="Paid Plans" value={formatPKR((revenue.revenueByPlan.basic || 0) + (revenue.revenueByPlan.pro || 0) + (revenue.revenueByPlan.enterprise || 0))} icon={TrendingUp} color="bg-purple-500" />
        </div>
      )}

      {/* Revenue Trend */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-4">Monthly Revenue Trend</h2>
          <SABarChart data={trendData} color={SA_COLORS.primary} height={250} />
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Invoices</h2>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="px-5 py-3 font-medium text-zinc-500">Invoice #</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Institute</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Amount</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Status</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Due Date</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {(invoicesData?.data || []).map((inv: InvoiceItem) => (
                <tr key={inv.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-zinc-900">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3">
                    <Link href={`/sa/billing/${inv.instituteId}`} className="text-zinc-900 hover:underline">
                      {inv.instituteName || '-'}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-medium text-zinc-900">{formatPKR(inv.totalAmount)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                      inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{inv.dueDate}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
              {(!invoicesData?.data || invoicesData.data.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-400">No invoices yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {invoicesData && invoicesData.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-100">
            <span className="text-xs text-zinc-500">Page {invoicesData.page} of {invoicesData.totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= invoicesData.totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

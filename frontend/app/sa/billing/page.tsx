'use client';

import { useState } from 'react';
import { CreditCard, TrendingUp, AlertCircle, Receipt, FileText, Download, ChevronRight } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import {
  getRevenueDashboard, listInvoices, listInstitutes, downloadInvoicePDF,
  type RevenueDashboard, type InvoiceItem, type InstituteOut,
} from '@/lib/api/super-admin';
import { SAKpiCard } from '@/components/sa/charts/sa-kpi-card';
import { SABarChart } from '@/components/sa/charts/sa-bar-chart';
import { SA_COLORS } from '@/components/sa/charts/sa-chart-theme';
import { SAInvoiceBuilder } from '@/components/pages/sa/sa-invoice-builder';
import Link from 'next/link';
import { toast } from 'sonner';

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

export default function SABillingPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [builderInstitute, setBuilderInstitute] = useState<{ id: string; name: string } | null>(null);

  const { data: revenue } = useApi<RevenueDashboard>(() => getRevenueDashboard(), []);
  const { data: institutes } = useApi(() => listInstitutes({ per_page: 100 }), []);

  const params: Record<string, any> = { page, per_page: 15 };
  if (statusFilter) params.status = statusFilter;
  const { data: invoicesData, refetch: refetchInvoices } = useApi(() => listInvoices(params), [page, statusFilter]);

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
          <SAKpiCard
            label="Free Trial"
            value={formatPKR(revenue.revenueByPlan.free || 0)}
            icon={Receipt}
            color="bg-zinc-500"
          />
          <SAKpiCard
            label="Paid Plans"
            value={formatPKR(
              // Sum every non-trial tier present in the response so
              // professional/custom/unlimited revenue isn't dropped.
              Object.entries(revenue.revenueByPlan)
                .filter(([tier]) => tier !== 'free')
                .reduce((acc, [, amount]) => acc + (amount || 0), 0)
            )}
            icon={TrendingUp}
            color="bg-purple-500"
          />
        </div>
      )}

      {/* Revenue Trend */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-200">
          <h2 className="font-semibold text-zinc-900 mb-4">Monthly Revenue Trend</h2>
          <SABarChart data={trendData} color={SA_COLORS.primary} height={250} />
        </div>
      )}

      {/* Institutes — Generate Invoice */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Generate Invoice</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Select an institute to create a new invoice</p>
        </div>
        <div className="divide-y divide-zinc-50">
          {(institutes?.data || []).map((inst: InstituteOut) => (
            <div key={inst.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50/50">
              <div>
                <span className="text-sm font-medium text-zinc-900">{inst.name}</span>
                <span className="ml-2 text-xs text-zinc-400">{inst.slug}</span>
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  inst.status === 'active' ? 'bg-green-100 text-green-700' :
                  inst.status === 'suspended' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{inst.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBuilderInstitute({ id: inst.id, name: inst.name })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1A1A1A] text-white rounded-lg hover:bg-zinc-800"
                >
                  <FileText size={13} /> New Invoice
                </button>
                <Link
                  href={`/sa/billing/${inst.id}`}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100"
                >
                  History <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          ))}
          {(!institutes?.data || institutes.data.length === 0) && (
            <div className="px-5 py-8 text-center text-zinc-400 text-sm">No institutes found</div>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">All Invoices</h2>
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
                <th className="px-5 py-3 font-medium text-zinc-500 w-20"></th>
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
                  <td className="px-5 py-3">
                    <button
                      onClick={async () => {
                        try {
                          await downloadInvoicePDF(inv.id);
                        } catch { toast.error('Download failed'); }
                      }}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"
                      title="Download PDF"
                    >
                      <Download size={14} />
                    </button>
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

      {/* Invoice Builder Modal */}
      {builderInstitute && (
        <SAInvoiceBuilder
          instituteId={builderInstitute.id}
          instituteName={builderInstitute.name}
          onClose={() => setBuilderInstitute(null)}
          onGenerated={() => refetchInvoices()}
        />
      )}
    </div>
  );
}

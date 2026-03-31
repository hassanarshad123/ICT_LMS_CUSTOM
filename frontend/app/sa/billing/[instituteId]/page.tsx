'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, FileText, Download } from 'lucide-react';
import { SAInvoiceBuilder } from '@/components/pages/sa/sa-invoice-builder';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getBillingConfig, updateBillingConfig,
  listInvoices, recordPayment, listPayments, downloadInvoicePDF,
  type BillingConfig, type InvoiceItem, type PaymentItem,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';
import Link from 'next/link';

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

export default function InstituteBillingPage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const [showPayment, setShowPayment] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  const { data: billing, refetch: refetchBilling } = useApi<BillingConfig>(
    () => getBillingConfig(instituteId), [instituteId]
  );
  const { data: invoices, refetch: refetchInv } = useApi(
    () => listInvoices({ institute_id: instituteId, per_page: 50 }), [instituteId]
  );
  const { data: payments, refetch: refetchPay } = useApi(
    () => listPayments({ institute_id: instituteId, per_page: 50 }), [instituteId]
  );

  // Billing config form
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<BillingConfig>>({});
  const { execute: doUpdate } = useMutation(
    (data: Partial<BillingConfig>) => updateBillingConfig(instituteId, data)
  );

  const handleSaveConfig = async () => {
    try {
      await doUpdate(form);
      toast.success('Billing config updated');
      setEditMode(false);
      refetchBilling();
    } catch { toast.error('Failed to update'); }
  };

  // Payment form
  const [payForm, setPayForm] = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' });
  const { execute: doRecord } = useMutation(
    (data: any) => recordPayment(data)
  );

  const handleRecordPayment = async () => {
    try {
      await doRecord({
        instituteId,
        amount: parseInt(payForm.amount),
        paymentDate: new Date().toISOString(),
        paymentMethod: payForm.method,
        referenceNumber: payForm.reference || undefined,
        notes: payForm.notes || undefined,
      });
      toast.success('Payment recorded');
      setShowPayment(false);
      setPayForm({ amount: '', method: 'bank_transfer', reference: '', notes: '' });
      refetchPay();
    } catch { toast.error('Failed to record payment'); }
  };

  if (!billing) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sa/billing" className="p-2 hover:bg-zinc-100 rounded-lg"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{billing.instituteName}</h1>
          <p className="text-zinc-500 text-sm">Billing configuration & payment history</p>
        </div>
      </div>

      {/* Billing Config */}
      <div className="bg-white rounded-2xl p-5 border border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-zinc-900">Billing Configuration</h2>
          {!editMode ? (
            <button onClick={() => { setEditMode(true); setForm(billing); }} className="text-xs px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg">Cancel</button>
              <button onClick={handleSaveConfig} className="text-xs px-3 py-1.5 bg-[#1A1A1A] text-white rounded-lg">Save</button>
            </div>
          )}
        </div>
        {!editMode ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><span className="text-zinc-500 block text-xs">Base Amount</span><span className="font-medium">{formatPKR(billing.baseAmount)}</span></div>
            <div><span className="text-zinc-500 block text-xs">Billing Cycle</span><span className="font-medium capitalize">{billing.billingCycle}</span></div>
            <div><span className="text-zinc-500 block text-xs">Currency</span><span className="font-medium">{billing.currency}</span></div>
            <div><span className="text-zinc-500 block text-xs">Extra User Rate</span><span className="font-medium">{formatPKR(billing.extraUserRate)}/user</span></div>
            <div><span className="text-zinc-500 block text-xs">Extra Storage Rate</span><span className="font-medium">{formatPKR(billing.extraStorageRate)}/GB</span></div>
            <div><span className="text-zinc-500 block text-xs">Extra Video Rate</span><span className="font-medium">{formatPKR(billing.extraVideoRate)}/GB</span></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="text-xs text-zinc-500 block mb-1">Base Amount (PKR)</label><input type="number" value={form.baseAmount || ''} onChange={(e) => setForm({ ...form, baseAmount: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-zinc-500 block mb-1">Billing Cycle</label><select value={form.billingCycle || ''} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></div>
            <div><label className="text-xs text-zinc-500 block mb-1">Extra User Rate (PKR)</label><input type="number" value={form.extraUserRate || ''} onChange={(e) => setForm({ ...form, extraUserRate: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-zinc-500 block mb-1">Extra Storage Rate (PKR/GB)</label><input type="number" value={form.extraStorageRate || ''} onChange={(e) => setForm({ ...form, extraStorageRate: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-zinc-500 block mb-1">Extra Video Rate (PKR/GB)</label><input type="number" value={form.extraVideoRate || ''} onChange={(e) => setForm({ ...form, extraVideoRate: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" /></div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button onClick={() => setShowPayment(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#1A1A1A] text-white rounded-xl">
          <Plus size={16} /> Record Payment
        </button>
        <button onClick={() => setShowBuilder(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50">
          <FileText size={16} /> Generate Invoice
        </button>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100"><h2 className="font-semibold text-zinc-900">Invoices</h2></div>
        <div className="divide-y divide-zinc-50">
          {(invoices?.data || []).map((inv: InvoiceItem) => (
            <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-zinc-900">{inv.invoiceNumber}</span>
                <span className="ml-3 font-medium">{formatPKR(inv.totalAmount)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">{inv.periodStart} to {inv.periodEnd}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                  inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                  'bg-zinc-100 text-zinc-600'
                }`}>{inv.status}</span>
                <button
                  onClick={async () => {
                    try {
                      await downloadInvoicePDF(inv.id);
                    } catch { toast.error('Download failed'); }
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-700"
                  title="Download PDF"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          ))}
          {(!invoices?.data || invoices.data.length === 0) && (
            <div className="px-5 py-6 text-center text-zinc-400 text-sm">No invoices</div>
          )}
        </div>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100"><h2 className="font-semibold text-zinc-900">Payment History</h2></div>
        <div className="divide-y divide-zinc-50">
          {(payments?.data || []).map((p: PaymentItem) => (
            <div key={p.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-zinc-900">{formatPKR(p.amount)}</span>
                <span className="ml-3 text-xs text-zinc-500 capitalize">{p.paymentMethod?.replace('_', ' ')}</span>
                {p.referenceNumber && <span className="ml-2 text-xs text-zinc-400">Ref: {p.referenceNumber}</span>}
              </div>
              <span className="text-xs text-zinc-500">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}</span>
            </div>
          ))}
          {(!payments?.data || payments.data.length === 0) && (
            <div className="px-5 py-6 text-center text-zinc-400 text-sm">No payments recorded</div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="font-semibold text-zinc-900">Record Payment</h3>
            <input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Amount (PKR)" className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" />
            <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
            <input type="text" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Reference # (optional)" className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" />
            <input type="text" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Notes (optional)" className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPayment(false)} className="px-4 py-2 text-xs rounded-lg border border-zinc-200">Cancel</button>
              <button onClick={handleRecordPayment} disabled={!payForm.amount} className="px-4 py-2 text-xs rounded-lg bg-[#1A1A1A] text-white disabled:opacity-40">Record</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Builder */}
      {showBuilder && (
        <SAInvoiceBuilder
          instituteId={instituteId}
          instituteName={billing.instituteName}
          onClose={() => setShowBuilder(false)}
          onGenerated={() => refetchInv()}
        />
      )}
    </div>
  );
}

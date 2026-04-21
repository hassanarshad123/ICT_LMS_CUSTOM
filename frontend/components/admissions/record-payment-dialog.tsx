'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { useMutation } from '@/hooks/use-api';
import {
  recordPayment,
  type FeePlanDetail,
  type InstallmentRow,
  type PaymentMethod,
} from '@/lib/api/admissions';
import { formatMoney, formatDate } from '@/lib/utils/format';
import PaymentProofUploader from '@/components/admissions/payment-proof-uploader';

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string;
  plan: FeePlanDetail;
  onSuccess: () => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'EasyPaisa' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
];

function nextOpenInstallment(plan: FeePlanDetail): InstallmentRow | null {
  return (
    plan.installments.find(
      (i) => i.status === 'pending' || i.status === 'partially_paid' || i.status === 'overdue',
    ) || null
  );
}

function isoNow(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 16);
}

export default function RecordPaymentDialog({ open, onClose, studentId, plan, onSuccess }: Props) {
  const suggested = useMemo(() => nextOpenInstallment(plan), [plan]);
  const [installmentId, setInstallmentId] = useState<string>(suggested?.id || '');
  const [amount, setAmount] = useState<string>(
    suggested ? String(Math.max(suggested.amountDue - suggested.amountPaid, 0)) : '',
  );
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(isoNow());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<{
    objectKey: string;
    viewUrl: string;
    fileName: string;
    fileType: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = nextOpenInstallment(plan);
    setInstallmentId(next?.id || '');
    setAmount(next ? String(Math.max(next.amountDue - next.amountPaid, 0)) : '');
    setMethod('cash');
    setPaymentDate(isoNow());
    setReference('');
    setNotes('');
    setProof(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan.id]);

  const { execute, loading } = useMutation(recordPayment);

  if (!open) return null;

  const selectedInstallment = plan.installments.find((i) => i.id === installmentId);
  const remaining = selectedInstallment
    ? Math.max(selectedInstallment.amountDue - selectedInstallment.amountPaid, 0)
    : 0;
  const amountNum = Number(amount) || 0;
  const amountValid = amountNum > 0 && amountNum <= remaining;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installmentId) {
      toast.error('Pick an installment');
      return;
    }
    if (!amountValid) {
      toast.error(`Enter an amount between 1 and ${remaining}`);
      return;
    }

    try {
      const paid = await execute(
        studentId,
        {
          feeInstallmentId: installmentId,
          amount: amountNum,
          paymentDate: new Date(paymentDate).toISOString(),
          paymentMethod: method,
          referenceNumber: reference.trim() || null,
          notes: notes.trim() || null,
          paymentProofObjectKey: proof?.objectKey ?? null,
        },
        plan.id,
      );
      toast.success(
        paid.receiptNumber ? `Payment recorded · ${paid.receiptNumber}` : 'Payment recorded',
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record payment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 flex-none">
          <div className="min-w-0">
            <h2 className="font-semibold text-primary truncate">Record payment</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {plan.batchName} · {formatMoney(plan.balanceDue, plan.currency)} outstanding
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          id="record-payment-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Installment</label>
            <select
              value={installmentId}
              onChange={(e) => {
                const id = e.target.value;
                setInstallmentId(id);
                const inst = plan.installments.find((i) => i.id === id);
                if (inst) setAmount(String(Math.max(inst.amountDue - inst.amountPaid, 0)));
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              required
            >
              <option value="">Select an installment…</option>
              {plan.installments.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.sequence} · {i.label || 'Installment'} · due {formatDate(i.dueDate)} ·{' '}
                  {formatMoney(Math.max(i.amountDue - i.amountPaid, 0))} open
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 5000"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              />
              {selectedInstallment && (
                <p className="text-xs text-gray-500 mt-1">
                  Max for this installment: {formatMoney(remaining)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Received on</label>
              <input
                type="datetime-local"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Reference # (optional)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="TXN-12345"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              placeholder="Any context for the payment"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment receipt screenshot (optional)
            </label>
            <PaymentProofUploader
              feePlanId={plan.id}
              value={proof}
              onChange={setProof}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Attach the bank / app receipt the student sent you. The image is
              stored privately and linked to the Sales Invoice in ERP.
            </p>
          </div>
        </form>

        {/* Sticky footer — always reachable */}
        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-gray-100 bg-white flex-none">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="record-payment-form"
            disabled={loading || !amountValid}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/80 disabled:opacity-40"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

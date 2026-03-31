'use client';

import { useState } from 'react';
import { X, Plus, Trash2, FileText, ChevronRight, ChevronLeft } from 'lucide-react';
import { useMutation } from '@/hooks/use-api';
import { previewInvoice, generateInvoiceEnhanced, type InvoicePreview } from '@/lib/api/super-admin';
import { toast } from 'sonner';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface Props {
  instituteId: string;
  instituteName: string;
  onClose: () => void;
  onGenerated: () => void;
}

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

type Step = 'period' | 'items' | 'discount' | 'preview';

export function SAInvoiceBuilder({ instituteId, instituteName, onClose, onGenerated }: Props) {
  const [step, setStep] = useState<Step>('period');

  // Period
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [previewData, setPreviewData] = useState<InvoicePreview | null>(null);

  // Discount
  const [discountType, setDiscountType] = useState<'percentage' | 'flat' | ''>('');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const { execute: doPreview, loading: previewing } = useMutation(
    (data: any) => previewInvoice(data)
  );
  const { execute: doGenerate, loading: generating } = useMutation(
    (data: any) => generateInvoiceEnhanced(data)
  );

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = discountType === 'percentage'
    ? Math.round(subtotal * discountValue / 100)
    : discountType === 'flat' ? Math.min(discountValue, subtotal) : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const handlePreviewFetch = async () => {
    if (!periodStart || !periodEnd) return;
    try {
      const data = await doPreview({ instituteId, periodStart, periodEnd });
      setPreviewData(data);
      setLineItems(data.lineItems.map((li: any) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unitPrice,
        amount: li.amount,
      })));
      setStep('items');
    } catch {
      toast.error('Failed to load preview data');
    }
  };

  const addItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const removeItem = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated.amount = Math.round(Number(updated.quantity) * Number(updated.unit_price));
      }
      return updated;
    }));
  };

  const handleGenerate = async () => {
    try {
      await doGenerate({
        instituteId,
        periodStart,
        periodEnd,
        dueDate,
        customLineItems: lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          amount: li.amount,
        })),
        discountType: discountType || undefined,
        discountValue: discountValue || undefined,
        notes: notes || undefined,
      });
      toast.success('Invoice generated with PDF');
      onGenerated();
      onClose();
    } catch {
      toast.error('Failed to generate invoice');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <div>
            <h2 className="font-semibold text-zinc-900">Generate Invoice</h2>
            <p className="text-xs text-zinc-500">{instituteName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 pt-4">
          {(['period', 'items', 'discount', 'preview'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s ? 'bg-[#1A1A1A] text-white' :
                (['period', 'items', 'discount', 'preview'].indexOf(step) > i) ? 'bg-[#C5D86D] text-[#1A1A1A]' :
                'bg-zinc-100 text-zinc-400'
              }`}>
                {i + 1}
              </div>
              {i < 3 && <div className="w-6 h-px bg-zinc-200" />}
            </div>
          ))}
          <span className="ml-2 text-xs text-zinc-500 capitalize">{step}</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: Period */}
          {step === 'period' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Period Start</label>
                  <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Period End</label>
                  <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" />
              </div>
              <button
                onClick={handlePreviewFetch}
                disabled={!periodStart || !periodEnd || !dueDate || previewing}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#1A1A1A] text-white rounded-xl disabled:opacity-40 ml-auto"
              >
                {previewing ? 'Loading...' : 'Next'} <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Step 2: Edit Line Items */}
          {step === 'items' && (
            <>
              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text" value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs" placeholder="Description"
                    />
                    <input
                      type="number" value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs text-center" placeholder="Qty"
                    />
                    <input
                      type="number" value={item.unit_price}
                      onChange={(e) => updateItem(idx, 'unit_price', parseInt(e.target.value) || 0)}
                      className="w-24 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs" placeholder="Rate"
                    />
                    <span className="w-24 text-xs text-right font-medium">{formatPKR(item.amount)}</span>
                    <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900">
                <Plus size={14} /> Add Line Item
              </button>
              <div className="text-right text-sm font-medium text-zinc-900 border-t border-zinc-100 pt-3">
                Subtotal: {formatPKR(subtotal)}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep('period')} className="flex items-center gap-1 text-xs text-zinc-500"><ChevronLeft size={14} /> Back</button>
                <button onClick={() => setStep('discount')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#1A1A1A] text-white rounded-xl">
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {/* Step 3: Discount + Notes */}
          {step === 'discount' && (
            <>
              <div>
                <label className="text-xs text-zinc-500 block mb-2">Discount (optional)</label>
                <div className="flex gap-2 mb-3">
                  {(['', 'percentage', 'flat'] as const).map((t) => (
                    <button
                      key={t || 'none'}
                      onClick={() => { setDiscountType(t); if (!t) setDiscountValue(0); }}
                      className={`px-3 py-1.5 text-xs rounded-lg ${discountType === t ? 'bg-[#1A1A1A] text-white' : 'bg-zinc-100 text-zinc-600'}`}
                    >
                      {t === '' ? 'No Discount' : t === 'percentage' ? 'Percentage (%)' : 'Flat Amount (Rs.)'}
                    </button>
                  ))}
                </div>
                {discountType && (
                  <input
                    type="number" value={discountValue || ''}
                    onChange={(e) => setDiscountValue(parseInt(e.target.value) || 0)}
                    className="w-40 px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                    placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 5000'}
                  />
                )}
                {discountAmount > 0 && (
                  <p className="text-xs text-red-500 mt-2">Discount: -{formatPKR(discountAmount)}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Notes / Terms (optional)</label>
                <textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm resize-none" rows={3}
                  placeholder="e.g., Payment due within 15 days. Late fee of 2% per month."
                />
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep('items')} className="flex items-center gap-1 text-xs text-zinc-500"><ChevronLeft size={14} /> Back</button>
                <button onClick={() => setStep('preview')} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#1A1A1A] text-white rounded-xl">
                  Preview <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {/* Step 4: Preview */}
          {step === 'preview' && (
            <>
              <div className="border border-zinc-200 rounded-xl p-5 space-y-4 bg-zinc-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-zinc-500">BILL TO</p>
                    <p className="font-semibold text-zinc-900">{instituteName}</p>
                    <p className="text-xs text-zinc-500">{previewData?.instituteEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Period: {periodStart} to {periodEnd}</p>
                    <p className="text-xs text-zinc-500">Due: {dueDate}</p>
                  </div>
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left">
                      <th className="py-2 text-zinc-500">#</th>
                      <th className="py-2 text-zinc-500">Description</th>
                      <th className="py-2 text-zinc-500 text-right">Qty</th>
                      <th className="py-2 text-zinc-500 text-right">Rate</th>
                      <th className="py-2 text-zinc-500 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-zinc-100">
                        <td className="py-2 text-zinc-400">{idx + 1}</td>
                        <td className="py-2">{item.description}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">{formatPKR(item.unit_price)}</td>
                        <td className="py-2 text-right font-medium">{formatPKR(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-right space-y-1">
                  <p className="text-xs text-zinc-500">Subtotal: {formatPKR(subtotal)}</p>
                  {discountAmount > 0 && (
                    <p className="text-xs text-red-500">
                      {discountType === 'percentage' ? `Discount (${discountValue}%)` : 'Discount'}: -{formatPKR(discountAmount)}
                    </p>
                  )}
                  <p className="text-sm font-bold text-zinc-900">Total: {formatPKR(total)}</p>
                </div>

                {notes && (
                  <div className="text-xs text-zinc-500 border-t border-zinc-200 pt-2">
                    <span className="font-medium text-zinc-700">Notes:</span> {notes}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep('discount')} className="flex items-center gap-1 text-xs text-zinc-500"><ChevronLeft size={14} /> Back</button>
                <button
                  onClick={handleGenerate}
                  disabled={generating || lineItems.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#C5D86D] text-[#1A1A1A] rounded-xl disabled:opacity-40"
                >
                  <FileText size={16} /> {generating ? 'Generating PDF...' : 'Generate Invoice PDF'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

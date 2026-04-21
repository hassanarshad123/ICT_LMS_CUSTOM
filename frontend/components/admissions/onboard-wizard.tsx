'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import { useBasePath } from '@/hooks/use-base-path';
import { listBatches } from '@/lib/api/batches';
import {
  getMyQuota,
  listAdmissionsStudents,
  onboardStudent,
  type FeePlanType,
  type InstallmentDraft,
  type OnboardStudentPayload,
  type OnboardStudentResult,
} from '@/lib/api/admissions';
import {
  getFrappePaymentTermsTemplate,
  listFrappeItems,
  listFrappePaymentTermsTemplates,
  type PaymentTermsTemplateDetail,
} from '@/lib/api/integrations';
import { formatMoney, formatDate } from '@/lib/utils/format';
import { DatePopover } from '@/components/ui/date-popover';
import BatchPicker from '@/components/admissions/batch-picker';
import PaymentProofUploader from '@/components/admissions/payment-proof-uploader';
import QuotaBanner from '@/components/admissions/quota-banner';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4 | 5;

type PlanTypeLocal = FeePlanType;

interface StudentForm {
  name: string;
  email: string;
  phone: string;
}

interface FeeForm {
  planType: PlanTypeLocal;
  totalAmount: string;
  discountType: 'none' | 'percent' | 'flat';
  discountValue: string;
  monthlyInstallments: string;
  firstDueDate: string;
  installments: InstallmentDraft[];
  notes: string;
}

function defaultFeeForm(): FeeForm {
  return {
    planType: 'one_time',
    totalAmount: '',
    discountType: 'none',
    discountValue: '',
    monthlyInstallments: '3',
    firstDueDate: isoToday(),
    installments: [{ sequence: 1, amountDue: 0, dueDate: isoToday(), label: 'Installment 1' }],
    notes: '',
  };
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function calcFinalAmount(total: number, type: 'none' | 'percent' | 'flat', value: number): number {
  if (type === 'percent') return Math.max(0, total - Math.floor((total * value) / 100));
  if (type === 'flat') return Math.max(0, total - value);
  return total;
}

export default function OnboardWizard() {
  const router = useRouter();
  const basePath = useBasePath();

  const [step, setStep] = useState<Step>(1);
  const [student, setStudent] = useState<StudentForm>({ name: '', email: '', phone: '' });
  const [batchId, setBatchId] = useState<string>('');
  const [fee, setFee] = useState<FeeForm>(defaultFeeForm());
  const [result, setResult] = useState<OnboardStudentResult | null>(null);

  // Frappe Item + Payment Terms Template pickers
  const [frappeItemCode, setFrappeItemCode] = useState<string | null>(null);
  const [frappePaymentTermsTemplate, setFrappePaymentTermsTemplate] = useState<string | null>(null);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [pttPickerOpen, setPttPickerOpen] = useState(false);
  const [pttDetail, setPttDetail] = useState<PaymentTermsTemplateDetail | null>(null);
  const [pttDetailLoading, setPttDetailLoading] = useState(false);

  // Payment proof + initial payment
  const [paymentProof, setPaymentProof] = useState<{
    objectKey: string;
    viewUrl: string;
    fileName: string;
    fileType: string;
  } | null>(null);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number>(0);

  // Client-side placeholder feePlanId used only for the S3 key namespace.
  // The real FeePlan UUID is assigned server-side on submit.
  const [clientFeePlanId] = useState(() => crypto.randomUUID());

  const { data: batchesData, loading: batchesLoading } = useApi(
    () => listBatches({ per_page: 100 }),
    [],
  );
  const batches = batchesData?.data || [];

  const { data: quotaData, loading: quotaLoading } = useApi(() => getMyQuota(), []);

  const { data: rosterData } = useApi(
    () => listAdmissionsStudents({ per_page: 100 }),
    [],
  );

  const { data: itemsData } = useApi(() => listFrappeItems(), []);
  const { data: pttData } = useApi(() => listFrappePaymentTermsTemplates(), []);

  // When AO picks a template, fetch its detail for the schedule preview.
  useEffect(() => {
    if (!frappePaymentTermsTemplate) {
      setPttDetail(null);
      return;
    }
    setPttDetailLoading(true);
    getFrappePaymentTermsTemplate(frappePaymentTermsTemplate)
      .then(setPttDetail)
      .catch(() => setPttDetail(null))
      .finally(() => setPttDetailLoading(false));
  }, [frappePaymentTermsTemplate]);

  const recentBatchIds = useMemo(() => {
    const rows = rosterData?.data || [];
    const sorted = [...rows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const out: string[] = [];
    const seen = new Set<string>();
    for (const r of sorted) {
      if (!seen.has(r.batchId)) {
        seen.add(r.batchId);
        out.push(r.batchId);
      }
      if (out.length >= 5) break;
    }
    return out;
  }, [rosterData]);

  const { execute: submit, loading: submitting } = useMutation(onboardStudent);

  const totalNum = Number(fee.totalAmount) || 0;
  const discountNum = fee.discountType === 'none' ? 0 : Number(fee.discountValue) || 0;
  const finalAmount = useMemo(
    () => calcFinalAmount(totalNum, fee.discountType, discountNum),
    [totalNum, fee.discountType, discountNum],
  );
  const installmentSum = fee.installments.reduce((s, i) => s + (Number(i.amountDue) || 0), 0);

  // Auto-sync the installment schedule when a PTT is selected.
  // The template drives everything: plan_type becomes "installment" and each
  // term's invoice_portion × final_amount becomes one installment, with
  // credit_days (+ credit_months) as the due-date offset from today.
  // Recomputes whenever the PTT, total, or discount changes.
  useEffect(() => {
    if (!pttDetail || pttDetail.terms.length === 0) return;
    if (finalAmount <= 0) return;

    const baseDate = fee.firstDueDate || isoToday();
    const base = new Date(baseDate + 'T00:00:00');
    const terms = pttDetail.terms;

    // Compute shares by exact percentage; absorb rounding remainder on last row.
    const shares = terms.map((t) => Math.floor((finalAmount * t.invoicePortion) / 100));
    const remainder = finalAmount - shares.reduce((s, v) => s + v, 0);
    if (shares.length > 0) shares[shares.length - 1] += remainder;

    const generated: InstallmentDraft[] = terms.map((t, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + (t.creditDays || 0));
      if (t.creditMonths) d.setMonth(d.getMonth() + t.creditMonths);
      return {
        sequence: i + 1,
        amountDue: shares[i],
        dueDate: d.toISOString().slice(0, 10),
        label: t.paymentTerm || `Installment ${i + 1}`,
      };
    });

    setFee((prev) => ({
      ...prev,
      planType: 'installment',
      installments: generated,
    }));

    // Auto-fill the "initial payment received" amount with the first
    // installment's value — the AO typically collects that upfront and
    // uploads the screenshot for it. First share is floor(total * pct / 100)
    // which is unaffected by the last-row rounding remainder.
    const firstInstallment =
      Math.floor((finalAmount * (terms[0]?.invoicePortion ?? 0)) / 100);
    setInitialPaymentAmount(firstInstallment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pttDetail, finalAmount, fee.firstDueDate]);

  // Flag the wizard uses to skip the manual installment editor step.
  const scheduleFromPtt = !!(pttDetail && pttDetail.terms.length > 0);

  const canAdvanceStep1 =
    student.name.trim().length > 1 &&
    /.+@.+\..+/.test(student.email) &&
    student.phone.trim().length >= 7;
  const canAdvanceStep2 = batchId.length > 0;
  const canAdvanceStep3 = totalNum > 0 && finalAmount > 0;
  const canAdvanceStep4 =
    fee.planType !== 'installment' ||
    (fee.installments.length > 0 && installmentSum === finalAmount);

  const handleSubmit = async () => {
    try {
      const payload: OnboardStudentPayload = {
        name: student.name.trim(),
        email: student.email.trim().toLowerCase(),
        phone: student.phone.trim(),
        batchId,
        notes: fee.notes.trim() || undefined,
        feePlan: {
          planType: fee.planType,
          totalAmount: totalNum,
          discountType: fee.discountType === 'none' ? null : fee.discountType,
          discountValue: fee.discountType === 'none' ? null : discountNum,
          currency: 'PKR',
          monthlyInstallments: fee.planType === 'monthly' ? Number(fee.monthlyInstallments) || 1 : null,
          firstDueDate: fee.firstDueDate || null,
          installments: fee.planType === 'installment' ? fee.installments : undefined,
          notes: fee.notes.trim() || null,
          frappeItemCode: frappeItemCode || undefined,
          frappePaymentTermsTemplate: frappePaymentTermsTemplate || undefined,
        },
        paymentProofObjectKey: paymentProof?.objectKey || undefined,
        initialPaymentAmount: initialPaymentAmount || undefined,
      };
      const res = await submit(payload);
      setResult(res);
      setStep(5);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to onboard student');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator step={step} />

      {step === 1 && (
        <>
          <QuotaBanner data={quotaData} loading={quotaLoading} />
          <StepCard title="Student details" subtitle="Who is the paying student?">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name" value={student.name} onChange={(v) => setStudent({ ...student, name: v })} placeholder="e.g. Ali Khan" />
              <Field label="Email" value={student.email} onChange={(v) => setStudent({ ...student, email: v })} placeholder="student@email.com" type="email" />
              <Field label="Phone" value={student.phone} onChange={(v) => setStudent({ ...student, phone: v })} placeholder="0300-1234567" />
            </div>
            <WizardNav
              onBack={() => router.push(basePath)}
              backLabel="Cancel"
              onNext={() => setStep(2)}
              nextDisabled={!canAdvanceStep1 || (!!quotaData && quotaData.slotsLeft === 0)}
            />
          </StepCard>
        </>
      )}

      {step === 2 && (
        <StepCard title="Pick a batch" subtitle="Select the batch to enroll this student in">
          <BatchPicker
            batches={batches}
            selectedId={batchId}
            onSelect={setBatchId}
            recentBatchIds={recentBatchIds}
            loading={batchesLoading}
          />
          <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!canAdvanceStep2} />
        </StepCard>
      )}

      {step === 3 && (
        <StepCard title="Fee plan" subtitle="Set the total amount and how the student will pay">
          <div className="space-y-4">
            {/* Frappe Item picker (or free-text fallback) */}
            {itemsData?.enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Course / Service Item (Frappe)
                </label>
                <Popover open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="truncate">
                        {frappeItemCode
                          ? (itemsData?.items.find((i) => i.itemCode === frappeItemCode)?.itemName ?? frappeItemCode)
                          : 'Pick a course…'}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 flex-none ml-2" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search items…" />
                      <CommandList>
                        <CommandEmpty>No items found.</CommandEmpty>
                        <CommandGroup>
                          {(itemsData?.items ?? []).map((it) => (
                            <CommandItem
                              key={it.itemCode}
                              value={`${it.itemName} ${it.itemCode}`}
                              onSelect={() => {
                                setFrappeItemCode(it.itemCode);
                                setItemPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  frappeItemCode === it.itemCode ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{it.itemName}</div>
                                <div className="text-xs text-gray-500 truncate">{it.itemCode}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {itemsData && !itemsData.enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Course Code (optional)
                </label>
                <input
                  type="text"
                  value={frappeItemCode ?? ''}
                  onChange={(e) => setFrappeItemCode(e.target.value || null)}
                  placeholder="Leave blank if Frappe is not connected"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {(['one_time', 'monthly', 'installment'] as PlanTypeLocal[]).map((pt) => (
                <button
                  key={pt}
                  onClick={() => setFee({ ...fee, planType: pt })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    fee.planType === pt ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <p className="font-semibold text-primary text-sm">{planTypeLabel(pt)}</p>
                  <p className="text-xs text-gray-500 mt-1">{planTypeHint(pt)}</p>
                </button>
              ))}
            </div>

            {/* Payment Terms Template picker — augments the plan-type selector.
                One-time fee still bypasses the template. */}
            {pttData?.enabled && fee.planType !== 'one_time' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Payment Terms Template (Frappe)
                </label>
                <Popover open={pttPickerOpen} onOpenChange={setPttPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="truncate">
                        {frappePaymentTermsTemplate
                          ? (pttData?.templates.find((t) => t.name === frappePaymentTermsTemplate)?.templateName ?? frappePaymentTermsTemplate)
                          : 'Pick a template…'}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 flex-none ml-2" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search templates…" />
                      <CommandList>
                        <CommandEmpty>No templates found.</CommandEmpty>
                        <CommandGroup>
                          {frappePaymentTermsTemplate && (
                            <CommandItem
                              key="__clear"
                              value="clear selection"
                              onSelect={() => {
                                setFrappePaymentTermsTemplate(null);
                                setPttPickerOpen(false);
                              }}
                            >
                              <span className="text-xs text-gray-500">Clear selection</span>
                            </CommandItem>
                          )}
                          {(pttData?.templates ?? []).map((tpl) => (
                            <CommandItem
                              key={tpl.name}
                              value={`${tpl.templateName} ${tpl.name}`}
                              onSelect={() => {
                                setFrappePaymentTermsTemplate(tpl.name);
                                setPttPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  frappePaymentTermsTemplate === tpl.name ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{tpl.templateName}</div>
                                <div className="text-xs text-gray-500 truncate">{tpl.name}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {pttDetailLoading && (
                  <p className="text-xs text-gray-500 mt-1.5 inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading schedule…
                  </p>
                )}
              </div>
            )}

            {pttDetail && pttDetail.terms.length > 0 && fee.planType !== 'one_time' && (
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-600 mb-2">Schedule preview</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1">Installment</th>
                      <th className="py-1 text-right">Share</th>
                      <th className="py-1 text-right">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pttDetail.terms.map((t, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="py-1">{t.paymentTerm}</td>
                        <td className="py-1 text-right font-medium">{t.invoicePortion}%</td>
                        <td className="py-1 text-right">{t.creditDays + (t.creditMonths || 0) * 30}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Total fee (PKR)"
                value={fee.totalAmount}
                onChange={(v) => setFee({ ...fee, totalAmount: v.replace(/[^0-9]/g, '') })}
                placeholder="15000"
                type="text"
                inputMode="numeric"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount</label>
                <div className="flex gap-2">
                  <select
                    className="px-3 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
                    value={fee.discountType}
                    onChange={(e) => setFee({ ...fee, discountType: e.target.value as any })}
                  >
                    <option value="none">None</option>
                    <option value="percent">Percent %</option>
                    <option value="flat">Flat PKR</option>
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={fee.discountType === 'none'}
                    value={fee.discountValue}
                    onChange={(e) => setFee({ ...fee, discountValue: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder={fee.discountType === 'percent' ? '10' : '500'}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {fee.planType === 'monthly' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Number of months"
                  value={fee.monthlyInstallments}
                  onChange={(v) => setFee({ ...fee, monthlyInstallments: v.replace(/[^0-9]/g, '') })}
                  placeholder="3"
                  type="text"
                  inputMode="numeric"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">First due date</label>
                  <DatePopover
                    value={fee.firstDueDate}
                    onChange={(v) => setFee({ ...fee, firstDueDate: v })}
                    placeholder="Pick a date"
                  />
                </div>
              </div>
            )}

            {fee.planType === 'one_time' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment due date</label>
                <DatePopover
                  value={fee.firstDueDate}
                  onChange={(v) => setFee({ ...fee, firstDueDate: v })}
                  placeholder="Pick a date"
                />
              </div>
            )}

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-sm text-gray-600">After discount:</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{formatMoney(finalAmount)}</p>
            </div>
          </div>

          <WizardNav
            onBack={() => setStep(2)}
            onNext={() => setStep(fee.planType === 'installment' && !scheduleFromPtt ? 4 : 5)}
            nextDisabled={!canAdvanceStep3}
            nextLabel={fee.planType === 'installment' && !scheduleFromPtt ? 'Next' : 'Review'}
          />
        </StepCard>
      )}

      {step === 4 && !scheduleFromPtt && (
        <StepCard title="Installment schedule" subtitle={`Split ${formatMoney(finalAmount)} across installments`}>
          <InstallmentEditor
            installments={fee.installments}
            onChange={(installments) => setFee({ ...fee, installments })}
            finalAmount={finalAmount}
          />
          <div className="flex items-center justify-between mt-4 p-3 rounded-xl bg-gray-50">
            <span className="text-sm text-gray-600">Schedule total</span>
            <span
              className={`font-semibold ${
                installmentSum === finalAmount ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {formatMoney(installmentSum)}
              {installmentSum !== finalAmount && ` (needs ${formatMoney(finalAmount - installmentSum)})`}
            </span>
          </div>
          <WizardNav
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
            nextDisabled={!canAdvanceStep4}
            nextLabel="Review"
          />
        </StepCard>
      )}

      {step === 5 && !result && (
        <StepCard title="Review & submit" subtitle="Confirm details — account credentials will be generated">
          <div className="space-y-3 text-sm">
            <Row label="Student" value={`${student.name} · ${student.email}`} />
            <Row label="Phone" value={student.phone} />
            <Row label="Batch" value={batches.find((b) => b.id === batchId)?.name || '—'} />
            <Row label="Plan" value={planTypeLabel(fee.planType)} />
            <Row label="Total fee" value={formatMoney(totalNum)} />
            {fee.discountType !== 'none' && (
              <Row
                label="Discount"
                value={`${discountNum}${fee.discountType === 'percent' ? '%' : ' PKR'}`}
              />
            )}
            <Row label="Final amount" value={formatMoney(finalAmount)} emphasize />
            {fee.planType === 'monthly' && (
              <Row
                label="Schedule"
                value={`${fee.monthlyInstallments} months from ${formatDate(fee.firstDueDate)}`}
              />
            )}
            {fee.planType === 'installment' && (
              <Row label="Installments" value={`${fee.installments.length} scheduled`} />
            )}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              value={fee.notes}
              onChange={(e) => setFee({ ...fee, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              placeholder="Anything worth remembering about this deal?"
            />
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Initial payment received (PKR)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={initialPaymentAmount}
                onChange={(e) =>
                  setInitialPaymentAmount(Math.max(0, Number(e.target.value || 0)))
                }
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                {scheduleFromPtt && pttDetail && pttDetail.terms.length > 0 ? (
                  <>
                    Pre-filled from the first installment of{' '}
                    <span className="font-medium">{pttDetail.templateName}</span>
                    {' '}({pttDetail.terms[0].invoicePortion}% of {formatMoney(finalAmount)}).
                    Edit if the student paid a different amount.
                  </>
                ) : (
                  'Leave 0 if no payment has been collected yet.'
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Payment proof screenshot (optional)
              </label>
              <PaymentProofUploader
                feePlanId={clientFeePlanId}
                value={paymentProof}
                onChange={setPaymentProof}
              />
            </div>
          </div>

          <WizardNav
            onBack={() => setStep((fee.planType === 'installment' && !scheduleFromPtt ? 4 : 3) as Step)}
            onNext={handleSubmit}
            nextDisabled={submitting}
            nextLabel={submitting ? 'Creating account…' : 'Onboard Student'}
            loading={submitting}
          />
        </StepCard>
      )}

      {step === 5 && result && (
        <SuccessCard result={result} onDone={() => router.push(basePath)} />
      )}
    </div>
  );
}

function planTypeLabel(t: PlanTypeLocal): string {
  if (t === 'one_time') return 'One-time fee';
  if (t === 'monthly') return 'Monthly recurring';
  return 'Custom installments';
}

function planTypeHint(t: PlanTypeLocal): string {
  if (t === 'one_time') return 'Lump sum upfront';
  if (t === 'monthly') return 'Split into equal monthly payments';
  return 'Flexible schedule set by you';
}

function StepIndicator({ step }: { step: Step }) {
  const labels = ['Student', 'Batch', 'Fee plan', 'Schedule', 'Review'];
  return (
    <div className="flex items-center gap-2 mb-6">
      {labels.map((label, idx) => {
        const n = idx + 1;
        const done = n < step;
        const current = n === step;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                done
                  ? 'bg-emerald-500 text-white'
                  : current
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {done ? <Check size={14} /> : n}
            </div>
            <span className={`text-xs font-medium ${current ? 'text-primary' : 'text-gray-500'}`}>
              {label}
            </span>
            {idx < labels.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 card-shadow">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1 mb-6">{subtitle}</p>}
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
      />
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextDisabled,
  loading,
  backLabel = 'Back',
  nextLabel = 'Next',
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  loading?: boolean;
  backLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
      >
        <ArrowLeft size={16} />
        {backLabel}
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {nextLabel}
        {!loading && <ArrowRight size={16} />}
      </button>
    </div>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={emphasize ? 'font-semibold text-emerald-700' : 'text-primary font-medium'}>
        {value}
      </span>
    </div>
  );
}

function InstallmentEditor({
  installments,
  onChange,
  finalAmount,
}: {
  installments: InstallmentDraft[];
  onChange: (x: InstallmentDraft[]) => void;
  finalAmount: number;
}) {
  const add = () => {
    const last = installments[installments.length - 1];
    const nextSeq = installments.length + 1;
    const nextDate = last ? addMonthsIso(last.dueDate, 1) : isoToday();
    onChange([
      ...installments,
      { sequence: nextSeq, amountDue: 0, dueDate: nextDate, label: `Installment ${nextSeq}` },
    ]);
  };

  const remove = (idx: number) => {
    onChange(
      installments
        .filter((_, i) => i !== idx)
        .map((row, i) => ({ ...row, sequence: i + 1, label: `Installment ${i + 1}` })),
    );
  };

  const update = (idx: number, patch: Partial<InstallmentDraft>) => {
    onChange(installments.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const splitEvenly = () => {
    const n = installments.length || 1;
    const base = Math.floor(finalAmount / n);
    const remainder = finalAmount - base * n;
    onChange(
      installments.map((row, i) => ({ ...row, amountDue: base + (i === 0 ? remainder : 0) })),
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-600">Drafts</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={splitEvenly}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Split evenly
          </button>
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/80"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {installments.map((row, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-1 text-sm font-medium text-gray-500">#{row.sequence}</div>
            <input
              type="text"
              inputMode="numeric"
              value={String(row.amountDue)}
              onChange={(e) => update(idx, { amountDue: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
              placeholder="Amount"
              className="col-span-4 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50"
            />
            <div className="col-span-4">
              <DatePopover
                value={row.dueDate}
                onChange={(v) => update(idx, { dueDate: v })}
                placeholder="Due date"
                className="py-2 px-3 rounded-lg"
              />
            </div>
            <input
              type="text"
              value={row.label || ''}
              onChange={(e) => update(idx, { label: e.target.value })}
              placeholder="Label"
              className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              disabled={installments.length === 1}
              className="col-span-1 p-2 text-gray-400 hover:text-red-500 disabled:opacity-30"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessCard({
  result,
  onDone,
}: {
  result: OnboardStudentResult;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const txt = `Email: ${result.email}\nPassword: ${result.temporaryPassword}`;
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const isExisting = !result.isNewUser;

  return (
    <div className="bg-white rounded-2xl p-8 card-shadow text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-4">
        <Check size={24} className="text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-primary mb-2">
        {isExisting ? 'Enrolled in new batch' : 'Student onboarded'}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {isExisting
          ? 'Existing student added to this batch. Their login and password are unchanged.'
          : 'Account created and enrolled. Share these credentials with the student.'}
      </p>
      <div className="bg-gray-50 rounded-xl p-4 text-left max-w-md mx-auto mb-6">
        <Row label="Email" value={result.email} />
        {!isExisting && <Row label="Password" value={result.temporaryPassword} />}
        <Row label="Amount due" value={formatMoney(result.finalAmount, result.currency)} />
        <Row label="Installments" value={String(result.installmentCount)} />
      </div>
      <div className="flex items-center justify-center gap-3">
        {!isExisting && (
          <button
            onClick={copy}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {copied ? 'Copied!' : 'Copy credentials'}
          </button>
        )}
        <button
          onClick={onDone}
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/80"
        >
          Done
        </button>
      </div>
    </div>
  );
}

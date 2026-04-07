'use client';

import { useState } from 'react';
import { X, Check, Loader2, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  requestUpgrade,
  TIER_DISPLAY,
  formatPKR,
  type UpgradeTier,
  type UpgradeBillingCycle,
  type UpgradePaymentMethod,
  type UpgradeResponse,
  type MyInstituteResponse,
} from '@/lib/api/upgrade';

interface Props {
  institute: MyInstituteResponse;
  onClose: () => void;
}

type Step = 'pick-tier' | 'pick-payment' | 'instructions';

const PAYMENT_OPTIONS: Array<{
  value: UpgradePaymentMethod;
  label: string;
  description: string;
}> = [
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Direct deposit. Verified within 24 hours.',
  },
  {
    value: 'jazzcash',
    label: 'JazzCash',
    description: 'Send from your JazzCash wallet or app.',
  },
  {
    value: 'easypaisa',
    label: 'Easypaisa',
    description: 'Send from your Easypaisa wallet or app.',
  },
];

export function UpgradeModal({ institute, onClose }: Props) {
  const [step, setStep] = useState<Step>('pick-tier');
  const [tier, setTier] = useState<UpgradeTier>('basic');
  const [cycle, setCycle] = useState<UpgradeBillingCycle>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<UpgradePaymentMethod>('bank_transfer');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UpgradeResponse | null>(null);

  const tierInfo = TIER_DISPLAY[tier];
  const amount = cycle === 'yearly' ? tierInfo.yearly : tierInfo.monthly;
  const savings = cycle === 'yearly' ? tierInfo.monthly * 12 - tierInfo.yearly : 0;

  const handleSubmit = async () => {
    if (tier === 'enterprise') {
      window.location.href = 'mailto:hello@zensbot.com?subject=Enterprise%20plan%20inquiry';
      return;
    }
    setSubmitting(true);
    try {
      const res = await requestUpgrade({
        targetTier: tier,
        billingCycle: cycle,
        paymentMethod,
      });
      setResult(res);
      setStep('instructions');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create upgrade request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Copy failed'),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'pick-tier' && 'Choose a plan'}
              {step === 'pick-payment' && 'How will you pay?'}
              {step === 'instructions' && 'Payment instructions'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'pick-tier' && `Currently on ${institute.tierLabel}. All prices in PKR.`}
              {step === 'pick-payment' && `${tierInfo.name} — ${formatPKR(amount)}/${cycle === 'yearly' ? 'year' : 'month'}`}
              {step === 'instructions' && 'Send the amount and share the reference code'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1 — pick tier */}
          {step === 'pick-tier' && (
            <div className="space-y-5">
              {/* Billing cycle toggle */}
              <div className="flex justify-center">
                <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
                  <button
                    onClick={() => setCycle('monthly')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                      cycle === 'monthly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setCycle('yearly')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 ${
                      cycle === 'yearly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    Yearly
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                      2 months free
                    </span>
                  </button>
                </div>
              </div>

              {/* Tier cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['starter', 'basic', 'pro', 'enterprise'] as UpgradeTier[]).map((t) => {
                  const info = TIER_DISPLAY[t];
                  const price = cycle === 'yearly' ? info.yearly : info.monthly;
                  const selected = tier === t;
                  const isEnterprise = t === 'enterprise';
                  return (
                    <button
                      key={t}
                      onClick={() => setTier(t)}
                      className={`text-left rounded-xl p-4 border-2 transition-all ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50/50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-semibold text-gray-900 text-sm">{info.name}</h3>
                        {selected && (
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{info.students}</p>
                      <div className="mb-2">
                        {isEnterprise ? (
                          <span className="text-base font-bold text-gray-900">Custom</span>
                        ) : (
                          <>
                            <span className="text-xl font-bold text-gray-900">{formatPKR(price)}</span>
                            <span className="text-xs text-gray-500">
                              /{cycle === 'yearly' ? 'year' : 'mo'}
                            </span>
                          </>
                        )}
                      </div>
                      <ul className="space-y-1">
                        {info.highlights.slice(0, 3).map((h) => (
                          <li key={h} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                            <Check size={11} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {tier === 'enterprise' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                  Enterprise plans are custom quoted. Click continue to email our team at <strong>hello@zensbot.com</strong>.
                </div>
              )}

              {cycle === 'yearly' && savings > 0 && tier !== 'enterprise' && (
                <div className="text-center text-xs text-emerald-700 font-medium">
                  You save {formatPKR(savings)} per year compared to monthly billing.
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — pick payment */}
          {step === 'pick-payment' && (
            <div className="space-y-3">
              {PAYMENT_OPTIONS.map((opt) => {
                const selected = paymentMethod === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentMethod(opt.value)}
                    className={`w-full text-left rounded-xl p-4 border-2 transition-all ${
                      selected ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{opt.label}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                      </div>
                      {selected && (
                        <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 3 — payment instructions */}
          {step === 'instructions' && result && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check size={16} className="text-emerald-600" />
                  <h3 className="font-semibold text-emerald-900 text-sm">Invoice created</h3>
                </div>
                <p className="text-xs text-emerald-800">
                  Invoice <span className="font-mono font-semibold">{result.invoiceNumber}</span> is ready.
                  Send the payment below and include the reference code so we can match it to your account.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Amount</div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900">{formatPKR(result.amount)}</span>
                    <button
                      onClick={() => handleCopy(String(result.amount), 'Amount')}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Reference Code</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-semibold text-gray-900">
                      {result.referenceCode}
                    </span>
                    <button
                      onClick={() => handleCopy(result.referenceCode, 'Reference code')}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Include this code as your payment reference/memo.
                  </p>
                </div>
              </div>

              {result.paymentInstructions.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Send payment to
                  </h4>
                  {result.paymentInstructions.map((inst, i) => {
                    const entries = Object.entries(inst.details || {}).filter(
                      ([, v]) => typeof v === 'string' && v.trim().length > 0,
                    );
                    return (
                      <div key={i} className={i > 0 ? 'pt-3 border-t border-gray-100' : ''}>
                        {inst.label && (
                          <div className="text-xs font-semibold text-gray-900 mb-2">{inst.label}</div>
                        )}
                        {entries.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">
                            Payment details not filled in yet. Contact support@zensbot.com.
                          </p>
                        ) : (
                          <div className="space-y-1.5 text-sm">
                            {entries.map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-500 capitalize">
                                  {k.replace(/_/g, ' ')}
                                </span>
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="font-medium text-gray-900 truncate">{v as string}</span>
                                  <button
                                    onClick={() => handleCopy(v as string, k.replace(/_/g, ' '))}
                                    className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {result.paymentInstructions.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                  Payment details are not configured yet. Email your screenshot and reference code to{' '}
                  <a
                    href={`mailto:hello@zensbot.com?subject=Payment%20for%20${result.referenceCode}`}
                    className="underline font-semibold"
                  >
                    hello@zensbot.com
                  </a>{' '}
                  to complete the upgrade.
                </div>
              )}

              <p className="text-xs text-gray-600 leading-relaxed">
                {result.paymentReferenceNote}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          {step === 'pick-tier' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (tier === 'enterprise') {
                    window.location.href = 'mailto:hello@zensbot.com?subject=Enterprise%20plan%20inquiry';
                    return;
                  }
                  setStep('pick-payment');
                }}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 flex items-center gap-2"
              >
                {tier === 'enterprise' ? (
                  <>Contact us <ExternalLink size={14} /></>
                ) : (
                  <>Continue</>
                )}
              </button>
            </>
          )}
          {step === 'pick-payment' && (
            <>
              <button
                onClick={() => setStep('pick-tier')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Creating invoice…
                  </>
                ) : (
                  <>Create invoice</>
                )}
              </button>
            </>
          )}
          {step === 'instructions' && (
            <button
              onClick={onClose}
              className="ml-auto px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800"
            >
              I&apos;ll pay now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

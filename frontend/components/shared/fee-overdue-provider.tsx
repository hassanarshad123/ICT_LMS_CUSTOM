'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Wallet, X } from 'lucide-react';
import { formatDate, formatMoney } from '@/lib/utils/format';

interface FeeOverdueDetail {
  code: 'fee_overdue';
  message: string;
  batch_id?: string;
  fee_plan_id?: string;
  overdue_installment_id?: string;
  overdue_since?: string;
  amount_due?: number;
  currency?: string;
}

/**
 * Global listener that renders a soft-lock overlay whenever the API client
 * reports an HTTP 402 with ``code: "fee_overdue"``. The overlay points the
 * student at their My Fees page and the admissions desk.
 */
export default function FeeOverdueProvider() {
  const { userId } = useParams<{ userId?: string }>();
  const [detail, setDetail] = useState<FeeOverdueDetail | null>(null);

  useEffect(() => {
    function handler(evt: Event) {
      const custom = evt as CustomEvent<FeeOverdueDetail>;
      if (custom?.detail?.code === 'fee_overdue') {
        setDetail(custom.detail);
      }
    }
    window.addEventListener('fee-overdue', handler);
    return () => window.removeEventListener('fee-overdue', handler);
  }, []);

  if (!detail) return null;

  const feesHref = userId ? `/${userId}/fees` : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="relative px-6 pt-6 pb-4 bg-red-50 border-b border-red-100">
          <button
            onClick={() => setDetail(null)}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="font-semibold text-red-900">Payment required</h2>
              <p className="text-sm text-red-700 mt-1">
                This content is locked until your outstanding fees are cleared.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3 text-sm">
          {detail.amount_due !== undefined && (
            <Row
              icon={<Wallet size={14} className="text-gray-400" />}
              label="Amount due"
              value={formatMoney(detail.amount_due, detail.currency || 'PKR')}
              emphasize
            />
          )}
          {detail.overdue_since && (
            <Row
              icon={<AlertTriangle size={14} className="text-gray-400" />}
              label="Overdue since"
              value={formatDate(detail.overdue_since)}
            />
          )}
          <p className="text-xs text-gray-500 pt-2">
            Please contact your admissions officer to record a payment. Access is restored
            automatically after your balance is cleared.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={() => setDetail(null)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
          {feesHref && (
            <Link
              href={feesHref}
              onClick={() => setDetail(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/80"
            >
              <Wallet size={14} /> Open My Fees
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  emphasize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-gray-500">
        {icon}
        {label}
      </span>
      <span className={emphasize ? 'font-semibold text-red-700' : 'text-primary font-medium'}>
        {value}
      </span>
    </div>
  );
}

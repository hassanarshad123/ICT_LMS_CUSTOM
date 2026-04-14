'use client';

import { Users } from 'lucide-react';
import type { InstituteQuota } from '@/lib/api/admissions';

interface QuotaBannerProps {
  data?: InstituteQuota | null;
  loading?: boolean;
}

/** Slim header on step 1 showing institute student quota usage. */
export default function QuotaBanner({ data, loading }: QuotaBannerProps) {
  if (loading) {
    return (
      <div className="h-14 rounded-xl bg-gray-100 animate-pulse mb-4" aria-hidden="true" />
    );
  }
  if (!data || data.maxStudents === 0) return null;

  const pct = Math.min(
    100,
    Math.round((data.currentStudents / Math.max(data.maxStudents, 1)) * 100),
  );
  const full = data.slotsLeft === 0;
  const tight = !full && pct >= 80;

  const tone = full
    ? {
        bar: 'bg-red-500',
        track: 'bg-red-100',
        text: 'text-red-700',
        pill: 'bg-red-100 text-red-700',
        icon: 'text-red-500',
      }
    : tight
      ? {
          bar: 'bg-amber-500',
          track: 'bg-amber-100',
          text: 'text-amber-800',
          pill: 'bg-amber-100 text-amber-700',
          icon: 'text-amber-500',
        }
      : {
          bar: 'bg-emerald-500',
          track: 'bg-emerald-100',
          text: 'text-emerald-800',
          pill: 'bg-emerald-100 text-emerald-700',
          icon: 'text-emerald-500',
        };

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 ${tone.icon}`}>
        <Users size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${tone.text}`}>
            {data.currentStudents.toLocaleString('en-PK')} / {data.maxStudents.toLocaleString('en-PK')}{' '}
            students used
          </p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tone.pill}`}>
            {full
              ? 'Quota reached'
              : tight
                ? `${data.slotsLeft.toLocaleString('en-PK')} slots left`
                : `${data.slotsLeft.toLocaleString('en-PK')} slots left`}
          </span>
        </div>
        <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${tone.track}`}>
          <div
            className={`h-full ${tone.bar} transition-all`}
            style={{ width: `${pct}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

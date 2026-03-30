'use client';

import { AlertTriangle } from 'lucide-react';

interface AccessExpiredBannerProps {
  effectiveEndDate?: string;
  className?: string;
}

export function AccessExpiredBanner({ effectiveEndDate, className = '' }: AccessExpiredBannerProps) {
  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 ${className}`}>
      <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Your access has expired</p>
        <p className="text-xs text-amber-600 mt-0.5">
          {effectiveEndDate
            ? `Your access expired on ${new Date(effectiveEndDate).toLocaleDateString()}.`
            : 'Your access to this batch has expired.'
          }
          {' '}Contact your institute for an extension.
        </p>
      </div>
    </div>
  );
}

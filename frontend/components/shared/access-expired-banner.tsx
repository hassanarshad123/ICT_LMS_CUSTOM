'use client';

import { AlertTriangle, Clock } from 'lucide-react';

interface AccessExpiredBannerProps {
  effectiveEndDate?: string;
  className?: string;
}

export function AccessExpiredBanner({ effectiveEndDate, className = '' }: AccessExpiredBannerProps) {
  const isExpired = !effectiveEndDate || new Date(effectiveEndDate) <= new Date();

  if (!isExpired && effectiveEndDate) {
    // Access is approaching expiry — show countdown
    const end = new Date(effectiveEndDate);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    if (daysLeft > 7) return null; // Only show warning within 7 days

    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 ${className}`}>
        <Clock size={20} className="text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800">Access expires soon</p>
          <p className="text-xs text-yellow-600 mt-0.5">
            Your access expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} (on {end.toLocaleDateString()}).
            Contact your institute if you need an extension.
          </p>
        </div>
      </div>
    );
  }

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

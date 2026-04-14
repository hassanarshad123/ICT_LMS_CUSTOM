'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { getMyFees } from '@/lib/api/admissions';
import { formatMoney } from '@/lib/utils/format';

/**
 * Slim red banner shown to students on the dashboard when any of their fee
 * plans is overdue. Silently renders nothing otherwise. Safe to mount for all
 * authenticated roles — ``getMyFees`` returns an empty list for non-students.
 */
export default function FeeOverdueBanner() {
  const { role } = useAuth();
  const basePath = useBasePath();
  const { data } = useApi(() => getMyFees(), [role]);

  if (role !== 'student') return null;
  if (!data || !data.summary.isOverdue || data.summary.balanceDue <= 0) return null;

  return (
    <Link
      href={`${basePath}/fees`}
      className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 hover:bg-red-100 transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <AlertTriangle size={18} className="text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-900">
          Outstanding balance of {formatMoney(data.summary.balanceDue, data.summary.currency)}
        </p>
        <p className="text-xs text-red-700">
          Your content is locked until this is cleared. Tap to view details.
        </p>
      </div>
      <ChevronRight size={18} className="text-red-400 flex-shrink-0" />
    </Link>
  );
}

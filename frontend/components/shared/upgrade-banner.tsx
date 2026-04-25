'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getMyInstitute, MyInstituteResponse } from '@/lib/api/upgrade';
import { UpgradeModal } from './upgrade-modal';

const DISMISS_KEY = 'upgrade_banner_dismissed_at';
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 4; // Re-show every 4 hours

/**
 * Persistent top banner shown to trial-tier admins.
 *
 * Visibility rules:
 *   - Only shown when institute.plan_tier === 'free' (trial)
 *   - Hidden if user role is not admin/course_creator/teacher (students don't care)
 *   - Dismissable for 4 hours via localStorage
 *   - Also shown to paid-tier admins if they want to upgrade further (reduced prominence)
 */
export function UpgradeBanner() {
  const { user, hasPermission } = useAuth();
  const [institute, setInstitute] = useState<MyInstituteResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const shouldShow = hasPermission('billing.view');

  useEffect(() => {
    if (!shouldShow || !user) return;

    // Check dismissal window
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < DISMISS_DURATION_MS) {
          setDismissed(true);
          return;
        }
      }
    } catch {
      // localStorage may be unavailable — proceed anyway
    }

    // Fetch institute state
    getMyInstitute()
      .then(setInstitute)
      .catch(() => {
        // Silently swallow — banner is non-critical
      });
  }, [shouldShow, user]);

  if (!shouldShow || !institute || dismissed) return null;
  if (!institute.isTrial) return null; // Only show during trial

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const daysLeft = institute.trialDaysRemaining ?? 0;
  const urgent = daysLeft <= 3;

  return (
    <>
      <div
        className={`border-b px-4 py-3 ${
          urgent
            ? 'bg-red-50 border-red-200'
            : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
        }`}
      >
        <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Sparkles
              size={18}
              className={`flex-shrink-0 ${urgent ? 'text-red-600' : 'text-emerald-600'}`}
            />
            <p className={`text-sm ${urgent ? 'text-red-800' : 'text-emerald-800'}`}>
              <span className="font-semibold">
                {daysLeft > 0
                  ? `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                  : 'Your trial has expired'}
              </span>
              <span className="hidden sm:inline">
                {' — '}Upgrade to keep your academy running, starting at Rs 2,500/month.
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                urgent
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              Upgrade now <ArrowRight size={12} />
            </button>
            <button
              onClick={handleDismiss}
              className={`p-1 transition-colors ${
                urgent ? 'text-red-400 hover:text-red-600' : 'text-emerald-400 hover:text-emerald-600'
              }`}
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
      {modalOpen && (
        <UpgradeModal
          institute={institute}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

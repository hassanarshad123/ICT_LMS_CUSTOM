'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function ImpersonationBanner() {
  const { user, isImpersonating } = useAuth();

  if (!isImpersonating || !user) return null;

  const roleName = (user.role || '').replace(/_/g, ' ').replace(/-/g, ' ');

  const handleExit = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('is_impersonating');
    localStorage.removeItem('impersonator_id');

    // Try to close the impersonation tab
    window.close();
    // Fallback if browser blocks window.close()
    setTimeout(() => {
      window.location.href = '/sa/institutes';
    }, 300);
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium z-50">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} />
        <span>
          You are impersonating <strong>{user.name || user.email}</strong> ({roleName})
        </span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-xs font-semibold"
      >
        <X size={14} />
        Exit Impersonation
      </button>
    </div>
  );
}

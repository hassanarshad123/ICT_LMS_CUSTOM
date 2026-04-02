'use client';

import { useState } from 'react';
import { Mail, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api/client';

export default function EmailVerifyBanner() {
  const { email, emailVerified } = useAuth();
  const [resending, setResending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (emailVerified || dismissed) return null;

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      await apiClient('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      toast.success('Verification email sent! Check your inbox.');
    } catch {
      toast.error('Failed to send verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 min-w-0">
          <Mail size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">Verify your email</span>
            <span className="hidden sm:inline"> to keep your account active. Check your inbox for the verification link.</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleResend}
            disabled={resending}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {resending ? <Loader2 size={12} className="animate-spin" /> : 'Resend'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-amber-400 hover:text-amber-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { resetPassword } from '@/lib/api/auth';
import { useBranding } from '@/lib/branding-context';
import ZensbotBadge from '@/components/shared/zensbot-badge';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { instituteName, logoUrl } = useBranding();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token!, password);
      setSuccess(true);
      toast.success('Password reset successfully');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Reset link has expired or is invalid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={instituteName} className="w-16 h-16 object-contain rounded-[20%] mx-auto mb-4" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={32} className="text-white" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">{instituteName}</h1>
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-8 card-shadow">
          {!token ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={28} className="text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-primary mb-2">Invalid reset link</h2>
              <p className="text-sm text-gray-500 mb-6">
                This password reset link is missing or invalid.
              </p>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Request a new reset link
              </Link>
            </div>
          ) : success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-primary mb-2">Password reset</h2>
              <p className="text-sm text-gray-500 mb-2">
                Your password has been reset successfully. Redirecting to login...
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-primary mb-6">Set a new password</h2>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-primary text-white hover:bg-primary/80 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Reset Password
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="w-12 h-px bg-gray-300" />
          <ZensbotBadge variant="light" />
        </div>
      </div>
    </div>
  );
}

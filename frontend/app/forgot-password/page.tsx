'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { forgotPassword } from '@/lib/api/auth';
import { useBranding } from '@/lib/branding-context';
import ZensbotBadge from '@/components/shared/zensbot-badge';

export default function ForgotPasswordPage() {
  const { instituteName, logoUrl } = useBranding();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await forgotPassword(email);
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
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
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-primary mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists with that email, we&apos;ve sent a password reset link.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-primary mb-2">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
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
                  Send Reset Link
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/login" className="text-sm text-primary hover:underline">
                  Back to Login
                </Link>
              </div>
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

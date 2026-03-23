'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { login } from '@/lib/api/auth';
import { useBranding } from '@/lib/branding-context';
import ZensbotBadge from '@/components/shared/zensbot-badge';
import { isSuperAdminDomain } from '@/lib/utils/subdomain';

export default function LoginPage() {
  const router = useRouter();
  const { instituteName, tagline, logoUrl } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (stored && token) {
      try {
        const user = JSON.parse(stored);
        if (user.role === 'super_admin') {
          router.replace('/sa');
        } else {
          router.replace(`/${user.id}`);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setError('');
    setLoading(true);

    // Clear any stale tokens before attempting login
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    try {
      const res = await login(email, password);

      // If a non-SA user tries to log in on the bare (super admin) domain, reject
      if (res.user.role !== 'super_admin' && isSuperAdminDomain()) {
        setError('Please log in at your institute URL.');
        return;
      }

      localStorage.setItem('access_token', res.accessToken);
      localStorage.setItem('refresh_token', res.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.user));

      if (res.user.role === 'super_admin') {
        router.push('/sa');
      } else {
        router.push(`/${res.user.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={instituteName} className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain rounded-[20%] mx-auto mb-4" />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={28} className="text-white" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">{instituteName}</h1>
          <p className="text-gray-500 mt-2">{tagline}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 card-shadow">
          <h2 className="text-lg font-semibold text-primary mb-6">Login to your account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-primary text-white hover:bg-primary/80 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Login
              {!loading && <ChevronRight size={16} />}
            </button>
          </form>
        </div>

        {/* Developer attribution */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="w-12 h-px bg-gray-300" />
          <ZensbotBadge variant="light" />
        </div>
      </div>
    </div>
  );
}

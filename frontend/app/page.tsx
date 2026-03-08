'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, ChevronRight, Loader2 } from 'lucide-react';
import { login } from '@/lib/api/auth';

const rolePathMap: Record<string, string> = {
  admin: '/admin',
  course_creator: '/course-creator',
  teacher: '/teacher',
  student: '/student',
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setError('');
    setLoading(true);

    try {
      const res = await login(email, password);
      localStorage.setItem('access_token', res.accessToken);
      localStorage.setItem('refresh_token', res.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.user));

      const path = rolePathMap[res.user.role] || '/student';
      router.push(path);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">ICT Institute</h1>
          <p className="text-gray-500 mt-2">Learning Management System</p>
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-8 card-shadow">
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-6">Login to your account</h2>

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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] transition-colors bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] transition-colors bg-gray-50"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-[#1A1A1A] text-white hover:bg-[#333] disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Login
              {!loading && <ChevronRight size={16} />}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ICT Institute LMS - All rights reserved
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { GraduationCap, Shield, BookOpen, Users, ChevronRight } from 'lucide-react';

const roles: { role: UserRole; label: string; description: string; icon: React.ReactNode; path: string }[] = [
  { role: 'admin', label: 'Admin', description: 'Manage batches, students & teachers', icon: <Shield size={28} />, path: '/admin' },
  { role: 'course-creator', label: 'Course Creator', description: 'Create lectures & curriculum', icon: <BookOpen size={28} />, path: '/course-creator' },
  { role: 'teacher', label: 'Teacher', description: 'Teach batches & schedule classes', icon: <GraduationCap size={28} />, path: '/teacher' },
  { role: 'student', label: 'Student', description: 'Watch lectures & attend classes', icon: <Users size={28} />, path: '/student' },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    const rolePath = roles.find((r) => r.role === selectedRole)?.path;
    if (rolePath) router.push(rolePath);
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
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Select Your Role</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {roles.map((r) => (
              <button
                key={r.role}
                onClick={() => setSelectedRole(r.role)}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  selectedRole === r.role
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-[#1A1A1A]'
                }`}
              >
                <div className={`mb-2 ${selectedRole === r.role ? 'text-[#C5D86D]' : 'text-gray-400'}`}>
                  {r.icon}
                </div>
                <div className="font-medium text-sm">{r.label}</div>
                <div className={`text-xs mt-1 ${selectedRole === r.role ? 'text-gray-300' : 'text-gray-400'}`}>
                  {r.description}
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] transition-colors bg-gray-50"
              />
            </div>
            <button
              type="submit"
              disabled={!selectedRole}
              className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                selectedRole
                  ? 'bg-[#1A1A1A] text-white hover:bg-[#333]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Login
              <ChevronRight size={16} />
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

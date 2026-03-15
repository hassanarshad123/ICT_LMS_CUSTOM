'use client';

import { RegisterForm } from '@/components/signup/register-form';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-zen-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="font-serif text-3xl text-zen-dark">Zensbot</span>
          <p className="text-sm text-zen-dark/60 mt-2">Create your LMS in minutes</p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-zen-dark mb-6">Create your account</h2>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}

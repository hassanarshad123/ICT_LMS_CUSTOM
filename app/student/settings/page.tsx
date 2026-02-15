'use client';
import SettingsView from '@/components/shared/settings-view';
import { useAuth } from '@/lib/auth-context';
export default function StudentSettings() {
  const user = useAuth();
  return (
    <SettingsView
      role="student"
      userName="Muhammad Imran"
      subtitle="Manage your account"
      extraProfileFields={
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
          <input
            type="text"
            value={user.batchNames?.join(', ') || 'Batch 3 - August 2024'}
            disabled
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-100 opacity-60 cursor-not-allowed"
          />
        </div>
      }
    />
  );
}
